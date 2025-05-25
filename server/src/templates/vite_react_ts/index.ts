import fs from "fs/promises";
import path from "path";
import { Template } from "../template";
import {
  NPM_INSTALL_CMD,
  NPM_INSTALL_INST,
  NPM_INSTALL_PACKAGE,
} from "../../tasks/npm_install";
import {
  NPM_INSTALL_DEV_CMD,
  NPM_INSTALL_DEV_INST,
  NPM_INSTALL_DEV_PACKAGE,
} from "../../tasks/npm_install_dev";
import { TS_CHECK_TYPES, TS_CHECK_TYPES_CMD } from "../../tasks/ts_check";
import { TaskDef } from "../../tasks/common_tasks";
import { UPDATE_FILE_INST } from "../../tasks/update_file";
import { READ_FILE_INST } from "../../tasks/read_file";
import { runBackground, runCmd } from "../../utils/proc";

const SYSTEM_MSG = [
  // intro
  "You are a professional TypeScript and React programmer. You task is to update an existing website based on the provided description.",
  // short files
  "Whatever files you create/update, make sure they are as small as possible. It's better to have multiple small files than a single large file.",
  UPDATE_FILE_INST,
  READ_FILE_INST,
  NPM_INSTALL_INST,
  NPM_INSTALL_DEV_INST,
  // PROVIDE_SCREENSHOT to ask for a screenshot
  "At any time you can ask for a screenshot: write [provide-screenshot].",
  // Be concise
  "Please be consise, and don't explain anything until asked by a user.",
  // Good practices
  "Consider the following good practices: files should be small, components should be reusable, the code should be clean and easy to understand. In CSS, use CSS variables. Use css variables (--u1, --u2, and so on) for length units.",
  // Code blocks
  "Don't forget to use ``` for code blocks.",
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
  [NPM_INSTALL_CMD]: NPM_INSTALL_PACKAGE,
  [NPM_INSTALL_DEV_CMD]: NPM_INSTALL_DEV_PACKAGE,
  [TS_CHECK_TYPES_CMD]: TS_CHECK_TYPES,
};

function startApplication(rootPath: string, dirName: string, port: number) {
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
  system: SYSTEM_MSG,
  scaffold: scaffold,
  taskDefs: TASK_DEFS,
  startApplication,
};

export default t;
