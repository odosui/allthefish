import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ChatSession } from "../../../../shared/types";
import Chat from "../../Chat";
import api from "../../api";

function ChatSessionPage() {
  const { id } = useParams();
  const [chat, setChat] = useState<ChatSession | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadChat(id: string) {
      const { status, json } = await api.get<ChatSession>(`/chat/${id}`);
      if (status === 404) {
        setNotFound(true);
        return;
      }
      setChat(json);
    }

    if (!id) {
      return;
    }

    loadChat(id);
  }, [id]);

  return (
    <main className="app">
      {notFound && <h1>Chat not found</h1>}
      {chat && (
        <>
          <Preview serverUrl={chat.serverUrl} />
          <Chat key={chat.id} id={chat.id} name={chat.name} />
        </>
      )}
    </main>
  );
}

export default ChatSessionPage;

const Preview: React.FC<{ serverUrl: string }> = ({ serverUrl }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) {
    return <div className="preview"></div>;
  }

  return (
    <div className="preview">
      <iframe src={`${serverUrl}`} title="project" />
    </div>
  );
};
