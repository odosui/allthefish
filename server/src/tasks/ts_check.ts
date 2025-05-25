import { WorkerTask } from "../project_worker";
import { log } from "../utils/logger";
import { runCmd } from "../utils/proc";
import { TaskContext, TaskDef } from "./common_tasks";

export const TS_CHECK_TYPES_CMD = "[ts-check-types]";

export const TS_CHECK_TYPES: TaskDef = {
  extract: (_line: string) => {
    // not applicable
    return [];
  },
  run: async (ctx: TaskContext, _task: WorkerTask) => {
    const dir = ctx.rootPath;
    log(TS_CHECK_TYPES_CMD, "Checking types for project", { dir });
    const { code, stdout, stderr } = await runCmd(
      dir,
      "./node_modules/.bin/tsc",
      ["--noEmit"],
    );
    if (code !== 0) {
      const msg = `Typescript checking failed with code ${code}. \n\n Stdout: \n\n \`\`\`\n${stdout}\n\`\`\`\n\n Stderr: \n\n \`\`\`\n${stderr}\n\`\`\``;
      log(TS_CHECK_TYPES_CMD, "Typescript checking failed", { msg });
      return {
        success: false,
        messageToAgent: msg,
      };
    } else {
      log(TS_CHECK_TYPES_CMD, "Typescript checking passed");
      return {
        success: true,
        messageToAgent: null,
      };
    }
  },
  title: (_task: WorkerTask) => `Checking types...`,
  isExposedToAi: false,
  isLoop: true,
};
