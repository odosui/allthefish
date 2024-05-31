import { useState } from "react";
import { useWs } from "./useWs";
import { TaskInProgress } from "./TaskInProgress";
import { Profile } from "./pages/Home";

const ChatStarter = ({
  profiles,
  projectId,
}: {
  profiles: Profile[];
  projectId: string;
}) => {
  const { startChat } = useWs();
  const [waiting, setWaiting] = useState(false);
  // const [name, setName] = useState("");

  const handleStartChat = (profile: string) => {
    // if (!name) {
    //   return;
    // }
    startChat(projectId, profile);
    setWaiting(true);
  };

  return (
    <div className="chat-starter">
      {!waiting && (
        <>
          <ul>
            {profiles.map((p) => (
              <li key={p.name}>
                <button onClick={() => handleStartChat(p.name)}>
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {waiting && <TaskInProgress title="Preparing a new app..." />}
    </div>
  );
};

export default ChatStarter;
