import fs from "fs/promises";
import path from "path";
import { log, runBackground, runCmd } from "./helpers";
import { ChildProcess } from "child_process";

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

  async runTask(task: WorkerTask) {
    if (task.type === "UPDATE_FILE") {
      const filePath = path.join(this.rootPath, this.dirName, task.path);
      log(ACTOR, "Updating file", { filePath });

      // Ensure the directory structure exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, task.content);
    } else {
      log(ACTOR, "Error: Unknown task type", { task });
    }
  }

  startServer() {
    const dir = path.join(this.rootPath, this.dirName);
    log(ACTOR, "Starting project worker");
    this.serverProcess = runBackground(dir, "npm", ["run", "dev"]);
  }

  async createProject(
    template: "vite:react-ts" = "vite:react-ts"
  ): Promise<"OK" | "EXISTS" | "UNKNOWN_TEMPLATE"> {
    const rootPath = this.rootPath;
    const dirName = this.dirName;
    const dir = path.join(rootPath, dirName);
    log(ACTOR, "Creating project new project at", { dir });

    const isExists = await fs
      .access(dir)
      .then(() => true)
      .catch(() => false);

    if (isExists) {
      log(ACTOR, "Error: Project already exists", { dir });
      return "EXISTS";
    }

    if (template === "vite:react-ts") {
      log(ACTOR, "Creating project using template", { template });
      await runCmd(rootPath, "npm", [
        "create",
        "vite@latest",
        dirName,
        "--",
        "--template",
        "react-ts",
      ]);

      const indexCss = `${dir}/src/index.css`;

      // don't like the default styles
      await fs.writeFile(indexCss, "");
    } else {
      log(ACTOR, "Error: Unknown template", { template });
      return "UNKNOWN_TEMPLATE";
    }

    await runCmd(dir, "git", [
      "config",
      "--global",
      "init.defaultBranch",
      "main",
    ]);
    await runCmd(dir, "git", ["init", dir]);
    await runCmd(dir, "git", ["add", "."]);
    await runCmd(dir, "git", ["commit", "-m", "Initial commit"]);
    await runCmd(dir, "npm", ["install"]);

    return "OK";

    // try {
    //   await fs.mkdir(dir);
    // } catch (error) {
    //   log("[ERROR] Failed to create directory", { dir, error });
    // }
  }
}

export function parseTasks(message: string): WorkerTask[] {
  const out: WorkerTask[] = [];

  const lines = message.split("\n");

  // Parse INSTALL_PACKAGE tasks
  for (const line of lines) {
    if (line.includes("INSTALL_PACKAGE")) {
      let name = line.split(":")[1].trim();
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
      path = line.split(":")[1].trim();
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
  } else {
    return "Unknown task";
  }
}
