import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { WsOutputMessage } from "../../shared/types";
import { TaskInProgress } from "./TaskInProgress";
import { useWs } from "./useWs";
import { fileToBase64 } from "./utils";

type Message = {
  from: "user" | "assistant";
  content: string;
  image?: {
    data: string;
    type: string;
  };
};

const Chat: React.FC<{
  id: string;
  name: string;
}> = ({ id, name }) => {
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inAutoPilot, setInAutoPilot] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const { postMessage, lastMessage, readyState } = useWs();

  const [tasks, setTasks] = useState<
    {
      id: string;
      title: string;
    }[]
  >([]);

  const [file, setFile] = useState<{
    data: string;
    type: string;
  } | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    setInAutoPilot(true);
    setMessages((prev) => {
      const newMessage: Message = {
        from: "user",
        content: message,
      };

      if (file) {
        newMessage.image = file;
      }

      return [...prev, newMessage];
    });
    postMessage(message, id, file ?? undefined);
    setMessage("");
    setFile(null);
    taRef.current?.focus();
  };

  const handleWsMessage = useCallback(
    (msg: WsOutputMessage) => {
      if (
        msg.type !== "CHAT_PARTIAL_REPLY" &&
        msg.type !== "CHAT_AUTOPILOT_OFF" &&
        msg.type !== "CHAT_ERROR" &&
        msg.type !== "WORKER_TASK_STARTED" &&
        msg.type !== "WORKER_TASK_FINISHED" &&
        msg.type !== "CHAT_FORCED_MESSAGE"
      ) {
        return;
      }

      if (msg.chatId !== id) return;

      if (msg.type === "CHAT_PARTIAL_REPLY") {
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
      } else if (msg.type === "CHAT_AUTOPILOT_OFF") {
        setInAutoPilot(false);
      } else if (msg.type === "CHAT_ERROR") {
        setChatError(msg.error);
      } else if (msg.type === "WORKER_TASK_STARTED") {
        setTasks((prev) => [...prev, { id: msg.id, title: msg.title }]);
      } else if (msg.type === "WORKER_TASK_FINISHED") {
        setTasks((prev) => prev.filter((t) => t.id !== msg.id));
      } else if (msg.type === "CHAT_FORCED_MESSAGE") {
        setMessages((prev) => [
          ...prev,
          { from: "user", content: msg.content },
        ]);
      } else {
        // don't care
      }
    },
    [id]
  );

  const handleAttachImage = async (e: React.MouseEvent) => {
    e.preventDefault();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const mediaType = file.type;
      const base64 = await fileToBase64(file);

      setFile({ data: base64, type: mediaType });
    };
    input.click();
  };

  useEffect(() => {
    // scroll to bottom
    messagesRef.current?.scrollTo(0, messagesRef.current?.scrollHeight);
  }, [messages, tasks]);

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
            {m.image && (
              <div className="message-image">
                <img
                  src={`data:${m.image.type};base64,${m.image.data}`}
                  alt="Attached"
                />
              </div>
            )}
          </div>
        ))}

        {tasks.map((t) => (
          <div className="chat-task" key={t.id}>
            <TaskInProgress title={t.title} />
          </div>
        ))}

        {chatError && <div className="message error">{chatError}</div>}
      </div>

      <div className="message-form">
        <div className="message-form-main">
          <div className="attach-wrapper">
            <a
              href="#"
              onClick={handleAttachImage}
              role="button"
              title="Attach an image"
            >
              @
            </a>
          </div>
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
            disabled={!readyState || inAutoPilot || !!chatError}
          >
            ⌘↩
          </button>
        </div>
        <div className="message-form-footer">
          {file && (
            <div className="attached">
              <img
                src={`data:${file.type};base64,${file.data}`}
                alt="Attached"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
