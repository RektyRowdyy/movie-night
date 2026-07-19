import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import GuestFlow from "./screens/GuestFlow";
import HostView from "./screens/HostView";
import CreateInvite from "./screens/CreateInvite";

function Landing() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#cdb99a", textAlign: "center", padding: 24 }}>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 48, color: "#f7ecd6" }}>MOVIE NIGHT</div>
        <p>Open your invite link to get started.</p>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".15em", color: "#8a7458", margin: "6px 0" }}>OR</div>
        <Link
          to="/create"
          style={{ display: "inline-block", marginTop: 20, background: "var(--cinema-red)", color: "#fbeede", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, padding: "12px 28px", borderRadius: 11, textDecoration: "none" }}
        >
          Build an invite
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create" element={<CreateInvite />} />
        <Route path="/i/:token" element={<GuestFlow />} />
        <Route path="/host/:token" element={<HostView />} />
      </Routes>
    </BrowserRouter>
  );
}
