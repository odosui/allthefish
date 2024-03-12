import { useEffect, useState } from "react";
import { WsOutputMessage } from "../../../shared/types";
import ChatStarter from "../ChatStarter";
import api from "../api";
import { useWs } from "../useWs";
import { useNavigate } from "react-router-dom";

export type Profile = {
  name: string;
  vendor: string;
  model: string;
};

function HomePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const navigate = useNavigate();

  const { lastMessage } = useWs();

  useEffect(() => {
    if (lastMessage !== null) {
      const msg = JSON.parse(lastMessage.data) as WsOutputMessage;

      if (msg.type === "CHAT_STARTED") {
        navigate(`/s/${msg.id}`);
      } else {
        // don't care
      }
    }
  }, [lastMessage, navigate]);

  useEffect(() => {
    async function fetchProfiles() {
      const { json } = await api.get<Profile[]>("/profiles");
      setProfiles(json);
    }

    fetchProfiles();
  }, []);

  return (
    <main className={`app no-chats`}>
      {profiles && <ChatStarter profiles={profiles} />}
    </main>
  );
}

export default HomePage;
