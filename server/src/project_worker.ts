import fs from "fs/promises";
import path from "path";
import { log, runBackground, runCmd } from "./helpers";
import { ChildProcess } from "child_process";
import { scaffold as scaffoldViteReactTs } from "./templates/vite_react_ts";

const ACTOR = "projworker";

export type WorkerTask =
  | {
      type: "UPDATE_FILE";
      path: string;
      content: string;
    }
  | {
      type: "INSTALL_PACKAGE";
      name: string;
    }
  | {
      type: "CHECK_TYPES";
    };

const SCAFFOLDS = {
  "vite:react-ts": scaffoldViteReactTs,
};

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

  async checkTypes() {
    const dir = path.join(this.rootPath, this.dirName);
    log(ACTOR, "Checking types for project", { dir });
    return await runCmd(dir, "./node_modules/.bin/tsc", ["--noEmit"]);
  }

  async runTask(task: WorkerTask) {
    if (task.type === "UPDATE_FILE") {
      const filePath = path.join(this.rootPath, this.dirName, task.path);
      log(ACTOR, "Updating file", { filePath });

      // Ensure the directory structure exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, task.content);
    } else if (task.type === "INSTALL_PACKAGE") {
      const dir = path.join(this.rootPath, this.dirName);
      log(ACTOR, "Installing package", { dir, package: task.name });
      await runCmd(dir, "npm", ["install", task.name]);
    } else {
      log(ACTOR, "Error: Unknown task type", { task });
    }
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
    await this.checkTypes();
    return "OK";
  }

  serverUrl() {
    return `http://localhost:${this.port}`;
  }
}

export function parseTasks(message: string): WorkerTask[] {
  const out: WorkerTask[] = [];

  const lines = message.split("\n");

  // Parse INSTALL_PACKAGE tasks
  for (const line of lines) {
    if (line.includes("INSTALL_PACKAGE")) {
      let name = line.substring(line.indexOf("INSTALL_PACKAGE") + 16).trim();
      if (name.endsWith(".")) {
        name = name.slice(0, -1);
      }
      out.push({ type: "INSTALL_PACKAGE", name });
    }
  }

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
            path,
            content: code,
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
}

export function taskTitle(task: WorkerTask): string {
  if (task.type === "INSTALL_PACKAGE") {
    return `Installing package ${task.name}`;
  } else if (task.type === "UPDATE_FILE") {
    return `Updating file ${task.path}`;
  } else if (task.type === "CHECK_TYPES") {
    return "Checking types...";
  } else {
    return "Unknown task";
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
