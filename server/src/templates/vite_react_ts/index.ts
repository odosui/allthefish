import fs from "fs/promises";
import path from "path";
import { log, runBackground, runCmd } from "../../helpers";
import { TaskContext, TaskDef, WorkerTask } from "../../project_worker";
import { Template } from "../template";

const ACTOR = "VITE_REACT_TS";

const SYSTEM = [
  "You are a professional TypeScript and React programmer. You task is to build a website based on provided description.",
  "At any time you can ask to update a specific file. Write UPDATE_FILE <path_of_the_file_to_update>, followed by code. Make sure you start with a new line. Make sure to provide the full file contents including the parts that are not changed.",
  "At any time you can ask to install an npm module: write INSTALL_PACKAGE <name> (or INSTALL_DEV_PACKAGE to use --save-dev). Make sure you start with a new line.",
  "At any time you can ask for a screenshot: write PROVIDE_SCREENSHOT.",
  "Please be consise, and don't explain anything until asked by a user.",
  "Consider the following good practices: files should be small, components should be reusable, the code should be clean and easy to understand. In CSS, use CSS variables. Use css variables (--u1, --u2, and so on) for length units.",
  "You start at `src/App.tsx`.",
].join("\n");

async function scaffold(rootPath: string, dirName: string) {
  const dir = path.join(rootPath, dirName);

  await runCmd(rootPath, "npm", [
    "create",
    "vite@latest",
    dirName,
    "--",
    "--template",
    "react-ts",
  ]);

  await runCmd(dir, "npm", ["install"]);

  // I don't like the default styles
  await fs.writeFile(`${dir}/src/index.css`, "");
}

const TASK_DEFS: Record<string, TaskDef> = {
  UPDATE_FILE: {
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
      log(ACTOR, "Updating file", { filePath });

      // Ensure the directory structure exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
      return [true, null];
    },
    title: (task: WorkerTask) => `Updating file ${task.args[0]}`,
    isExposedToAi: true,
    isLoop: false,
  },
  INSTALL_PACKAGE: {
    extract: (line: string) => {
      const out: WorkerTask[] = [];

      const lines = line.split("\n");

      // Parse INSTALL_PACKAGE tasks
      for (const line of lines) {
        if (line.includes("INSTALL_PACKAGE")) {
          let name = line
            .substring(line.indexOf("INSTALL_PACKAGE") + 16)
            .trim();
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

      log(ACTOR, "Installing package", { dir, package: name });
      const { code, stdout, stderr } = await runCmd(dir, "npm", [
        "install",
        name,
      ]);
      log(ACTOR, "Package installation", { code, stdout, stderr });
      return [true, null];
    },
    title: (task: WorkerTask) => `Installing package ${task.args[0]}`,
    isExposedToAi: true,
    isLoop: false,
  },
  INSTALL_DEV_PACKAGE: {
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

      log(ACTOR, "Installing dev package", { dir, package: name });
      const { code, stdout, stderr } = await runCmd(dir, "npm", [
        "install",
        name,
        "--save-dev",
      ]);
      log(ACTOR, "Dev package installation", { code, stdout, stderr });
      return [true, null];
    },
    title: (task: WorkerTask) => `Installing dev package ${task.args[0]}`,
    isExposedToAi: true,
    isLoop: false,
  },
  CHECK_TYPES: {
    extract: (_line: string) => {
      // not applicable
      return [];
    },
    run: async (ctx: TaskContext, _task: WorkerTask) => {
      const dir = path.join(ctx.rootPath, ctx.dirName);
      log(ACTOR, "Checking types for project", { dir });
      const { code, stdout, stderr } = await runCmd(
        dir,
        "./node_modules/.bin/tsc",
        ["--noEmit"]
      );
      if (code !== 0) {
        const msg = `Typescript checking failed with code ${code}. \n\n Stdout: \n\n \`\`\`\n${stdout}\n\`\`\`\n\n Stderr: \n\n \`\`\`\n${stderr}\n\`\`\``;
        log(ACTOR, "Typescript checking failed", { msg });
        return [false, msg];
      } else {
        log(ACTOR, "Typescript checking passed");
        return [true, null];
      }
    },
    title: (_task: WorkerTask) => `Checking types...`,
    isExposedToAi: false,
    isLoop: true,
  },
};

function startServer(rootPath: string, dirName: string, port: number) {
  const dir = path.join(rootPath, dirName);
  return runBackground(dir, "npm", [
    "run",
    "dev",
    "--",
    "--port",
    port.toString(),
  ]);
}

const t: Template = {
  system: SYSTEM,
  scaffold: scaffold,
  taskDefs: TASK_DEFS,
  startServer: startServer,
};

export default t;
