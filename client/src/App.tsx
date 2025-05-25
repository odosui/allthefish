import { HashRouter, Route, Routes } from "react-router-dom";
import ChatSessionPage from "./pages/ChatSessionPage";
import ProjectPage from "./pages/ProjectPage";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectPage />} />
        <Route path="/s/:id" element={<ChatSessionPage />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
