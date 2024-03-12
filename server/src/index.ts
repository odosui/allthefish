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
import { AnthropicChat } from "./vendors/anthropic";
import { OpenAiChat } from "./vendors/openai";
import {
  chatError,
  forcedMessage,
  partialReply,
  replyFinished,
  taskFinished,
  taskStarted,
} from "./utils/messages";

const SYSTEM = [
  "You are a professional TypeScript and React programmer. You task is to build a website based on provided description.",
  "At any time you can ask to update a specific file. Write UPDATE_FILE <path_of_the_file_to_update>, followed by code. Make sure you start with a new line. Make sure to provide the full file contents including the parts that are not changed.",
  "At any time you can ask to install an npm module: write INSTALL_PACKAGE <name>. Make sure you start with a new line.",
  "At any time you can ask for a screenshot: write PROVIDE_SCREENSHOT.",
  "Please be consise, and don't explain anything until asked by a user.",
  "Consider the following good practices: files should be small, components should be reusable, the code should be clean and easy to understand. In CSS, use CSS variables. Use css variables (--u1, --u2, and so on) for length units.",
  "You start at `src/App.tsx`.",
].join("\n");

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

  const wsConnections: Map<string, ws> = new Map();

  const app = express();

  addRestRoutes(app, config);

  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // Set up WebSocket server
  const wsServer = new ws.Server({ server });

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
      sendAll(replyFinished(cid));

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
      const task: WorkerTask = { type: "CHECK_TYPES" };
      sendAll(taskStarted(cid, taskTitle(task), tid));
      const { code, stdout, stderr } = await c.worker.checkTypes();
      sendAll(taskFinished(cid, tid));

      if (code !== 0) {
        const msg = `Typescript checking failed with code ${code}. \n\n Stdout: \n\n \`\`\`\n${stdout}\n\`\`\`\n\n Stderr: \n\n \`\`\`\n${stderr}\n\`\`\``;
        c.chat.postMessage(msg);
        sendAll(forcedMessage(cid, msg));
      } else {
        const msg = "Typescript checking passed.";
        c.chat.postMessage(msg);
        sendAll(forcedMessage(cid, msg));
      }
      // ==============
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

        const chat = new ChatEngine(config.openai_key, p.model, SYSTEM);
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
