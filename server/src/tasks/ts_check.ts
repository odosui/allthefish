import path from "path";
import { WorkerTask } from "../project_worker";
import { TaskContext, TaskDef } from "./common_tasks";
import { log, runCmd } from "../helpers";

export const TS_CHECK_TYPES_CMD = "[ts-check-types]";

export const TS_CHECK_TYPES: TaskDef = {
  extract: (_line: string) => {
    // not applicable
    return [];
  },
  run: async (ctx: TaskContext, _task: WorkerTask) => {
    const dir = path.join(ctx.rootPath, ctx.dirName);
    log(TS_CHECK_TYPES_CMD, "Checking types for project", { dir });
    const { code, stdout, stderr } = await runCmd(
      dir,
      "./node_modules/.bin/tsc",
      ["--noEmit"],
    );
    if (code !== 0) {
      const msg = `Typescript checking failed with code ${code}. \n\n Stdout: \n\n \`\`\`\n${stdout}\n\`\`\`\n\n Stderr: \n\n \`\`\`\n${stderr}\n\`\`\``;
      log(TS_CHECK_TYPES_CMD, "Typescript checking failed", { msg });
      return [false, msg];
    } else {
      log(TS_CHECK_TYPES_CMD, "Typescript checking passed");
      return [true, null];
    }
  },
  title: (_task: WorkerTask) => `Checking types...`,
  isExposedToAi: false,
  isLoop: true,
};
