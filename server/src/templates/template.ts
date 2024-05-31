import { ChildProcess } from "node:child_process";
import { TaskDef } from "../project_worker";

export type Template = {
  system: string;
  scaffold: (rootPath: string, dirName: string) => Promise<void>;
  taskDefs: Record<string, TaskDef>;
  startServer: (
    rootPath: string,
    dirName: string,
    port: number
  ) => ChildProcess;
};
