import { TaskDef } from "../../tasks/common_tasks";
import { READ_FILE_INST } from "../../tasks/read_file";
import { UPDATE_FILE_INST } from "../../tasks/update_file";
import { runBackground } from "../../utils/proc";
import { Template } from "../template";

const SYSTEM = [
  "You are a professional Ruby On Rails developer. You are also exceptional in Typescript and react. Your task is to work on a Rails project based on provided description.",
  "Please be consise, and don't explain anything until directly asked by user.",
  READ_FILE_INST,
  UPDATE_FILE_INST,
].join("\n");

async function scaffold(_rootPath: string) {
  // NOT IMPLEMENTED
}

const TASK_DEFS: Record<string, TaskDef> = {};

function startApplication(rootPath: string, _port: number) {
  return runBackground(rootPath, "bin/dev", []);
}

const t: Template = {
  system: SYSTEM,
  scaffold: scaffold,
  taskDefs: TASK_DEFS,
  startApplication,
};

export default t;
