import { HashRouter, Route, Routes } from "react-router-dom";
import ChatSessionPage from "./pages/ChatSessionPage";
import Home from "./pages/Home";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:id" element={<ChatSessionPage />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
