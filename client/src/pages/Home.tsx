import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WsOutputMessage } from "../../../shared/types";
import api from "../api";
import { useWs } from "../useWs";

export type Profile = {
  name: string;
  vendor: string;
  model: string;
};

export type Project = {
  id: string;
  name: string;
  full_path: string;
};

function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);

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
    async function fetchProjects() {
      const { json } = await api.get<Project[]>("/projects");
      setProjects(json);
    }

    fetchProjects();
  }, []);

  return (
    <main className="app no-chats">
      {projects.map((p) => (
        <div key={p.id}>
          <h3>
            <Link to={`/p/${p.id}`}>{p.name}</Link>
          </h3>
          <p>{p.full_path}</p>
        </div>
      ))}
    </main>
  );
}

export default HomePage;
