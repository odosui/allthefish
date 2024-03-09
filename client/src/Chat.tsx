import { useCallback, useEffect, useRef, useState } from "react";
import api from "./api";
import { useWs } from "./useWs";
import { WsOutputMessage } from "../../shared/types";
import Markdown from "react-markdown";

type Message = {
  from: "user" | "assistant";
  content: string;
};

const Chat: React.FC<{
  id: string;
  name: string;
}> = ({ id, name }) => {
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [waitingTillReplyFinish, setWaitingTillReplyFinish] =
    useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const { postMessage, lastMessage, readyState } = useWs();

  const taRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    setWaitingTillReplyFinish(true);
    setMessages((prev) => [
      ...prev,
      {
        from: "user",
        content: message,
      },
    ]);
    postMessage(message, id);
    setMessage("");
    taRef.current?.focus();
  };

  const handleWsMessage = useCallback(
    (msg: WsOutputMessage) => {
      if (msg.type === "CHAT_PARTIAL_REPLY") {
        if (msg.chatId !== id) return;
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.from === "assistant") {
            return [
              ...prev.slice(0, prev.length - 1),
              { from: "assistant", content: lastMsg.content + msg.content },
            ];
          } else {
            return [...prev, { from: "assistant", content: msg.content }];
          }
        });
      } else if (msg.type === "CHAT_REPLY_FINISH") {
        if (msg.chatId !== id) return;
        setWaitingTillReplyFinish(false);
      } else if (msg.type === "CHAT_ERROR") {
        if (msg.chatId !== id) return;
        setChatError(msg.error);
      } else {
        // don't care
      }
    },
    [id]
  );

  useEffect(() => {
    async function loadProfiles() {
      const profiles = await api.get<string[]>("/profiles");
      console.log(profiles);
    }

    loadProfiles();
  }, []);

  useEffect(() => {
    // scroll to bottom
    messagesRef.current?.scrollTo(0, messagesRef.current?.scrollHeight);
  }, [messages]);

  useEffect(() => {
    if (lastMessage !== null) {
      const msg = JSON.parse(lastMessage.data) as WsOutputMessage;
      handleWsMessage(msg);
    }
  }, [lastMessage, handleWsMessage]);

  return (
    <div className="chat">
      <div className="chat-title">{name}</div>

      <div className="messages" ref={messagesRef}>
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.from}`}>
            <div className="from">
              {m.from} {m.from === "assistant" ? "🤖" : ""}
            </div>
            <div className="content">
              <Markdown>{m.content}</Markdown>
            </div>
          </div>
        ))}

        {chatError && <div className="message error">{chatError}</div>}
      </div>

      <div className="message-form">
        <form>
          <textarea
            onKeyDown={(e) => {
              // submit on CMD+Enter
              if (e.key === "Enter" && e.metaKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            ref={taRef}
            autoFocus
          ></textarea>
          <button
            type="submit"
            onClick={handleSendMessage}
            disabled={!readyState || waitingTillReplyFinish || !!chatError}
          >
            ⌘↩
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
