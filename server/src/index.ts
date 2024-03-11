import express from "express";
import ws from "ws";
import ConfigFile from "./config_file";
import { WsInputMessage, WsOutputMessage } from "../../shared/types";
import { v4 } from "uuid";
import { OpenAiChat } from "./vendors/openai";
import { AnthropicChat } from "./vendors/anthropic";
import { asString, log } from "./helpers";
import { ProjectWorker, parseTasks, taskTitle } from "./project_worker";

const SYSTEM = [
  "You are a professional TypeScript and React programmer. You task is to build a website based on provided description.",
  "At any time you can ask to update a specific file. Write UPDATE_FILE: <path_of_the_file_to_update>, followed by code. Make sure you start with a new line. Make sure to provide the full file contents including the parts that are not changed.",
  "At any time you can ask to install an npm module: write INSTALL_PACKAGE <name>. Make sure you start with a new line.",
  "At any time you can ask for a screenshot: write PROVIDE_SCREENSHOT.",
  "Please be consise, and don't explain anything until asked by a user.",
  "Consider the following good practices: files should be small, components should be reusable, the code should be clean and easy to understand. In CSS, use CSS variables. Use css variables (--u1, --u2, and so on) for length units.",
  "You start at `src/App.tsx`.",
].join("\n");

const PORT = process.env.PORT || 3000;

async function main() {
  const config: ConfigFile | null = await ConfigFile.readConfig();

  const app = express();

  // allow CORS
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:5173");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // Serve static files or APIs
  app.get("/", (_req, res) => {
    res.json({ status: "OK" });
  });

  app.get("/api/profiles", async (_req, res) => {
    try {
      const profiles = Object.keys(config?.profiles || {}).map((name) => ({
        name,
        vendor: config?.profiles[name].vendor,
        model: config?.profiles[name].model,
      }));
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  const chats: Record<
    string,
    {
      profile: string;
      chat: OpenAiChat | AnthropicChat;
      worker: ProjectWorker;
    }
  > = {};

  // Set up WebSocket server
  const wsServer = new ws.Server({ server });

  wsServer.on("connection", (ws) => {
    log("root", "New connection");

    const handlePartialReply = (msg: string, id: string) => {
      const msgObj: WsOutputMessage = {
        chatId: id,
        content: msg,
        type: "CHAT_PARTIAL_REPLY",
      };
      ws.send(JSON.stringify(msgObj));
    };

    const handleChatError = (id: string, error: string) => {
      const msg: WsOutputMessage = {
        chatId: id,
        type: "CHAT_ERROR",
        error,
      };
      ws.send(JSON.stringify(msg));
    };

    ws.on("message", async (message) => {
      const messageStr = asString(message);

      if (messageStr === null) {
        return;
      }

      const data = JSON.parse(messageStr) as WsInputMessage;

      const handleReplyFinish = async (cid: string, content: string) => {
        const msg: WsOutputMessage = {
          chatId: cid,
          type: "CHAT_REPLY_FINISH",
        };
        ws.send(JSON.stringify(msg));

        // let's update files
        const c = chats[cid];
        if (!c) {
          log("root", "Error: Chat not found", { chatId: cid });
          return;
        }

        const tasks = parseTasks(content);

        const installTasks = tasks.filter((t) => t.type === "INSTALL_PACKAGE");

        for await (const task of installTasks) {
          const taskId = v4();
          const msg: WsOutputMessage = {
            chatId: cid,
            type: "WORKER_TASK_STARTED",
            title: taskTitle(task),
            id: taskId,
          };
          ws.send(JSON.stringify(msg));

          await c.worker.runTask(task);

          const msg2: WsOutputMessage = {
            chatId: cid,
            type: "WORKER_TASK_FINISHED",
            id: taskId,
          };
          ws.send(JSON.stringify(msg2));
        }

        const otherTasks = tasks.filter((t) => t.type !== "INSTALL_PACKAGE");
        for await (const task of otherTasks) {
          const taskId = v4();
          const msg: WsOutputMessage = {
            chatId: cid,
            type: "WORKER_TASK_STARTED",
            title: taskTitle(task),
            id: taskId,
          };
          ws.send(JSON.stringify(msg));

          await c.worker.runTask(task);

          const msg2: WsOutputMessage = {
            chatId: cid,
            type: "WORKER_TASK_FINISHED",
            id: taskId,
          };
          ws.send(JSON.stringify(msg2));
        }
      };

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

        if (p.vendor === "openai") {
          const chat = new OpenAiChat(config.openai_key, p.model, SYSTEM);
          chats[id] = {
            profile: data.profile,
            chat,
            worker,
          };

          chat.onPartialReply((m) => handlePartialReply(m, id));
          chat.onReplyFinish((msg) => handleReplyFinish(id, msg));
        } else if (p.vendor === "anthropic") {
          const chat = new AnthropicChat(config.anthropic_key, p.model, SYSTEM);
          chats[id] = {
            profile: data.profile,
            chat,
            worker,
          };

          chat.onPartialReply((m) => handlePartialReply(m, id));
          chat.onReplyFinish((msg) => handleReplyFinish(id, msg));
          chat.onError((err) => handleChatError(id, err));
        } else {
          log("root", "Error: Vendor not supported", { vendor: p.vendor });
          return;
        }

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
        const c = chats[data.chatId];

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
    });
  });
}

main();
