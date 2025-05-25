import { spawn } from "child_process";
import { log } from "./logger";

const ACTOR = "utils/proc";

export function runBackground(atPath: string, cmd: string, args: string[]) {
  log(ACTOR, `Running command: ${cmd} ${args.join(" ")}`);
  const childProcess = spawn(cmd, args, {
    cwd: atPath,
    stdio: "ignore",
    // detached: true,
  });
  childProcess
    .on("error", (err) => {
      log(ACTOR, "Background task error: ", err);
    })
    .on("close", (code) => {
      log(ACTOR, "Background task closed with code: ", code);
    });
  childProcess.stdout?.on("data", (data) => {
    console.log(`stdout: ${data}`);
  });
  childProcess.stderr?.on("data", (data) => {
    console.error(`stderr: ${data}`);
  });
  return childProcess;
}

export async function runCmd(
  atPath: string,
  cmd: string,
  args: string[],
): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    log(ACTOR, `Running command: ${cmd} ${args.join(" ")}`);
    const childProcess = spawn(cmd, args, { cwd: atPath });

    let stdout = "";
    let stderr = "";

    childProcess.stdout.on("data", (data) => {
      stdout += data;
    });
    childProcess.stderr.on("data", (data) => {
      stderr += data;
    });
    childProcess.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}
