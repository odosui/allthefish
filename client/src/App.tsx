import { useCallback, useEffect, useState } from "react";
import Chat from "./Chat";
import api from "./api";
import { useWs } from "./useWs";
import { WsOutputMessage } from "../../shared/types";

type Profile = {
  name: string;
  vendor: string;
  model: string;
};

type ChatData = {
  id: string;
  name: string;
};

function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [chats, setChats] = useState<ChatData[]>([]);

  const { lastMessage } = useWs();

  const handleWsMessage = useCallback((msg: WsOutputMessage) => {
    if (msg.type === "CHAT_STARTED") {
      setChats((prev) => [...prev, { id: msg.id, name: msg.name }]);
    } else {
      // don't care
    }
  }, []);

  useEffect(() => {
    if (lastMessage !== null) {
      const msg = JSON.parse(lastMessage.data) as WsOutputMessage;
      handleWsMessage(msg);
    }
  }, [lastMessage, handleWsMessage]);

  useEffect(() => {
    async function fetchProfiles() {
      const data = await api.get<Profile[]>("/profiles");
      setProfiles(data);
    }

    fetchProfiles();
  }, []);

  return (
    <main className={`app ${chats.length === 0 ? "no-chats" : ""}`}>
      {chats.map((chat) => (
        <Chat key={chat.id} id={chat.id} name={chat.name} />
      ))}
      {profiles && <ChatStarter profiles={profiles} />}
    </main>
  );
}

export default App;

const ChatStarter = ({ profiles }: { profiles: Profile[] }) => {
  const { startChat } = useWs();

  return (
    <div className="chat-starter">
      <h2>Start a new chat</h2>
      <ul>
        {profiles.map((profile) => (
          <li key={profile.name}>
            <button onClick={() => startChat(profile.name)}>
              {profile.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
