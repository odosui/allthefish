import { runCmd } from "./proc";

export async function initGit(dir: string) {
  await runCmd(dir, "git", [
    "config",
    "--global",
    "init.defaultBranch",
    "main",
  ]);
  await runCmd(dir, "git", ["init", dir]);
  await runCmd(dir, "git", ["add", "."]);
  await runCmd(dir, "git", ["commit", "-m", "Initial commit"]);
}
