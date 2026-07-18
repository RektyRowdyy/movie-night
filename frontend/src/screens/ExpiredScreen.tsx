import { formatEventDate } from "../format";
import type { GuestInvite, HostInvite } from "../types";

export function ExpiredScreen({ invite }: { invite: GuestInvite | HostInvite }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#170c08",
        color: "#cdb99a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 26,
      }}
    >
      <div style={{ position: "relative", width: 200, marginBottom: 20 }}>
        <div style={{ background: "#2a1712", borderRadius: 9, padding: "14px 10px", opacity: 0.55, filter: "grayscale(.4)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "#7a5f4a", letterSpacing: ".1em" }}>
            MOVIE NIGHT
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#5a4436", marginTop: 4 }}>
            {formatEventDate(invite.eventAt).toUpperCase()}
          </div>
        </div>
        <div style={{ position: "absolute", top: "50%", left: -6, right: -6, height: 2, background: "var(--cinema-red)", transform: "rotate(-9deg)" }} />
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".2em", color: "var(--cinema-red)" }}>✕ INVITE CLOSED</div>
      <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "#f7ecd6", margin: "8px 0 6px", lineHeight: 1 }}>
        This one's
        <br />
        expired
      </h3>
      <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: "0 0 16px", maxWidth: 280 }}>
        Movie night was {formatEventDate(invite.eventAt)}. Hope the couch was good.
      </p>
    </div>
  );
}
