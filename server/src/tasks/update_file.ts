import path from "path";
import fs from "fs/promises";
import { WorkerTask } from "../project_worker";
import { TaskContext, TaskDef } from "./common_tasks";
import { log } from "../utils/logger";

export const UPDATE_FILE_CMD = "[update-file]";

export const UPDATE_FILE_INST = `At any time you can ask to update a specific file. Write ${UPDATE_FILE_CMD} <path_of_the_file_to_update>, followed by code. Make sure you start with a new line. Make sure to provide the full file contents including the parts that are not changed.`;

export const UPDATE_FILE: TaskDef = {
  extract: (line: string) => {
    const out: WorkerTask[] = [];

    const lines = line.split("\n");

    // Parse UPDATE_FILE tasks
    let isInTask = false;
    let path = "";
    let inCode = false;
    let code = "";

    for (const line of lines) {
      if (line.startsWith(UPDATE_FILE_CMD)) {
        isInTask = true;
        path = line
          .substring(line.indexOf(UPDATE_FILE_CMD) + UPDATE_FILE_CMD.length)
          .trim();
        continue;
      } else if (isInTask) {
        if (inCode) {
          if (line.startsWith("```")) {
            out.push({
              type: UPDATE_FILE_CMD,
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
      return {
        success: false,
        messageToAgent: "Misformed task: missing the file path or content",
      };
    }
    const filePath = path.join(ctx.rootPath, p);
    log(UPDATE_FILE_CMD, "Updating file", { filePath });

    // Ensure the directory structure exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
    return {
      success: true,
      messageToAgent: null,
    };
  },
  title: (task: WorkerTask) => `Updating file ${task.args[0]}`,
  isExposedToAi: true,
  isLoop: false,
};
