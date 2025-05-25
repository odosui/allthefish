// Tasks that are common
// to multiple languages / frameworks

import { WorkerTask } from "../project_worker";

export type TaskContext = {
  rootPath: string;
  dirName: string;
};

export type TaskDef = {
  extract: (line: string) => WorkerTask[];
  run: (
    ctx: TaskContext,
    task: WorkerTask,
  ) => Promise<[true, null] | [false, string]>;
  title: (task: WorkerTask) => string;
  isExposedToAi: boolean;
  isLoop: boolean;
};
