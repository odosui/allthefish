import express from "express";
import { v4 } from "uuid";
import ws from "ws";
import { WsInputMessage, WsOutputMessage } from "../../shared/types";
import ConfigFile, { IConfigFile } from "./config_file";
import { ProjectWorker, TemplateName, WorkerTask } from "./project_worker";
import { addRestRoutes as registerRoutes } from "./rest";
import {
  autoPilotOff,
  chatError,
  forcedMessage,
  partialReply,
  taskFinished,
  taskStarted,
} from "./utils/messages";
import { AnthropicChat } from "../../../multichatai/server/src/vendors/anthropic";
import { OpenAiChat } from "../../../multichatai/server/src/vendors/openai";
import { log } from "./utils/logger";
import { asString } from "./utils/ws";
import { listFiles } from "./utils/files";
import { NPM_INSTALL_CMD } from "./tasks/npm_install";

const PORT = process.env.PORT || 3000;

type Project = {
  id: string;
  name: string;
  dirname: string;
  port: number;
  template: TemplateName;
};

export const PROJECTS: Record<string, Project> = {
  babuli: {
    id: "babuli",
    name: "babuli",
    dirname: "babuli",
    template: "vite:react-ts",
    port: 3010,
  },
  candl: {
    id: "candl",
    name: "candl",
    dirname: "candl/candl-app",
    template: "rails",
    port: 3003,
  },
  mytest: {
    id: "mytest",
    name: "mytest",
    dirname: "mytest",
    template: "vite:react-ts",
    port: 3001,
  },
};

export const CHAT_STORE: Record<
  string,
  {
    profile: string;
    chat: OpenAiChat | AnthropicChat;
    worker: ProjectWorker;
    proectId: string;
  }
> = {};

async function main() {
  const config: IConfigFile | null = await ConfigFile.readConfig();

  const app = express();
  registerRoutes(app, config);

  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // Set up WebSocket server
  const wsServer = new ws.Server({ server });

  const wsConnections: Map<string, ws> = new Map();

  wsServer.on("connection", (ws) => {
    // register connection
    const conId = v4();
    wsConnections.set(conId, ws);
    log("root", "New connection", { conId });

    // deregister connection
    ws.on("close", () => {
      log("root", "Connection closed", { conId });
      wsConnections.delete(conId);
    });

    ws.on("message", handleMessageReceived);

    function sendAll(msg: WsOutputMessage) {
      wsConnections.forEach((c) => {
        c.send(JSON.stringify(msg));
      });
    }

    const handleReplyFinish = async (cid: string, content: string) => {
      console.log("reply", content);

      // RUNNING TASKS
      const c = CHAT_STORE[cid];
      if (!c) {
        log("root", "Error: Chat not found", { chatId: cid });
        return;
      }

      const runAllTasks = async (tasks: WorkerTask[]) => {
        console.log("running tasks", tasks);
        for await (const task of tasks) {
          const tid = v4();
          sendAll(taskStarted(cid, c.worker.taskTitle(task), tid));
          await c.worker.runTask(task);
          sendAll(taskFinished(cid, tid));
        }
      };

      const tasks = c.worker.parseTasks(content);

      console.log("tasks to run", tasks);

      // TODO: we need to implement priority
      const installTasks = tasks.filter((t) => t.type === NPM_INSTALL_CMD);
      await runAllTasks(installTasks);

      const otherTasks = tasks.filter((t) => t.type !== NPM_INSTALL_CMD);
      await runAllTasks(otherTasks);

      // ####################
      // THE MAGNIFICENT LOOP
      // ####################

      const lTasks = c.worker.loopTasks();
      for await (const task of lTasks) {
        const tid = v4();
        sendAll(taskStarted(cid, c.worker.taskTitle(task), tid));
        const [success, resultMsg] = await c.worker.runTask(task);
        sendAll(taskFinished(cid, tid));
        if (!success && resultMsg) {
          log("root", "Error: Loop task failed", { task, cid });
          c.chat.postMessage(resultMsg);
          sendAll(forcedMessage(cid, resultMsg));
          return;
        }
        if (!success) {
          log("root", "Error: Loop task failed", { task, cid });
          c.chat.postMessage("Task failed");
          sendAll(forcedMessage(cid, "Task failed"));
          return;
        }

        if (success && resultMsg) {
          c.chat.postMessage(resultMsg);
          sendAll(forcedMessage(cid, resultMsg));
          return;
        }
      }

      sendAll(autoPilotOff(cid));
    };

    async function handleMessageReceived(message: ws.RawData) {
      const messageStr = asString(message);

      if (messageStr === null) {
        log("root", "Error: Received message is not a string");
        return;
      }

      const data = JSON.parse(messageStr) as WsInputMessage;

      if (data.type === "START_CHAT") {
        const p = config?.profiles[data.profile];

        if (!p) {
          log("root", "Error: Profile not found", { profile: data.profile });
          return;
        }

        const project = PROJECTS[data.projectId];

        if (!project) {
          log("root", "Error: Project not found", {
            projectId: data.projectId,
          });
          return;
        }

        const id = v4();
        const worker = new ProjectWorker(
          config.projects_dir,
          project.dirname,
          project.port,
          project.template,
        );

        // const createRes = await worker.createProject();

        // if (createRes === "EXISTS") {
        //   log("root", "Error: Project already exists", {
        //     dir: config.projects_dir,
        //   });
        //   return;
        // }

        worker.startApplication();

        if (p.vendor !== "openai" && p.vendor !== "anthropic") {
          log("root", "Error: Vendor not supported", { vendor: p.vendor });
          return;
        }

        const ChatEngine = p.vendor === "openai" ? OpenAiChat : AnthropicChat;
        const apiKey =
          p.vendor === "openai" ? config.openai_key : config.anthropic_key;

        const system = worker.getSystemMessage();

        // read the files in the project directory
        const files = await listFiles(config.projects_dir, project.dirname, [
          ".git",
          ".DS_Store",
          "node_modules",
        ]);

        const systemWithFiles = `${system}\n\nFiles in the project:\n${files.join(", ")}`;
        log("root", "Starting chat", { system: systemWithFiles });

        // initialize the chat engine
        const chat = new ChatEngine(apiKey, p.model, system);
        CHAT_STORE[id] = {
          profile: data.profile,
          chat,
          worker,
          proectId: data.projectId,
        };

        chat.onPartialReply((m) => sendAll(partialReply(m, id)));
        chat.onReplyFinish((msg) => handleReplyFinish(id, msg));
        chat.onError((err) => sendAll(chatError(id, err)));

        const msg: WsOutputMessage = {
          type: "CHAT_STARTED",
          name: data.profile,
          serverUrl: worker.serverUrl(),
          id,
        };

        log("root", "Chat started", { id, profile: data.profile });
        ws.send(JSON.stringify(msg));

        return;
      } else if (data.type === "POST_MESSAGE") {
        const c = CHAT_STORE[data.chatId];

        if (!c) {
          log("root", "Error: Chat not found", { chatId: data.chatId });
          return;
        }

        c.chat.postMessage(data.content, data.image);
        return;
      } else {
        log("root", "Error: Received message is not a valid type", { data });
        return;
      }
    }
  });
}

main();
