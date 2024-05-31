import { HashRouter, Route, Routes } from "react-router-dom";
import ChatSessionPage from "./pages/ChatSessionPage";
import Home from "./pages/Home";
import ProjectPage from "./pages/ProjectPage";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:id" element={<ChatSessionPage />} />
        <Route path="/p/:id" element={<ProjectPage />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
