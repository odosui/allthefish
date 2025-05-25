import path from "path";
import { WorkerTask } from "../project_worker";
import { TaskContext, TaskDef } from "./common_tasks";
import { log } from "../utils/logger";
import { runCmd } from "../utils/proc";

export const NPM_INSTALL_CMD = "[npm-install]";
export const NPM_INSTALL_INST = `At any time you can ask to install an npm module: write ${NPM_INSTALL_CMD} <name>. Make sure you start with a new line.`;

export const NPM_INSTALL_PACKAGE: TaskDef = {
  extract: (line: string) => {
    const out: WorkerTask[] = [];

    const lines = line.split("\n");

    // Parse INSTALL_PACKAGE tasks
    for (const line of lines) {
      if (line.includes(NPM_INSTALL_CMD)) {
        let name = line
          .substring(line.indexOf(NPM_INSTALL_CMD) + NPM_INSTALL_CMD.length)
          .trim();
        out.push({ type: NPM_INSTALL_CMD, args: [name] });
      }
    }

    return out;
  },
  run: async (ctx: TaskContext, task: WorkerTask) => {
    const dir = path.join(ctx.rootPath, ctx.dirName);
    const name = task.args[0];
    if (!name) {
      return {
        success: false,
        messageToAgent: "Misformed task: missing the package name",
      };
    }

    log(NPM_INSTALL_CMD, "Installing package", { dir, package: name });
    const { code, stdout, stderr } = await runCmd(dir, "npm", [
      "install",
      name,
    ]);
    log(NPM_INSTALL_CMD, "Package installation", {
      code,
      stdout,
      stderr,
    });
    return {
      success: code === 0,
      messageToAgent: null,
    };
  },
  title: (task: WorkerTask) => `Installing package ${task.args[0]}`,
  isExposedToAi: true,
  isLoop: false,
};
