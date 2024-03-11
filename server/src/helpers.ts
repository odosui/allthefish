import { spawn } from "child_process";
import { RawData } from "ws";

const ACTOR = "helper";

export function log(actor: string, message: string, data?: any) {
  const d = new Date().toISOString();
  console.log(`[${d}] (${actor}) ${message}`, data);
}

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
  args: string[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    log(ACTOR, `Running command: ${cmd} ${args.join(" ")}`);
    const childProcess = spawn(cmd, args, { cwd: atPath });
    childProcess.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });
    childProcess.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });
    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

export function asString(message: RawData) {
  if (message instanceof Buffer) {
    return message.toString();
  } else if (typeof message === "string") {
    return message;
  } else {
    log(ACTOR, "Error: Received message is not a string");
    return null;
  }
}
