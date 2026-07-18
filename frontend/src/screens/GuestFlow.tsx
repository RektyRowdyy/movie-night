import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { formatEventDate } from "../format";
import { useReducedMotion } from "../useReducedMotion";
import type { GuestInvite, Movie } from "../types";
import { ExpiredScreen } from "./ExpiredScreen";

type Screen = "loading" | "error" | "invite" | "picker" | "detail" | "punching" | "confirm";

const page: React.CSSProperties = {
  minHeight: "100vh",
  maxWidth: 520,
  margin: "0 auto",
};

export default function GuestFlow() {
  const { token = "" } = useParams();
  const [invite, setInvite] = useState<GuestInvite | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [selIdx, setSelIdx] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    api
      .getInvite(token)
      .then((iv) => {
        setInvite(iv);
        if (iv.expired) return; // ExpiredScreen renders directly from `expired`
        if (iv.status === "answered") setScreen("confirm");
        else if (iv.openedAt) setScreen("picker");
        else setScreen("invite");
      })
      .catch(() => setScreen("error"));
  }, [token]);

  if (screen === "error") return <Centered>Couldn't load this invite.</Centered>;
  if (!invite) return <Centered>Loading…</Centered>;
  if (invite.expired) return <ExpiredScreen invite={invite} />;

  const sel = invite.movies[selIdx];

  async function commit(movieId: string) {
    setScreen("punching");
    const updated = await api.pick(token, movieId);
    setInvite(updated);
    if (reducedMotion) {
      setScreen("confirm");
    } else {
      setTimeout(() => setScreen("confirm"), 900);
    }
  }

  return (
    <div style={page}>
      {screen === "invite" && (
        <InviteScreen invite={invite} onReveal={() => setScreen("picker")} />
      )}
      {screen === "picker" && (
        <PickerScreen
          movies={invite.movies}
          onOpen={(i) => {
            setSelIdx(i);
            setScreen("detail");
          }}
        />
      )}
      {screen === "detail" && (
        <DetailScreen
          movie={sel}
          onBack={() => setScreen("picker")}
          onCommit={() => commit(sel.id)}
        />
      )}
      {screen === "punching" && <PunchOverlay movie={sel} reducedMotion={reducedMotion} />}
      {screen === "confirm" && (
        <ConfirmScreen
          invite={invite}
          onRepick={() => setScreen("picker")}
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#cdb99a" }}>
      {children}
    </div>
  );
}

function InviteScreen({ invite, onReveal }: { invite: GuestInvite; onReveal: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(120% 60% at 50% 0%,#fbf3e2,#f0e3c8)",
        padding: "64px 26px 32px",
      }}
    >
      <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".3em", color: "#b0552f" }}>
        ✦ AN INVITE FOR ✦
      </div>
      <div style={{ textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 44, lineHeight: 1, color: "#26170f", margin: "6px 0 2px" }}>
        {invite.guestName.toUpperCase()}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", margin: "14px 0 22px" }}>
        <div style={{ height: 1, width: 36, background: "#cdb488" }} />
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, letterSpacing: ".16em", color: "var(--cinema-red)" }}>
          MOVIE NIGHT
        </div>
        <div style={{ height: 1, width: 36, background: "#cdb488" }} />
      </div>
      <p style={{ fontSize: 16, lineHeight: 1.62, color: "#3e2c1f", margin: "0 0 20px" }}>{invite.note}</p>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "#26170f", textAlign: "right", marginBottom: 22 }}>
        — {invite.hostName}
      </div>
      <div style={{ border: "1.5px dashed #cdb488", borderRadius: 14, padding: "16px 18px", background: "rgba(255,255,255,.5)", display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
        <Row label="WHEN" value={formatEventDate(invite.eventAt)} />
        <Divider />
        <Row label="WHERE" value={<a href={invite.location} target="_blank" rel="noopener">Join the voice channel</a>} />
      </div>
      <button
        onClick={onReveal}
        style={{ width: "100%", border: 0, cursor: "pointer", background: "var(--cinema-red)", color: "#fbeede", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, letterSpacing: ".04em", padding: 17, borderRadius: 14, boxShadow: "0 10px 22px -8px rgba(196,54,42,.7)" }}
      >
        SEE THE THREE →
      </button>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 13.5, color: "#a07b53" }}>
        <span style={{ color: "var(--cinema-red)" }}>●</span> {invite.hostName} is waiting to hear what you pick
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".14em", color: "#8a7458" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#26170f" }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "repeating-linear-gradient(90deg,#cdb488 0 5px,transparent 5px 10px)" }} />;
}

