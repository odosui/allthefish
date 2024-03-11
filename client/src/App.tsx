import { useCallback, useEffect, useState } from "react";
import Chat from "./Chat";
import api from "./api";
import { useWs } from "./useWs";
import { WsOutputMessage } from "../../shared/types";
import { TaskInProgress } from "./TaskInProgress";

type Profile = {
  name: string;
  vendor: string;
  model: string;
};

type ChatData = {
  id: string;
  name: string;
  serverUrl: string;
};

function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [chat, setChat] = useState<ChatData | null>(null);

  const { lastMessage } = useWs();

  const handleWsMessage = useCallback((msg: WsOutputMessage) => {
    if (msg.type === "CHAT_STARTED") {
      setChat({ id: msg.id, name: msg.name, serverUrl: msg.serverUrl });
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
    <main className={`app ${!chat ? "no-chats" : ""}`}>
      {chat && <Preview serverUrl={chat.serverUrl} />}
      {chat && <Chat key={chat.id} id={chat.id} name={chat.name} />}
      {!chat && profiles && <ChatStarter profiles={profiles} />}
    </main>
  );
}

// Let's create an app, that allows users to track their calories intake. Store the data in the localStorage.

// On the main page there should be a list of records, ordered recent first, and a button that shows a form for adding more.

// Feel free to add some mock data by default

export default App;

const Preview: React.FC<{ serverUrl: string }> = ({ serverUrl }) => {
  const [show, setShow] = useState(false);
  // const [ ts, setTs ] = useState(Date.now());

  // const { lastMessage } = useWs();

  // const handleWsMessage = useCallback((msg: WsOutputMessage) => {
  //   if (msg.type === "CHAT_PROJECT_UPDATED") {
  //     setTs(Date.now());
  //   } else {
  //     // don't care
  //   }
  // }, []);

  // useEffect(() => {
  //   if (lastMessage !== null) {
  //     const msg = JSON.parse(lastMessage.data) as WsOutputMessage;
  //     handleWsMessage(msg);
  //   }
  // }, [lastMessage, handleWsMessage]);

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

const ChatStarter = ({ profiles }: { profiles: Profile[] }) => {
  const { startChat } = useWs();
  const [waiting, setWaiting] = useState(false);

  const handleStartChat = (profile: string) => {
    startChat(profile);
    setWaiting(true);
  };

  return (
    <div className="chat-starter">
      {!waiting && (
        <ul>
          {profiles.map((profile) => (
            <li key={profile.name}>
              <button onClick={() => handleStartChat(profile.name)}>
                {profile.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {waiting && <TaskInProgress title="Preparing a new app..." />}
    </div>
  );
};
