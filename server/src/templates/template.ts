import { ChildProcess } from "node:child_process";
import { TaskDef } from "../tasks/common_tasks";

export type Template = {
  system: string;
  scaffold: (rootPath: string) => Promise<void>;
  taskDefs: Record<string, TaskDef>;
  startApplication: (rootPath: string, port: number) => ChildProcess;
};