function PickerScreen({ movies, onOpen }: { movies: Movie[]; onOpen: (i: number) => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(120% 50% at 50% 0%,#fbf3e2,#efe1c6)", padding: "56px 20px 30px" }}>
      <div style={{ textAlign: "center", marginBottom: 6, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".24em", color: "#a07b53" }}>
        MAYA'S SHORTLIST — PICK ONE
      </div>
      <h2 style={{ textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 32, color: "#26170f", margin: "2px 0 4px" }}>
        Three to choose from
      </h2>
      <p style={{ textAlign: "center", fontSize: 13.5, color: "#8a7458", margin: "0 0 20px" }}>
        Open any of them — nothing's locked until you punch it.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {movies.map((m, i) => (
          <button
            key={m.id}
            onClick={() => onOpen(i)}
            style={{ position: "relative", display: "flex", textAlign: "left", cursor: "pointer", border: 0, padding: 0, background: "#fffaf0", borderRadius: 14, minHeight: 118, boxShadow: "0 8px 20px -12px rgba(38,23,15,.55), 0 0 0 1px rgba(38,23,15,.06)" }}
          >
            <div style={{ width: 98, flex: "none", borderRadius: "14px 0 0 14px", padding: "12px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between", background: m.posterBg, color: m.posterFg }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".14em", opacity: 0.85 }}>{m.moodTag}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, lineHeight: 0.94 }}>{m.title}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.8 }}>{m.rating} ★</div>
            </div>
            <div style={{ flex: 1, padding: "13px 40px 13px 15px", minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 23, lineHeight: 1, color: "#26170f" }}>{m.title}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#8a7458", margin: "5px 0 8px" }}>
                {m.year} · {m.runtime} · {m.genre}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.35, color: "#4a382a", fontStyle: "italic" }}>“{m.hook}”</div>
            </div>
            <div style={{ position: "absolute", top: 0, bottom: 0, right: 34, width: 0, borderLeft: "2px dashed #e4d3b2" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".22em", color: "#b78f5c" }}>
                OPEN →
              </span>
            </div>
          </button>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 22, fontSize: 12.5, color: "#a07b53" }}>
        <span style={{ color: "var(--cinema-red)" }}>●</span> Maya's waiting — no rush, but she's watching for it
      </div>
    </div>
  );
}

function DetailScreen({ movie, onBack, onCommit }: { movie: Movie; onBack: () => void; onCommit: () => void }) {
  return (
    <>
      <div className="anim-dim" style={{ position: "fixed", inset: 0, background: "rgba(23,12,8,.55)" }} onClick={onBack} />
      <div className="anim-sheet" style={{ position: "fixed", left: 0, right: 0, bottom: 0, top: 34, background: "#f3e7cf", borderRadius: "26px 26px 0 0", overflow: "auto", boxShadow: "0 -20px 50px -20px rgba(0,0,0,.6)" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 5, background: movie.posterBg, padding: "12px 18px 20px" }}>
          <div style={{ width: 44, height: 5, borderRadius: 3, background: "rgba(255,255,255,.35)", margin: "0 auto 14px" }} />
          <button onClick={onBack} style={{ border: 0, cursor: "pointer", background: "rgba(0,0,0,.28)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", padding: "8px 12px", borderRadius: 20 }}>
            ← ALL THREE
          </button>
          <div style={{ marginTop: 20, color: movie.posterFg }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".2em", opacity: 0.85 }}>{movie.moodTag}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 46, lineHeight: 0.9, margin: "3px 0" }}>{movie.title}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.9 }}>
              {movie.year} · {movie.runtime} · {movie.genre} · {movie.rating} ★
            </div>
          </div>
        </div>
        <div style={{ padding: "20px 20px 150px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
            {movie.tags.map((t) => (
              <span key={t} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".06em", color: "#5a4433", border: "1px solid #d8c39c", background: "#fbf3e2", padding: "5px 11px", borderRadius: 20 }}>
                {t}
              </span>
            ))}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".14em", color: "#a07b53", marginBottom: 4 }}>DIRECTED BY</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: "#26170f", marginBottom: 16 }}>{movie.director}</div>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "#3e2c1f", margin: "0 0 22px" }}>{movie.synopsis}</p>
          <a
            href={`https://www.youtube.com/results?search_query=${movie.trailerq}+trailer`}
            target="_blank"
            rel="noopener"
            aria-label="Watch the trailer, opens YouTube in a new tab"
            style={{ display: "flex", alignItems: "center", gap: 13, textDecoration: "none", border: "1.5px solid #26170f", borderRadius: 13, padding: "13px 16px", color: "#26170f", background: "#fffaf0" }}
          >
            <span style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", background: "var(--cinema-red)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>▶</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, lineHeight: 1 }}>WATCH THE TRAILER</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.7 }}>Opens YouTube — leaves this app ↗</span>
            </span>
          </a>
        </div>
        <div style={{ position: "sticky", bottom: 0, padding: "16px 20px 26px", background: "linear-gradient(0deg,#f3e7cf 72%,rgba(243,231,207,0))" }}>
          <button
            onClick={onCommit}
            style={{ width: "100%", border: 0, cursor: "pointer", background: "var(--cinema-red)", color: "#fbeede", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: ".04em", padding: 17, borderRadius: 14, boxShadow: "0 12px 26px -8px rgba(196,54,42,.75)" }}
          >
            PUNCH MY TICKET
          </button>
          <div style={{ textAlign: "center", marginTop: 9, fontSize: 12.5, color: "#8a7458" }}>
            You get one change of mind after — so go on.
          </div>
        </div>
      </div>
    </>
  );
}

