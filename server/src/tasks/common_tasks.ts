// Tasks that are common
// to multiple languages / frameworks

import { WorkerTask } from "../project_worker";

export type TaskContext = {
  rootPath: string;
};

export type TaskResult = {
  success: boolean;
  messageToAgent: string | null;
};

export type TaskDef = {
  extract: (line: string) => WorkerTask[];
  run: (ctx: TaskContext, task: WorkerTask) => Promise<TaskResult>;
  title: (task: WorkerTask) => string;
  isExposedToAi: boolean;
  isLoop: boolean;
};
