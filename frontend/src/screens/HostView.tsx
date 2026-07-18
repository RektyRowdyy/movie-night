import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { formatRelative } from "../format";
import { pushSupported, enablePush } from "../pushClient";
import { useMediaQuery } from "../useMediaQuery";
import type { HostInvite } from "../types";
import { ExpiredScreen } from "./ExpiredScreen";

export default function HostView() {
  const { token = "" } = useParams();
  const [invite, setInvite] = useState<HostInvite | null>(null);
  const [pushState, setPushState] = useState<"idle" | "asking" | "enabled" | "declined" | "unsupported">("idle");
  const isDesktop = useMediaQuery("(min-width: 960px)");

  const reload = useCallback(() => {
    api.getHost(token).then(setInvite).catch(() => {});
  }, [token]);

  useEffect(() => {
    reload();
    if (!pushSupported()) setPushState("unsupported");
  }, [reload]);

  // Push fallback (Technical Requirements §6): refetch on focus/visibility so
  // the answered state still appears without a working push subscription.
  useEffect(() => {
    const onFocus = () => reload();
    const onVis = () => document.visibilityState === "visible" && reload();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload]);

  async function requestPush() {
    setPushState("asking");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setPushState("declined");
      return;
    }
    try {
      const { vapidPublicKey } = await api.getConfig();
      const sub = await enablePush(vapidPublicKey);
      await api.subscribePush(token, sub.toJSON());
      setPushState("enabled");
      reload();
    } catch {
      setPushState("declined");
    }
  }

  if (!invite) return null;
  if (invite.expired) return <ExpiredScreen invite={invite} />;

  const picked = invite.movies.find((m) => m.id === invite.pickedMovieId);
  const others = invite.movies.filter((m) => m.id !== invite.pickedMovieId);

  return (
    <div style={{ minHeight: "100vh", maxWidth: isDesktop ? 640 : 480, margin: "0 auto", padding: "24px 18px 60px" }}>
      {invite.status === "waiting" ? (
        <div style={{ background: "radial-gradient(120% 60% at 50% 0,#fbf3e2,#efe1c6)", borderRadius: 20, padding: "22px 18px 18px", color: "#26170f" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".2em", color: "#a07b53" }}>HOSTING · YOU</div>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, margin: "4px 0 2px" }}>
            Waiting on {invite.guestName}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#8a7458", marginBottom: 14 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--marquee-gold)", boxShadow: "0 0 8px #eab24a" }} />
            {invite.openedAt ? "opened, no answer yet" : "not opened yet"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {invite.movies.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 11, background: "#fffaf0", borderRadius: 10, padding: "9px 11px", boxShadow: "0 0 0 1px rgba(38,23,15,.06)" }}>
                <div style={{ width: 34, height: 44, flex: "none", borderRadius: 5, background: m.posterBg, color: m.posterFg, display: "flex", alignItems: "flex-end", padding: 4, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 9, lineHeight: 0.85 }}>
                  {m.title}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{m.title}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "#8a7458" }}>
                    {m.year} · {m.runtime} · {m.genre}
                  </div>
                </div>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px dashed #cdb488" }} />
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#a07b53", marginTop: 10 }}>
            You'll get a push the moment they pick.
          </div>
        </div>
      ) : (
        <div style={{ borderRadius: 20, overflow: "hidden" }}>
          <div style={{ padding: "22px 18px 14px", background: "radial-gradient(120% 60% at 50% 0,#2a1712,#170c08)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".2em", color: "var(--marquee-gold)" }}>✦ THEY PICKED ✦</div>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "#f7ecd6", margin: "5px 0 3px", lineHeight: 1 }}>
              {invite.guestName} chose
              <br />
              {picked?.title}
            </h3>
            <div style={{ fontSize: 12.5, color: "#cdb99a" }}>
              Answered {invite.answeredAt && formatRelative(invite.answeredAt)}
            </div>
          </div>
          <div style={{ padding: "14px 16px 18px", background: "#efe1c6" }}>
            {picked && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fffaf0", borderRadius: 10, padding: 11, boxShadow: "0 0 0 1.5px #c4362a" }}>
                <div style={{ width: 40, height: 52, flex: "none", borderRadius: 6, background: picked.posterBg, color: picked.posterFg, display: "flex", alignItems: "flex-end", padding: 5, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 11, lineHeight: 0.82 }}>
                  {picked.title}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#26170f" }}>{picked.title}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "#8a7458" }}>
                    {picked.year} · {picked.runtime} · {picked.genre}
                  </div>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--cinema-red)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✓</div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: "#a07b53" }}>
              <span>The other two</span>
              <span>not chosen</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 7, opacity: 0.6 }}>
              {others.map((m) => (
                <div key={m.id} style={{ flex: 1, height: 38, borderRadius: 7, background: m.posterBg, color: m.posterFg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 10 }}>
                  {m.title.toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pushState !== "enabled" && invite.status === "waiting" && (
        <PushPrompt state={pushState} onEnable={requestPush} />
      )}
    </div>
  );
}

function PushPrompt({
  state,
  onEnable,
}: {
  state: "idle" | "asking" | "declined" | "unsupported";
  onEnable: () => void;
}) {
  if (state === "unsupported" || state === "declined") {
    return (
      <div style={{ marginTop: 16, fontSize: 12.5, color: "#a07b53", textAlign: "center" }}>
        We'll show the pick right here whenever you reopen this page.
      </div>
    );
  }
  return (
    <div style={{ marginTop: 16, background: "#f3e7cf", color: "#26170f", borderRadius: 16, padding: "18px 16px" }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--cinema-red)", color: "#fbeede", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>
        🔔
      </div>
      <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, textAlign: "center", margin: "0 0 6px", lineHeight: 1.02 }}>
        Get told the second they pick?
      </h3>
      <p style={{ fontSize: 12.5, textAlign: "center", color: "#5a4433", lineHeight: 1.45, margin: "0 0 16px" }}>
        One buzz when the ticket's punched. No spam, host-only, turn it off anytime.
      </p>
      <button
        onClick={onEnable}
        disabled={state === "asking"}
        style={{ width: "100%", border: 0, background: "var(--cinema-red)", color: "#fbeede", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, padding: 12, borderRadius: 11, cursor: "pointer" }}
      >
        {state === "asking" ? "…" : "TURN ON NOTIFICATIONS"}
      </button>
    </div>
  );
}
