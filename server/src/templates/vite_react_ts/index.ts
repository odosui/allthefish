import fs from "fs/promises";
import path from "path";
import { runCmd } from "../../helpers";

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
