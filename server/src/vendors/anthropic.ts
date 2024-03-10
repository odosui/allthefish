import Anthropic from "@anthropic-ai/sdk";
import { MessageParam } from "@anthropic-ai/sdk/resources";

const MAX_TOKENS = 1024;

function user(
  content: string,
  file?: {
    data: string;
    type: string;
  }
): MessageParam {
  if (!file) {
    return {
      role: "user",
      content,
    };
  }

  return {
    role: "user",
    content: [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: file.type as "image/png" | "image/jpeg",
          data: file.data,
        },
      },
      {
        type: "text",
        text: content,
      },
    ],
  };
}

function assistant(content: string): MessageParam {
  return {
    role: "assistant",
    content,
  };
}

export class AnthropicChat {
  private model: string;
  private client: Anthropic;
  private messages: MessageParam[] = [];
  private system: string;

  private listeners: ((msg: string) => void)[] = [];
  private finishListeners: (() => void)[] = [];
  private errorListeners: ((err: string) => void)[] = [];

  constructor(apiKey: string, model: string, systemMsg: string) {
    this.model = model;
    this.system = systemMsg;

    this.client = new Anthropic({
      apiKey,
    });
  }

  async postMessage(input: string, file?: { data: string; type: string }) {
    this.messages.push(user(input, file));
    let msg = "";

    this.client.messages
      .stream({
        messages: this.messages,
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: this.system,
      })
      .on("text", (p) => {
        // collect regular message
        if (p) {
          this.listeners.forEach((listener) => listener(p));
          msg += p;
        }
      })
      .on("end", () => {
        // notify listeners
        this.finishListeners.forEach((l) => l());
        this.messages.push(assistant(msg));
      })
      .on("error", (err) => {
        this.errorListeners.forEach((l) => l(err.message));
      });
  }

  onPartialReply(listener: (msg: string) => void) {
    this.listeners.push(listener);
  }

  onReplyFinish(l: () => void) {
    this.finishListeners.push(l);
  }

  onError(l: (err: string) => void) {
    this.errorListeners.push(l);
  }
}
