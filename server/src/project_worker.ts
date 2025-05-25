import { ChildProcess } from "child_process";
import path from "path";
import { log } from "./helpers";
import { TaskContext, TaskDef } from "./tasks/common_tasks";
import { READ_FILE } from "./tasks/read_file";
import { UPDATE_FILE } from "./tasks/update_file";
import rails from "./templates/rails";
import { Template } from "./templates/template";
import viteReactTs from "./templates/vite_react_ts";
import { isDirExists } from "./utils/files";
import { initGit } from "./utils/git";

export type TemplateName = "vite:react-ts" | "rails";

// templates should be registered here
const TEMPLATES: Record<TemplateName, Template> = {
  "vite:react-ts": viteReactTs,
  rails: rails,
};

const ACTOR = "projworker";

const COMMON_TASK_DEFS: Record<string, TaskDef> = {
  UPDATE_FILE,
  READ_FILE,
};

export type WorkerTask = {
  type: string;
  args: string[];
};

export class ProjectWorker {
  private rootPath = "";
  private dirName = "";
  private port = 0;
  private template: TemplateName;
  protected serverProcess: ChildProcess | null = null;

  constructor(
    rootPath: string,
    dirName: string,
    port: number,
    template: TemplateName,
  ) {
    log(ACTOR, "Creating project worker", {
      rootPath,
      dirName,
      port,
      template,
    });
    this.rootPath = rootPath;
    this.dirName = dirName;
    this.port = port;
    this.template = template;
  }

  allTaskDefs() {
    const defs = TEMPLATES[this.template].taskDefs;
    return { ...COMMON_TASK_DEFS, ...defs };
  }

  async runTask(task: WorkerTask): Promise<[boolean, string | null]> {
    const def = this.allTaskDefs()[task.type];
    if (!def) {
      log(ACTOR, "Error: Unknown task type", { task });
      return [false, "Unknown task type"];
    }
    const ctx: TaskContext = { rootPath: this.rootPath, dirName: this.dirName };
    return await def.run(ctx, task);
  }

  startApplication() {
    log(
      ACTOR,
      [
        "Starting the project in the background...",
        this.rootPath,
        this.dirName,
        this.port,
      ].join(", "),
    );
    this.serverProcess = TEMPLATES[this.template].startApplication(
      this.rootPath,
      this.dirName,
      this.port,
    );
  }

  async createProject(): Promise<"OK" | "EXISTS" | "UNKNOWN_TEMPLATE"> {
    const rootPath = this.rootPath;
    const dirName = this.dirName;
    const dir = path.join(rootPath, dirName);

    log(ACTOR, "Creating project new project at", { dir });

    const isExists = await isDirExists(dir);

    if (isExists) {
      log(ACTOR, "Error: Project already exists", { dir });
      return "EXISTS";
    }

    const scaffold = TEMPLATES[this.template].scaffold;
    log(ACTOR, "Creating project using template", { template: this.template });
    await scaffold(rootPath, dirName);
    await initGit(dir);
    return "OK";
  }

  serverUrl() {
    return `http://localhost:${this.port}`;
  }

  loopTasks() {
    const defs = this.allTaskDefs();

    return Object.keys(defs)
      .filter((k) => defs[k]?.isLoop)
      .map((k) => {
        return { type: k, args: [] };
      });
  }

  getSystemMessage() {
    return TEMPLATES[this.template].system;
  }

  parseTasks(message: string): WorkerTask[] {
    const defs = this.allTaskDefs();
    const out: WorkerTask[] = [];

    Object.values(defs).forEach((def) => {
      out.push(...def.extract(message));
    });

    return out;
  }

  taskTitle(task: WorkerTask): string {
    const defs = this.allTaskDefs();

    const def = defs[task.type];
    if (!def) {
      return "Unknown task";
    }
    return def.title(task);
  }
}
