import { BrowserRouter, Routes, Route } from "react-router-dom";
import GuestFlow from "./screens/GuestFlow";
import HostView from "./screens/HostView";

function Landing() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#cdb99a", textAlign: "center", padding: 24 }}>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 48, color: "#f7ecd6" }}>MOVIE NIGHT</div>
        <p>Open your invite link to get started.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/i/:token" element={<GuestFlow />} />
        <Route path="/host/:token" element={<HostView />} />
      </Routes>
    </BrowserRouter>
  );
}
