// Tasks that are common
// to multiple languages / frameworks

import fs from "fs/promises";
import path from "path";
import { log, runCmd } from "../helpers";
import { WorkerTask } from "../project_worker";

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
    log("UPDATE_FILE", "Updating file", { filePath });

    // Ensure the directory structure exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
    return [true, null];
  },
  title: (task: WorkerTask) => `Updating file ${task.args[0]}`,
  isExposedToAi: true,
  isLoop: false,
};

export const NPM_INSTALL_PACKAGE: TaskDef = {
  extract: (line: string) => {
    const out: WorkerTask[] = [];

    const lines = line.split("\n");

    // Parse INSTALL_PACKAGE tasks
    for (const line of lines) {
      if (line.includes("INSTALL_PACKAGE")) {
        let name = line.substring(line.indexOf("INSTALL_PACKAGE") + 16).trim();
        out.push({ type: "INSTALL_PACKAGE", args: [name] });
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

    log("INSTALL_PACKAGE", "Installing package", { dir, package: name });
    const { code, stdout, stderr } = await runCmd(dir, "npm", [
      "install",
      name,
    ]);
    log("INSTALL_PACKAGE", "Package installation", { code, stdout, stderr });
    return [true, null];
  },
  title: (task: WorkerTask) => `Installing package ${task.args[0]}`,
  isExposedToAi: true,
  isLoop: false,
};

export const NPM_INSTALL_DEV_PACKAGE: TaskDef = {
  extract: (line: string) => {
    const out: WorkerTask[] = [];

    const lines = line.split("\n");

    // Parse INSTALL_PACKAGE tasks
    for (const line of lines) {
      if (line.includes("INSTALL_DEV_PACKAGE")) {
        let name = line
          .substring(line.indexOf("INSTALL_DEV_PACKAGE") + 20)
          .trim();
        out.push({ type: "INSTALL_DEV_PACKAGE", args: [name] });
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

    log("NPM_INSTALL_DEV_PACKAGE", "Installing dev package", {
      dir,
      package: name,
    });
    const { code, stdout, stderr } = await runCmd(dir, "npm", [
      "install",
      name,
      "--save-dev",
    ]);
    log("NPM_INSTALL_DEV_PACKAGE", "Dev package installation", {
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

export const TS_CHECK_TYPES: TaskDef = {
  extract: (_line: string) => {
    // not applicable
    return [];
  },
  run: async (ctx: TaskContext, _task: WorkerTask) => {
    const dir = path.join(ctx.rootPath, ctx.dirName);
    log("TS_CHECK_TYPES", "Checking types for project", { dir });
    const { code, stdout, stderr } = await runCmd(
      dir,
      "./node_modules/.bin/tsc",
      ["--noEmit"]
    );
    if (code !== 0) {
      const msg = `Typescript checking failed with code ${code}. \n\n Stdout: \n\n \`\`\`\n${stdout}\n\`\`\`\n\n Stderr: \n\n \`\`\`\n${stderr}\n\`\`\``;
      log("TS_CHECK_TYPES", "Typescript checking failed", { msg });
      return [false, msg];
    } else {
      log("TS_CHECK_TYPES", "Typescript checking passed");
      return [true, null];
    }
  },
  title: (_task: WorkerTask) => `Checking types...`,
  isExposedToAi: false,
  isLoop: true,
};
