import { useState } from "react";
import { Profile } from "./App";
import { useWs } from "./useWs";
import { TaskInProgress } from "./TaskInProgress";

const ChatStarter = ({ profiles }: { profiles: Profile[] }) => {
  const { startChat } = useWs();
  const [waiting, setWaiting] = useState(false);
  const [name, setName] = useState("");

  const handleStartChat = (profile: string) => {
    if (!name) {
      return;
    }
    startChat(name, profile);
    setWaiting(true);
  };

  return (
    <div className="chat-starter">
      {!waiting && (
        <>
          <input
            type="text"
            placeholder="Directory name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <ul>
            {profiles.map((profile) => (
              <li key={profile.name}>
                <button onClick={() => handleStartChat(profile.name)}>
                  {profile.name}
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
