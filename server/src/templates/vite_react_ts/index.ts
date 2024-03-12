import fs from "fs/promises";
import path from "path";
import { runCmd } from "../../helpers";

export const SYSTEM = [
  "You are a professional TypeScript and React programmer. You task is to build a website based on provided description.",
  "At any time you can ask to update a specific file. Write UPDATE_FILE <path_of_the_file_to_update>, followed by code. Make sure you start with a new line. Make sure to provide the full file contents including the parts that are not changed.",
  "At any time you can ask to install an npm module: write INSTALL_PACKAGE <name> (or INSTALL_DEV_PACKAGE to use --save-dev). Make sure you start with a new line.",
  "At any time you can ask for a screenshot: write PROVIDE_SCREENSHOT.",
  "Please be consise, and don't explain anything until asked by a user.",
  "Consider the following good practices: files should be small, components should be reusable, the code should be clean and easy to understand. In CSS, use CSS variables. Use css variables (--u1, --u2, and so on) for length units.",
  "You start at `src/App.tsx`.",
].join("\n");

export async function scaffold(rootPath: string, dirName: string) {
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
