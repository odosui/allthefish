import OpenAI from "openai";

export class OpenAiChat {
  private model: string;

  private client: OpenAI;
  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  private listeners: ((msg: string) => void)[] = [];
  private finishListeners: (() => void)[] = [];

  constructor(apiKey: string, model: string, systemMsg: string) {
    this.model = model;
    this.messages.push(system(systemMsg));
    this.client = new OpenAI({ apiKey });
  }

  async postMessage(input: string) {
    this.messages.push(user(input));

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: this.messages,
      stream: true,
    });

    let msg = "";

    for await (const part of stream) {
      // collect regular message
      const p = part.choices[0]?.delta?.content || "";
      if (p) {
        // notify listeners
        this.listeners.forEach((listener) => listener(p));
        msg += p;
      }
    }

    stream.controller.abort();
    this.messages.push(assistant(msg));

    // notify listeners
    this.finishListeners.forEach((l) => l());
  }

  onPartialReply(listener: (msg: string) => void) {
    this.listeners.push(listener);
  }

  onReplyFinish(l: () => void) {
    this.finishListeners.push(l);
  }
}

// helpers

function system(
  content: string
): OpenAI.Chat.Completions.ChatCompletionSystemMessageParam {
  return { role: "system", content };
}

function user(
  content: string
): OpenAI.Chat.Completions.ChatCompletionUserMessageParam {
  return { role: "user", content };
}

function assistant(
  content: string
): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam {
  return { role: "assistant", content };
}
