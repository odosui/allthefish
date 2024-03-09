export type WsInputMessage =
  | {
      type: "POST_MESSAGE";
      content: string;
      chatId: string;
    }
  | {
      type: "START_CHAT";
      profile: string;
    };

export type WsOutputMessage =
  | {
      type: "CHAT_STARTED";
      name: string;
      id: string;
    }
  | {
      type: "CHAT_PARTIAL_REPLY";
      chatId: string;
      content: string;
    }
  | {
      type: "CHAT_REPLY_FINISH";
      chatId: string;
    }
  | {
      type: "CHAT_ERROR";
      chatId: string;
      error: string;
    };
