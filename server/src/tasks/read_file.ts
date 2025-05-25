import path from "path";
import fs from "fs/promises";
import { WorkerTask } from "../project_worker";
import { TaskContext, TaskDef } from "./common_tasks";
import { log } from "../utils/logger";

export const READ_FILE_CMD = "[read-file]";

export const READ_FILE_INST = `To read contents of a file, write ${READ_FILE_CMD} <path_of_the_file_to_read>. The file contents will be returned in the response.`;

export const READ_FILE: TaskDef = {
  extract: (txt: string) => {
    const out: WorkerTask[] = [];

    const lines = txt.split("\n");

    for (const line of lines) {
      if (line.includes(READ_FILE_CMD)) {
        let name = line
          .substring(line.indexOf(READ_FILE_CMD) + READ_FILE_CMD.length)
          .trim();
        out.push({ type: READ_FILE_CMD, args: [name] });
      }
    }

    return out;
  },
  run: async (ctx: TaskContext, task: WorkerTask) => {
    const p = task.args[0];
    if (!p) {
      return {
        success: false,
        messageToAgent: "Misformed task: missing the file path",
      };
    }
    const filePath = path.join(ctx.rootPath, p);
    log(READ_FILE_CMD, "Reading the file", { filePath });

    const fileContent = await fs.readFile(filePath, "utf-8");
    const messageToAgent = `
      [file ${p} content]\n
      \`\`\`\n
      ${fileContent}\n
      \`\`\`
    `;
    return {
      success: true,
      messageToAgent,
    };
  },
  title: (task: WorkerTask) => `Sending file ${task.args[0]}`,
  isExposedToAi: true,
  isLoop: false,
};
