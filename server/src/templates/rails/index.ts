import path from "path";
import { runBackground } from "../../helpers";
import { TaskDef } from "../common_tasks";
import { Template } from "../template";

const SYSTEM = [
  "You are a professional Ruby On Rails developer. Your task is to work on a Rails project based on provided description.",
  "At any time you can ask to update a specific file. Write UPDATE_FILE <path_of_the_file_to_update>, followed by code. Make sure you start with a new line. Make sure to provide the full file contents including the parts that are not changed.",
  "Please be consise, and don't explain anything until directly asked by user.",
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
