import fs from "fs/promises";
import path from "path";
import { log, runBackground, runCmd } from "./helpers";
import { ChildProcess } from "child_process";
import { scaffold as scaffoldViteReactTs } from "./templates/vite_react_ts";

const ACTOR = "projworker";

type TaskContext = {
  rootPath: string;
  dirName: string;
};

type TaskDef = {
  extract: (line: string) => WorkerTask[];
  run: (
    ctx: TaskContext,
    task: WorkerTask
  ) => Promise<[true, null] | [false, string]>;
  title: (task: WorkerTask) => string;
};

const TASK_DEFS: Record<string, TaskDef> = {
  UPDATE_FILE: {
    extract: (line: string) => {
      const out: WorkerTask[] = [];

      const lines = line.split("\n");

      // Parse UPDATE_FILE tasks
      let isInTask = false;
      let path = "";
      let inCode = false;
      let code = "";

      for (const line of lines) {
        if (line.startsWith("UPDATE_FILE")) {
          isInTask = true;
          path = line.substring(line.indexOf("UPDATE_FILE") + 11).trim();
          continue;
        } else if (isInTask) {
          if (inCode) {
            if (line.startsWith("```")) {
              out.push({
                type: "UPDATE_FILE",
                args: [path, code],
              });
              code = "";
              inCode = false;
              isInTask = false;
              path = "";
            } else {
              code += line + "\n";
            }
          } else {
            if (line.startsWith("```")) {
              inCode = true;
            }
          }
        }
      }
      return out;
    },
    run: async (ctx: TaskContext, task: WorkerTask) => {
      const [p, content] = task.args;
      if (!p || !content) {
        return [false, "Misformed task"];
      }
      const filePath = path.join(ctx.rootPath, ctx.dirName, p);
      log(ACTOR, "Updating file", { filePath });

      // Ensure the directory structure exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
      return [true, null];
    },
    title: (task: WorkerTask) => `Updating file ${task.args[0]}`,
  },
  INSTALL_PACKAGE: {
    extract: (line: string) => {
      const out: WorkerTask[] = [];

      const lines = line.split("\n");

      // Parse INSTALL_PACKAGE tasks
      for (const line of lines) {
        if (line.includes("INSTALL_PACKAGE")) {
          let name = line
            .substring(line.indexOf("INSTALL_PACKAGE") + 16)
            .trim();
          out.push({ type: "INSTALL_PACKAGE", args: [name] });
        }
      }

      return out;
    },
    run: async (ctx: TaskContext, task: WorkerTask) => {
      const dir = path.join(ctx.rootPath, ctx.dirName);
      const name = task.args[0];
      if (!name) {
        return [false, "Misformed task"];
      }

      log(ACTOR, "Installing package", { dir, package: name });
      const { code, stdout, stderr } = await runCmd(dir, "npm", [
        "install",
        name,
      ]);
      log(ACTOR, "Package installation", { code, stdout, stderr });
      return [true, null];
    },
    title: (task: WorkerTask) => `Installing package ${task.args[0]}`,
  },
  INSTALL_DEV_PACKAGE: {
    extract: (line: string) => {
      const out: WorkerTask[] = [];

      const lines = line.split("\n");

      // Parse INSTALL_PACKAGE tasks
      for (const line of lines) {
        if (line.includes("INSTALL_DEV_PACKAGE")) {
          let name = line
            .substring(line.indexOf("INSTALL_DEV_PACKAGE") + 16)
            .trim();
          out.push({ type: "INSTALL_DEV_PACKAGE", args: [name] });
        }
      }

      return out;
    },
    run: async (ctx: TaskContext, task: WorkerTask) => {
      const dir = path.join(ctx.rootPath, ctx.dirName);
      const name = task.args[0];
      if (!name) {
        return [false, "Misformed task"];
      }

      log(ACTOR, "Installing dev package", { dir, package: name });
      const { code, stdout, stderr } = await runCmd(dir, "npm", [
        "install",
        name,
        "--save-dev",
      ]);
      log(ACTOR, "Dev package installation", { code, stdout, stderr });
      return [true, null];
    },
    title: (task: WorkerTask) => `Installing dev package ${task.args[0]}`,
  },
  CHECK_TYPES: {
    extract: (_line: string) => {
      // not applicable
      return [];
    },
    run: async (ctx: TaskContext, _task: WorkerTask) => {
      const dir = path.join(ctx.rootPath, ctx.dirName);
      log(ACTOR, "Checking types for project", { dir });
      const { code, stdout, stderr } = await runCmd(
        dir,
        "./node_modules/.bin/tsc",
        ["--noEmit"]
      );
      if (code !== 0) {
        const msg = `Typescript checking failed with code ${code}. \n\n Stdout: \n\n \`\`\`\n${stdout}\n\`\`\`\n\n Stderr: \n\n \`\`\`\n${stderr}\n\`\`\``;
        log(ACTOR, "Typescript checking failed", { msg });
        return [false, msg];
      } else {
        log(ACTOR, "Typescript checking passed");
        return [true, null];
      }
    },
    title: (_task: WorkerTask) => `Checking types...`,
  },
};

