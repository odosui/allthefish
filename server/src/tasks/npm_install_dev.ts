import path from "path";
import { WorkerTask } from "../project_worker";
import { TaskContext, TaskDef } from "./common_tasks";
import { log } from "../utils/logger";
import { runCmd } from "../utils/proc";

export const NPM_INSTALL_DEV_CMD = "[npm-install-dev]";
export const NPM_INSTALL_DEV_INST = `At any time you can ask to install a development npm module: write ${NPM_INSTALL_DEV_CMD} <name>. Make sure you start with a new line.`;

export const NPM_INSTALL_DEV_PACKAGE: TaskDef = {
  extract: (line: string) => {
    const out: WorkerTask[] = [];

    const lines = line.split("\n");

    // Parse INSTALL_PACKAGE tasks
    for (const line of lines) {
      if (line.includes(NPM_INSTALL_DEV_CMD)) {
        let name = line
          .substring(
            line.indexOf(NPM_INSTALL_DEV_CMD) + NPM_INSTALL_DEV_CMD.length,
          )
          .trim();
        out.push({ type: NPM_INSTALL_DEV_CMD, args: [name] });
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

    log(NPM_INSTALL_DEV_CMD, "Installing dev package", {
      dir,
      package: name,
    });
    const { code, stdout, stderr } = await runCmd(dir, "npm", [
      "install",
      name,
      "--save-dev",
    ]);
    log(NPM_INSTALL_DEV_CMD, "Dev package installation", {
      code,
      stdout,
      stderr,
    });
    return [true, null];
  },
  title: (task: WorkerTask) => `Installing dev package ${task.args[0]}`,
  isExposedToAi: true,
  isLoop: false,
};
