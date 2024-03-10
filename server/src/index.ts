import express from "express";
import ws from "ws";
import ConfigFile from "./config_file";
import { WsInputMessage, WsOutputMessage } from "../../shared/types";
import { v4 } from "uuid";
import { OpenAiChat } from "./vendors/openai";
import { AnthropicChat } from "./vendors/anthropic";

const SYSTEM = [
  "You are a professional TypeScript and React programmer. You task is to build a website based on provided description.",
  "At any time you can ask to update a specific file. Write UPDATE_FILE: <path_of_the_file_to_update>, followed by code.",
  "At any time you can ask to install an npm module: write INSTALL_PACKAGE <name>.",
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
    { profile: string; messages: []; chat: OpenAiChat | AnthropicChat }
  > = {};

  // Set up WebSocket server
  const wsServer = new ws.Server({ server });

  wsServer.on("connection", (ws) => {
    log("New connection");

    const handlePartialReply = (msg: string, id: string) => {
      const msgObj: WsOutputMessage = {
        chatId: id,
        content: msg,
        type: "CHAT_PARTIAL_REPLY",
      };
      ws.send(JSON.stringify(msgObj));
    };

    const handleReplyFinish = (id: string) => {
      const msg: WsOutputMessage = {
        chatId: id,
        type: "CHAT_REPLY_FINISH",
      };
      ws.send(JSON.stringify(msg));
    };

    const handleChatError = (id: string, error: string) => {
      const msg: WsOutputMessage = {
        chatId: id,
        type: "CHAT_ERROR",
        error,
      };
      ws.send(JSON.stringify(msg));
    };

    ws.on("message", (message) => {
      const messageStr = asString(message);

      if (messageStr === null) {
        return;
      }

      const data = JSON.parse(messageStr) as WsInputMessage;

      if (data.type === "START_CHAT") {
        const p = config?.profiles[data.profile];

        if (!p) {
          log("Error: Profile not found", { profile: data.profile });
          return;
        }

        const id = v4();

        if (p.vendor === "openai") {
          const chat = new OpenAiChat(config.openai_key, p.model, p.system);
          chats[id] = {
            profile: data.profile,
            messages: [],
            chat,
          };

          chat.onPartialReply((m) => handlePartialReply(m, id));
          chat.onReplyFinish(() => handleReplyFinish(id));
        } else if (p.vendor === "anthropic") {
          const chat = new AnthropicChat(
            config.anthropic_key,
            p.model,
            p.system
          );
          chats[id] = {
            profile: data.profile,
            messages: [],
            chat,
          };

          chat.onPartialReply((m) => handlePartialReply(m, id));
          chat.onReplyFinish(() => handleReplyFinish(id));
          chat.onError((err) => handleChatError(id, err));
        } else {
          log("Error: Vendor not supported", { vendor: p.vendor });
          return;
        }

        const msg: WsOutputMessage = {
          type: "CHAT_STARTED",
          name: data.profile,
          id,
        };

        log("Chat started", { id, profile: data.profile });
        ws.send(JSON.stringify(msg));
        return;
      } else if (data.type === "POST_MESSAGE") {
        const c = chats[data.chatId];

        if (!c) {
          log("Error: Chat not found", { chatId: data.chatId });
          return;
        }

        c.chat.postMessage(data.content, data.image);
        return;
      } else {
        log("Error: Received message is not a valid type", { data });
        return;
      }
    });
  });
}

main();

function log(message: string, data?: any) {
  console.log(`[${new Date().toISOString()}] ${message}`, data);
}

function asString(message: ws.RawData) {
  if (message instanceof Buffer) {
    return message.toString();
  } else if (typeof message === "string") {
    return message;
  } else {
    log("Error: Received message is not a string");
    return null;
  }
}
