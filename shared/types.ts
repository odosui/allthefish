export type WsInputMessage =
  | {
      type: "POST_MESSAGE";
      content: string;
      image?: {
        data: string;
        type: string;
      };
      chatId: string;
    }
  | {
      type: "START_CHAT";
      profile: string;
      projectId: string;
    };

export type WsOutputMessage =
  | {
      type: "CHAT_STARTED";
      name: string;
      serverUrl: string;
      id: string;
    }
  | {
      type: "CHAT_PARTIAL_REPLY";
      chatId: string;
      content: string;
    }
  | {
      type: "CHAT_AUTOPILOT_OFF";
      chatId: string;
    }
  | {
      type: "CHAT_FORCED_MESSAGE";
      chatId: string;
      content: string;
    }
  | {
      type: "CHAT_ERROR";
      chatId: string;
      error: string;
    }
  | {
      type: "CHAT_PROJECT_UPDATED";
      chatId: string;
    }
  | {
      type: "WORKER_TASK_STARTED";
      chatId: string;
      title: string;
      id: string;
    }
  | {
      type: "WORKER_TASK_FINISHED";
      chatId: string;
      id: string;
    };

export type ChatSession = {
  id: string;
  name: string;
  serverUrl: string;
};
