import path from "path";
import { log, runCmd } from "../helpers";
import { WorkerTask } from "../project_worker";
import { TaskContext, TaskDef } from "./common_tasks";

export const NPM_INSTALL_PACKAGE_CMD = "[npm-install]";

export const NPM_INSTALL_PACKAGE: TaskDef = {
  extract: (line: string) => {
    const out: WorkerTask[] = [];

    const lines = line.split("\n");

    // Parse INSTALL_PACKAGE tasks
    for (const line of lines) {
      if (line.includes(NPM_INSTALL_PACKAGE_CMD)) {
        let name = line
          .substring(
            line.indexOf(NPM_INSTALL_PACKAGE_CMD) +
              NPM_INSTALL_PACKAGE_CMD.length,
          )
          .trim();
        out.push({ type: NPM_INSTALL_PACKAGE_CMD, args: [name] });
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

    log(NPM_INSTALL_PACKAGE_CMD, "Installing package", { dir, package: name });
    const { code, stdout, stderr } = await runCmd(dir, "npm", [
      "install",
      name,
    ]);
    log(NPM_INSTALL_PACKAGE_CMD, "Package installation", {
      code,
      stdout,
      stderr,
    });
    return [true, null];
  },
  title: (task: WorkerTask) => `Installing package ${task.args[0]}`,
  isExposedToAi: true,
  isLoop: false,
};