function PunchOverlay({ movie, reducedMotion }: { movie: Movie; reducedMotion: boolean }) {
  return (
    <div className="anim-dim" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(23,12,8,.82)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 230, background: "#f3e7cf", borderRadius: 12, padding: "26px 22px", textAlign: "center", boxShadow: "0 30px 60px -20px #000" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".2em", color: "#a07b53" }}>ADMIT ONE</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, lineHeight: 0.95, color: "#26170f", margin: "6px 0" }}>{movie.title}</div>
        <div
          className={reducedMotion ? undefined : "anim-punch"}
          style={{ position: "absolute", left: "50%", top: "52%", transform: "translate(-50%,-50%)" }}
        >
          <div style={{ width: 132, height: 132, borderRadius: "50%", border: "5px solid var(--cinema-red)", color: "var(--cinema-red)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, letterSpacing: ".04em", boxShadow: "0 0 0 3px rgba(196,54,42,.25)" }}>
            PUNCHED
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmScreen({ invite, onRepick }: { invite: GuestInvite; onRepick: () => void }) {
  const picked = invite.movies.find((m) => m.id === invite.pickedMovieId) ?? invite.movies[0];
  return (
    <div className="anim-rise" style={{ minHeight: "100vh", background: "radial-gradient(120% 60% at 50% 0%,#2a1712,#170c08)", padding: "60px 24px 30px", color: "#f3e7cf" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".28em", color: "var(--marquee-gold)" }}>✦ ALL SET ✦</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40, lineHeight: 0.98, margin: "10px 0 6px", color: "#f7ecd6" }}>
          The good couch
          <br />
          is yours.
        </h2>
        <p style={{ color: "#cdb99a", fontSize: 15, margin: "0 auto 26px", maxWidth: 280 }}>
          Nice pick. {invite.hostName}'s just been pinged — it's official.
        </p>
      </div>
      <div style={{ position: "relative", background: "#f3e7cf", color: "#26170f", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 50px -20px rgba(0,0,0,.7)" }}>
        <div style={{ padding: "16px 18px 14px", background: picked.posterBg, color: picked.posterFg }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".2em", opacity: 0.85 }}>YOU'RE WATCHING</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 36, lineHeight: 0.92, marginTop: 2 }}>{picked.title}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.9, marginTop: 3 }}>
            {picked.year} · {picked.runtime} · {picked.genre}
          </div>
        </div>
        <div style={{ position: "relative", height: 20, background: "#f3e7cf" }}>
          <div style={{ position: "absolute", top: "50%", left: 14, right: 14, transform: "translateY(-50%)", borderTop: "2px dashed #d8c39c" }} />
        </div>
        <div style={{ padding: "8px 18px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", color: "#8a7458" }}>MOVIE NIGHT</div>
            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>{formatEventDate(invite.eventAt)}</div>
            <div style={{ fontSize: 12.5, color: "#8a7458" }}>
              <a href={invite.location} target="_blank" rel="noopener">Join the voice channel</a> · with {invite.hostName}
            </div>
          </div>
          <div style={{ width: 62, height: 62, flex: "none", borderRadius: "50%", border: "3px solid var(--cinema-red)", color: "var(--cinema-red)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, transform: "rotate(-9deg)" }}>
            PUNCHED
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", margin: "22px 0 4px", color: "#9fd3a2", fontSize: 14 }}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#2f6b3a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</span>
        {invite.hostName} has been told
      </div>
      <div style={{ textAlign: "center", marginTop: 20 }}>
        {invite.canRepick ? (
          <button onClick={onRepick} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--marquee-gold)", fontSize: 13.5, textDecoration: "underline", textUnderlineOffset: 3 }}>
            Changed your mind? One swap allowed →
          </button>
        ) : (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", color: "#8a7458" }}>
            🔒 LOCKED IN — YOUR PICK IS FINAL
          </div>
        )}
      </div>
    </div>
  );
}
