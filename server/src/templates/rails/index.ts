import path from "path";
import { runBackground } from "../../helpers";
import { Template } from "../template";
import { TaskDef } from "../../tasks/common_tasks";
import { UPDATE_FILE_INST } from "../../tasks/update_file";

const SYSTEM = [
  "You are a professional Ruby On Rails developer. Your task is to work on a Rails project based on provided description.",
  "Please be consise, and don't explain anything until directly asked by user.",
  UPDATE_FILE_INST,
].join("\n");

async function scaffold(_rootPath: string, _dirName: string) {
  // NOT IMPLEMENTED
}

const TASK_DEFS: Record<string, TaskDef> = {};

function startApplication(rootPath: string, dirName: string, _port: number) {
  const dir = path.join(rootPath, dirName);
  return runBackground(dir, "bin/dev", []);
}

const t: Template = {
  system: SYSTEM,
  scaffold: scaffold,
  taskDefs: TASK_DEFS,
  startApplication,
};

export default t;
