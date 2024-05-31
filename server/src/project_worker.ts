import { ChildProcess } from "child_process";
import fs from "fs/promises";
import path from "path";
import { log, runCmd } from "./helpers";
import rails from "./templates/rails";
import { Template } from "./templates/template";
import viteReactTs from "./templates/vite_react_ts";

export type TemplateName = "vite:react-ts" | "rails";

// templates should be registered here
const TEMPLATES: Record<TemplateName, Template> = {
  "vite:react-ts": viteReactTs,
  rails: rails,
};

const ACTOR = "projworker";

export type TaskContext = {
  rootPath: string;
  dirName: string;
};

export type TaskDef = {
  extract: (line: string) => WorkerTask[];
  run: (
    ctx: TaskContext,
    task: WorkerTask
  ) => Promise<[true, null] | [false, string]>;
  title: (task: WorkerTask) => string;
  isExposedToAi: boolean;
  isLoop: boolean;
};

const COMMON_TASK_DEFS: Record<string, TaskDef> = {
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
    isExposedToAi: true,
    isLoop: false,
  },
};

export type WorkerTask = {
  type: string;
  args: string[];
};

export class ProjectWorker {
  private rootPath = "";
  private dirName = "";
  private port = 0;
  private template: TemplateName;
  protected serverProcess: ChildProcess | null = null;

  constructor(
    rootPath: string,
    dirName: string,
    port: number,
    template: TemplateName
  ) {
    log(ACTOR, "Creating project worker", {
      rootPath,
      dirName,
      port,
      template,
    });
    this.rootPath = rootPath;
    this.dirName = dirName;
    this.port = port;
    this.template = template;
  }

  allTaskDefs() {
    const defs = TEMPLATES[this.template].taskDefs;
    return { ...COMMON_TASK_DEFS, ...defs };
  }

  async runTask(task: WorkerTask): Promise<[true, null] | [false, string]> {
    const def = this.allTaskDefs()[task.type];
    if (!def) {
      log(ACTOR, "Error: Unknown task type", { task });
      return [false, "Unknown task type"];
    }
    const ctx: TaskContext = { rootPath: this.rootPath, dirName: this.dirName };
    return await def.run(ctx, task);
  }

  startServer() {
    log(ACTOR, "Starting the project in the background...");
    this.serverProcess = TEMPLATES[this.template].startServer(
      this.rootPath,
      this.dirName,
      this.port
    );
  }

  async createProject(
    template: TemplateName
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

    const scaffold = TEMPLATES[template].scaffold;
    log(ACTOR, "Creating project using template", { template });
    await scaffold(rootPath, dirName);
    await initGit(dir);
    return "OK";
  }

  serverUrl() {
    return `http://localhost:${this.port}`;
  }

  loopTasks() {
    const defs = this.allTaskDefs();

    return Object.keys(defs)
      .filter((k) => defs[k]?.isLoop)
      .map((k) => {
        return { type: k, args: [] };
      });
  }

  getSystemMessage() {
    return TEMPLATES[this.template].system;
  }

  parseTasks(message: string): WorkerTask[] {
    const defs = this.allTaskDefs();
    const out: WorkerTask[] = [];

    Object.values(defs).forEach((def) => {
      out.push(...def.extract(message));
    });

    return out;
  }

  taskTitle(task: WorkerTask): string {
    const defs = this.allTaskDefs();

    const def = defs[task.type];
    if (!def) {
      return "Unknown task";
    }
    return def.title(task);
  }
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
