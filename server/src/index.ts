import express from "express";
import { v4 } from "uuid";
import ws from "ws";
import { AnthropicChat } from "../../../multichatai/server/src/vendors/anthropic";
import { OpenAiChat } from "../../../multichatai/server/src/vendors/openai";
import { WsInputMessage, WsOutputMessage } from "../../shared/types";
import { readLocalConfig } from "./config_file";
import { ProjectWorker, TemplateName, WorkerTask } from "./project_worker";
import { addRestRoutes as registerRoutes } from "./rest";
import { TaskResult } from "./tasks/common_tasks";
import { NPM_INSTALL_CMD } from "./tasks/npm_install";
import { listFiles } from "./utils/files";
import { log } from "./utils/logger";
import {
  autoPilotOff,
  chatError,
  forcedMessage,
  partialReply,
  taskFinished,
  taskStarted,
} from "./utils/messages";
import { asString } from "./utils/ws";
import { MODELS } from "./models";

const PORT = process.env.PORT || 3000;

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
  // read cms arguments
  const args = process.argv.slice(2);
  console.log("Running with args", args);

  const atPath = args.find((arg) => arg.startsWith("--at="));

  if (!atPath) {
    console.error("Error: --at=path argument is required");
    process.exit(1);
  }

  const path = atPath.split("=")[1];
  if (!path) {
    console.error("Error: --at=path argument is malformed");
    process.exit(1);
  }

  const localConf = await readLocalConfig(path);
  if (!localConf) {
    console.error(`Error: Could not read local config at ${path}`);
    process.exit(1);
  }

  const app = express();
  registerRoutes(app, {
    port: localConf.port,
  });

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
        const results: TaskResult[] = [];
        for await (const task of tasks) {
          const tid = v4();
          sendAll(taskStarted(cid, c.worker.taskTitle(task), tid));
          const res = await c.worker.runTask(task);
          results.push(res);
          sendAll(taskFinished(cid, tid));
        }
        return results;
      };

      const tasks = c.worker.parseTasks(content);

      console.log("tasks to run", tasks);

      // TODO: we need to implement priority
      const installTasks = tasks.filter((t) => t.type === NPM_INSTALL_CMD);
      await runAllTasks(installTasks);

      const otherTasks = tasks.filter((t) => t.type !== NPM_INSTALL_CMD);
      const results = await runAllTasks(otherTasks);

      console.log("results", results);

      const successWithMessage = results.filter(
        (r) => r.success && !!r.messageToAgent,
      );

      if (successWithMessage.length > 0) {
        console.log("successWithMessage", successWithMessage);
        const msgsToAgent = successWithMessage
          .map((r) => r.messageToAgent)
          .join("\n\n");
        c.chat.postMessage(msgsToAgent);
        sendAll(forcedMessage(cid, msgsToAgent));
        return;
      }

      // ####################
      // THE MAGNIFICENT LOOP
      // ####################

      const lTasks = c.worker.loopTasks();
      for await (const task of lTasks) {
        const tid = v4();
        sendAll(taskStarted(cid, c.worker.taskTitle(task), tid));
        const { success, messageToAgent } = await c.worker.runTask(task);
        sendAll(taskFinished(cid, tid));
        if (!success && messageToAgent) {
          log("root", "Error: Loop task failed", { task, cid });
          c.chat.postMessage(messageToAgent);
          sendAll(forcedMessage(cid, messageToAgent));
          return;
        }
        if (!success) {
          log("root", "Error: Loop task failed", { task, cid });
          c.chat.postMessage("Task failed");
          sendAll(forcedMessage(cid, "Task failed"));
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
        const p = MODELS[data.profile];

        if (!p) {
          log("root", "Error: Profile not found", { profile: data.profile });
          return;
        }

        const id = v4();

        if (!path) {
          log("root", "Error: Path is not defined");
          return;
        }

        const worker = new ProjectWorker(
          path,
          localConf?.port ?? 0,
          localConf?.template as TemplateName,
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

        const openaiKey = process.env.OPENAI_API_KEY;
        const anrhropicKey = process.env.ANTHROPIC_API_KEY;

        const ChatEngine = p.vendor === "openai" ? OpenAiChat : AnthropicChat;
        const apiKey = p.vendor === "openai" ? openaiKey : anrhropicKey;

        if (!apiKey) {
          log("root", "Error: API key is not found", { vendor: p.vendor });
          return;
        }

        const system = worker.getSystemMessage();

        // read the files in the project directory
        const files = await listFiles(path, [
          ".*node_modules.*",
          ".*log.*",
          ".*tmp.*",
          "\.svg$",
          "\.png$",
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