export type WorkerTask = {
  type: string;
  args: string[];
};

const SCAFFOLDS = {
  "vite:react-ts": scaffoldViteReactTs,
};

export function taskTitle(task: WorkerTask): string {
  const def = TASK_DEFS[task.type];
  if (!def) {
    return "Unknown task";
  }
  return def.title(task);
}

export class ProjectWorker {
  private rootPath = "";
  private dirName = "";
  private port = 0;
  protected serverProcess: ChildProcess | null = null;

  constructor(rootPath: string, dirName: string, port: number) {
    this.rootPath = rootPath;
    this.dirName = dirName;
    this.port = port;
  }

  async runTask(task: WorkerTask): Promise<[true, null] | [false, string]> {
    const def = TASK_DEFS[task.type];
    if (!def) {
      log(ACTOR, "Error: Unknown task type", { task });
      return [false, "Unknown task type"];
    }
    const ctx: TaskContext = { rootPath: this.rootPath, dirName: this.dirName };
    return await def.run(ctx, task);
  }

  startServer() {
    const dir = path.join(this.rootPath, this.dirName);
    log(ACTOR, "Starting project worker");
    this.serverProcess = runBackground(dir, "npm", [
      "run",
      "dev",
      "--",
      "--port",
      this.port.toString(),
    ]);
  }

  async createProject(
    template: "vite:react-ts" = "vite:react-ts"
  ): Promise<"OK" | "EXISTS" | "UNKNOWN_TEMPLATE"> {
    const rootPath = this.rootPath;
    const dirName = this.dirName;
    const dir = path.join(rootPath, dirName);

    log(ACTOR, "Creating project new project at", { dir });

    const isExists = await isDirExists(dir);

    if (isExists) {
      log(ACTOR, "Error: Project already exists", { dir });
      return "EXISTS";
    }

    const scaffold = SCAFFOLDS[template];
    if (!scaffold) {
      log(ACTOR, "Error: Unknown template", { template });
      return "UNKNOWN_TEMPLATE";
    }
    log(ACTOR, "Creating project using template", { template });
    await scaffold(rootPath, dirName);
    await initGit(dir);
    return "OK";
  }

  serverUrl() {
    return `http://localhost:${this.port}`;
  }
}

export function parseTasks(message: string): WorkerTask[] {
  const out: WorkerTask[] = [];

  Object.values(TASK_DEFS).forEach((def) => {
    out.push(...def.extract(message));
  });

  return out;
}

async function initGit(dir: string) {
  await runCmd(dir, "git", [
    "config",
    "--global",
    "init.defaultBranch",
    "main",
  ]);
  await runCmd(dir, "git", ["init", dir]);
  await runCmd(dir, "git", ["add", "."]);
  await runCmd(dir, "git", ["commit", "-m", "Initial commit"]);
}

async function isDirExists(dir: string) {
  return await fs
    .access(dir)
    .then(() => true)
    .catch(() => false);
}
