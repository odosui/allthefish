import express from "express";
import { v4 } from "uuid";
import ws from "ws";
import { WsInputMessage, WsOutputMessage } from "../../shared/types";
import ConfigFile, { IConfigFile } from "./config_file";
import { asString, log } from "./helpers";
import {
  ProjectWorker,
  WorkerTask,
  parseTasks,
  taskTitle,
} from "./project_worker";
import { addRestRoutes } from "./rest";
import { SYSTEM } from "./templates/vite_react_ts";
import {
  autoPilotOff,
  chatError,
  forcedMessage,
  partialReply,
  taskFinished,
  taskStarted,
} from "./utils/messages";
import { AnthropicChat } from "./vendors/anthropic";
import { OpenAiChat } from "./vendors/openai";

const PORT = process.env.PORT || 3000;

export const CHAT_STORE: Record<
  string,
  {
    profile: string;
    chat: OpenAiChat | AnthropicChat;
    worker: ProjectWorker;
  }
> = {};

async function main() {
  const config: IConfigFile | null = await ConfigFile.readConfig();

  const app = express();
  addRestRoutes(app, config);

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
      // RUNNING TASKS
      const c = CHAT_STORE[cid];
      if (!c) {
        log("root", "Error: Chat not found", { chatId: cid });
        return;
      }

      const runAllTasks = async (tasks: WorkerTask[]) => {
        for await (const task of tasks) {
          const tid = v4();
          sendAll(taskStarted(cid, taskTitle(task), tid));
          await c.worker.runTask(task);
          sendAll(taskFinished(cid, tid));
        }
      };

      const tasks = parseTasks(content);

      const installTasks = tasks.filter((t) => t.type === "INSTALL_PACKAGE");
      await runAllTasks(installTasks);

      const otherTasks = tasks.filter((t) => t.type !== "INSTALL_PACKAGE");
      await runAllTasks(otherTasks);

      // #############
      // THE MAGNIFICENT LOOP
      // #############

      // ==============
      // run types
      // ==============
      const tid = v4();
      const task: WorkerTask = { type: "CHECK_TYPES", args: [] };
      sendAll(taskStarted(cid, taskTitle(task), tid));
      const [success, error] = await c.worker.runTask(task);
      sendAll(taskFinished(cid, tid));
      if (!success) {
        c.chat.postMessage(error);
        sendAll(forcedMessage(cid, error));
      }
      log("root", "Typescript checking passed", { cid });
      // ==============

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

        const id = v4();
        const worker = new ProjectWorker(config.projects_dir, data.dir, 3001);

        const createRes = await worker.createProject();

        if (createRes === "EXISTS") {
          log("root", "Error: Project already exists", {
            dir: config.projects_dir,
          });
          return;
        }

        worker.startServer();

        if (p.vendor !== "openai" && p.vendor !== "anthropic") {
          log("root", "Error: Vendor not supported", { vendor: p.vendor });
          return;
        }

        const ChatEngine = p.vendor === "openai" ? OpenAiChat : AnthropicChat;
        const apiKey =
          p.vendor === "openai" ? config.openai_key : config.anthropic_key;

        const chat = new ChatEngine(apiKey, p.model, SYSTEM);
        CHAT_STORE[id] = {
          profile: data.profile,
          chat,
          worker,
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
