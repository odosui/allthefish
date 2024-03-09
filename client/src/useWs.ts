import useWebSocket from "react-use-websocket";
import { WsInputMessage } from "../../shared/types";

const WS_URL = "ws://localhost:3000";

export function useWs() {
  const { sendJsonMessage, lastMessage, readyState } = useWebSocket(WS_URL);

  const startChat = (profile: string) => {
    const e: WsInputMessage = {
      type: "START_CHAT",
      profile,
    };

    console.log("Starting chat", e);
    sendJsonMessage(e);
  };

  const postMessage = (message: string, chatId: string) => {
    const e: WsInputMessage = {
      type: "POST_MESSAGE",
      content: message,
      chatId,
    };

    sendJsonMessage(e);
  };

  return {
    postMessage,
    startChat,
    lastMessage,
    readyState,
  };
}
