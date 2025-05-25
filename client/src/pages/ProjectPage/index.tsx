import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WsOutputMessage } from "../../../../shared/types";
import api from "../../api";
import ChatStarter from "../../ChatStarter";
import { useWs } from "../../useWs";
import { Profile, Project } from "../Home";

function ProjectPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [project, setProject] = useState<Project | null>(null);

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

    async function fetchProject() {
      const { json } = await api.get<Project>("/project");
      setProject(json);
    }

    fetchProfiles();
    fetchProject();
  }, []);

  return (
    <main className="app">
      {profiles && project && (
        <ChatStarter profiles={profiles} projectId={project.id} />
      )}
    </main>
  );
}

export default ProjectPage;
