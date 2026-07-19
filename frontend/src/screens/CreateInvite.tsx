import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronLeft, Plus, X } from "lucide-react";
import { api } from "../api";
import { formatEventDate } from "../format";
import { pushSupported, enablePush } from "../pushClient";
import { useMediaQuery } from "../useMediaQuery";
import type { Movie } from "../types";
import { Row, Divider, DiscordIcon, MobileMovieCard, DesktopMovieCard } from "./GuestFlow";
import { PushPrompt } from "./HostView";

type Step = "details" | "shortlist" | "review" | "sent";
type PushState = "idle" | "asking" | "enabled" | "declined" | "unsupported";

const STEPS: { key: Step; title: string }[] = [
  { key: "details", title: "The details" },
  { key: "shortlist", title: "The shortlist" },
  { key: "review", title: "Review" },
];

const POSTER_PRESETS = [
  { name: "Teal night", bg: "linear-gradient(158deg,#12333c,#0a1d23)", fg: "#e9c15f" },
  { name: "Deep red", bg: "linear-gradient(158deg,#3a1414,#180909)", fg: "#ecdccb" },
  { name: "Gold", bg: "linear-gradient(158deg,#e7c24d,#c39f2f)", fg: "#2a1c07" },
  { name: "Violet", bg: "linear-gradient(158deg,#2e1f3d,#170f20)", fg: "#e6c9f2" },
  { name: "Forest", bg: "linear-gradient(158deg,#1c3a24,#0e1e13)", fg: "#d7e9c9" },
];

function blankMovie(): Movie {
  const p = POSTER_PRESETS[0];
  return {
    id: "",
    title: "",
    year: "",
    runtime: "",
    genre: "",
    moodTag: "",
    rating: "",
    director: "",
    hook: "",
    synopsis: "",
    tags: [],
    trailerq: "",
    posterBg: p.bg,
    posterFg: p.fg,
  };
}

function isMovieFilled(m: Movie): boolean {
  return m.title.trim() !== "" && m.hook.trim() !== "";
}

function composeEventAt(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function pageStyle(isDesktop: boolean): React.CSSProperties {
  return { minHeight: "100vh", maxWidth: isDesktop ? 720 : 520, margin: "0 auto" };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1.5px solid #cdb488",
  borderRadius: 10,
  padding: "11px 13px",
  fontSize: 15,
  fontFamily: "var(--font-body)",
  background: "#fffaf0",
  color: "#26170f",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  border: 0,
  background: "none",
  cursor: "pointer",
  color: "#8a7458",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  letterSpacing: ".08em",
  padding: 0,
};

export default function CreateInvite() {
  const isDesktop = useMediaQuery("(min-width: 960px)");

  const [step, setStep] = useState<Step>("details");
  const [editingSlot, setEditingSlot] = useState<0 | 1 | 2 | null>(null);

  const [hostName, setHostName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [locationLabel, setLocationLabel] = useState("Discord");
  const [bring, setBring] = useState("Just yourself");

  const [movies, setMovies] = useState<[Movie, Movie, Movie]>(() => [blankMovie(), blankMovie(), blankMovie()]);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ inviteToken: string; hostToken: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pushState, setPushState] = useState<PushState>(pushSupported() ? "idle" : "unsupported");

  const detailsValid =
    hostName.trim() !== "" &&
    guestName.trim() !== "" &&
    note.trim() !== "" &&
    date !== "" &&
    time !== "" &&
    location.trim() !== "";

  const filledCount = movies.filter(isMovieFilled).length;
  const eventAt = composeEventAt(date, time);

  function updateMovie(i: 0 | 1 | 2, patch: Partial<Movie>) {
    setMovies((prev) => {
      const next = [...prev] as [Movie, Movie, Movie];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  async function send() {
    if (!eventAt) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await api.createInvite({
        hostName,
        guestName,
        note,
        location,
        locationLabel,
        bring,
        eventAt: eventAt.toISOString(),
        movies,
      });
      setSent(res);
      setStep("sent");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Could not send the invite.");
    } finally {
      setSending(false);
    }
  }

  async function requestPush(hostToken: string) {
    setPushState("asking");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setPushState("declined");
      return;
    }
    try {
      const { vapidPublicKey } = await api.getConfig();
      const sub = await enablePush(vapidPublicKey);
      await api.subscribePush(hostToken, sub.toJSON());
      setPushState("enabled");
    } catch {
      setPushState("declined");
    }
  }

  function buildAnother() {
    setStep("details");
    setEditingSlot(null);
    setHostName("");
    setGuestName("");
    setNote("");
    setDate("");
    setTime("");
    setLocation("");
    setLocationLabel("Discord");
    setBring("Just yourself");
    setMovies([blankMovie(), blankMovie(), blankMovie()]);
    setSent(null);
    setCopied(false);
    setPushState(pushSupported() ? "idle" : "unsupported");
  }

  return (
    <div style={{ ...pageStyle(isDesktop), padding: "40px 20px 60px" }}>
      {step !== "sent" && <ProgressSteps step={step} />}

      {step === "details" && (
        <DetailsStep
          values={{ hostName, guestName, note, date, time, location, locationLabel, bring }}
          onChange={{
            setHostName,
            setGuestName,
            setNote,
            setDate,
            setTime,
            setLocation,
            setLocationLabel,
            setBring,
          }}
          valid={detailsValid}
          onNext={() => setStep("shortlist")}
        />
      )}

      {step === "shortlist" && (
        <ShortlistStep
          movies={movies}
          filledCount={filledCount}
          onEditSlot={setEditingSlot}
          onBack={() => setStep("details")}
          onNext={() => setStep("review")}
        />
      )}

      {step === "review" && (
        <ReviewStep
          isDesktop={isDesktop}
          hostName={hostName}
          note={note}
          eventAt={eventAt}
          location={location}
          locationLabel={locationLabel}
          bring={bring}
          movies={movies}
          sending={sending}
          sendError={sendError}
          onBack={() => setStep("shortlist")}
          onSend={send}
          onEditMovie={(i) => {
            setStep("shortlist");
            setEditingSlot(i);
          }}
        />
      )}

      {step === "sent" && sent && (
        <SentScreen
          inviteToken={sent.inviteToken}
          hostToken={sent.hostToken}
          copied={copied}
          onCopy={() => {
            const link = `${window.location.origin}/i/${sent.inviteToken}`;
            navigator.clipboard
              ?.writeText(link)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
              .catch(() => {});
          }}
          pushState={pushState}
          onEnablePush={() => requestPush(sent.hostToken)}
          onBuildAnother={buildAnother}
        />
      )}

      {editingSlot !== null && (
        <MovieEditorSheet
          movie={movies[editingSlot]}
          isDesktop={isDesktop}
          onChange={(patch) => updateMovie(editingSlot, patch)}
          onDone={() => setEditingSlot(null)}
        />
      )}
    </div>
  );
}

function ProgressSteps({ step }: { step: Step }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  const current = STEPS[idx] ?? STEPS[0];
  return (
    <div style={{ margin: "0 0 22px" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            style={{ flex: 1, height: 4, borderRadius: 2, background: i <= idx ? "var(--cinema-red)" : "#3e2c1f" }}
          />
        ))}
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        Step {idx + 1} of {STEPS.length}, {current.title}
      </div>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: ".12em",
          color: "#8a7458",
          marginBottom: 6,
        }}
      >
        {label.toUpperCase()}
      </label>
      {children}
    </div>
  );
}

function DetailsStep({
  values,
  onChange,
  valid,
  onNext,
}: {
  values: {
    hostName: string;
    guestName: string;
    note: string;
    date: string;
    time: string;
    location: string;
    locationLabel: string;
    bring: string;
  };
  onChange: {
    setHostName: (v: string) => void;
    setGuestName: (v: string) => void;
    setNote: (v: string) => void;
    setDate: (v: string) => void;
    setTime: (v: string) => void;
    setLocation: (v: string) => void;
    setLocationLabel: (v: string) => void;
    setBring: (v: string) => void;
  };
  valid: boolean;
  onNext: () => void;
}) {
  return (
    <div style={{ background: "#fbf3e2", borderRadius: 20, padding: "24px 20px", color: "#26170f" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, margin: "0 0 4px" }}>
        Build the invite
      </h2>
      <p style={{ fontSize: 13.5, color: "#8a7458", margin: "0 0 20px" }}>Start with who, when, and where.</p>

      <Field id="hostName" label="From (you)">
        <input
          id="hostName"
          style={inputStyle}
          value={values.hostName}
          onChange={(e) => onChange.setHostName(e.target.value)}
          placeholder="Maya"
        />
      </Field>
      <Field id="guestName" label="Inviting">
        <input
          id="guestName"
          style={inputStyle}
          value={values.guestName}
          onChange={(e) => onChange.setGuestName(e.target.value)}
          placeholder="Sam"
        />
      </Field>
      <Field id="note" label="Your note">
        <textarea
          id="note"
          style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
          value={values.note}
          onChange={(e) => onChange.setNote(e.target.value)}
          placeholder="The line that sells it"
        />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field id="date" label="When — date">
            <input id="date" type="date" style={inputStyle} value={values.date} onChange={(e) => onChange.setDate(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field id="time" label="Time">
            <input id="time" type="time" style={inputStyle} value={values.time} onChange={(e) => onChange.setTime(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field id="location" label="Where">
        <input
          id="location"
          style={inputStyle}
          value={values.location}
          onChange={(e) => onChange.setLocation(e.target.value)}
          placeholder="Your place, an address…"
        />
      </Field>
      <Field id="locationLabel" label="Where — display name">
        <input
          id="locationLabel"
          style={inputStyle}
          value={values.locationLabel}
          onChange={(e) => onChange.setLocationLabel(e.target.value)}
          placeholder="Discord"
        />
      </Field>
      <Field id="bring" label="Bring">
        <input
          id="bring"
          style={inputStyle}
          value={values.bring}
          onChange={(e) => onChange.setBring(e.target.value)}
          placeholder="Just yourself"
        />
      </Field>

      <button
        onClick={onNext}
        disabled={!valid}
        style={{
          width: "100%",
          border: 0,
          cursor: valid ? "pointer" : "not-allowed",
          opacity: valid ? 1 : 0.5,
          background: "var(--cinema-red)",
          color: "#fbeede",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 20,
          padding: 15,
          borderRadius: 14,
          marginTop: 8,
        }}
      >
        Next — Add the movies →
      </button>
    </div>
  );
}

function ShortlistStep({
  movies,
  filledCount,
  onEditSlot,
  onBack,
  onNext,
}: {
  movies: [Movie, Movie, Movie];
  filledCount: number;
  onEditSlot: (i: 0 | 1 | 2) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const titles = movies.map((m) => m.title.trim().toLowerCase()).filter(Boolean);
  const hasDuplicate = new Set(titles).size !== titles.length;

  return (
    <div style={{ background: "#fbf3e2", borderRadius: 20, padding: "24px 20px", color: "#26170f" }}>
      <button onClick={onBack} style={backLinkStyle}>
        <ChevronLeft size={14} /> Back
      </button>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, margin: "10px 0 4px" }}>
        The shortlist
      </h2>
      <p style={{ fontSize: 13.5, color: "#8a7458", margin: "0 0 18px" }}>Exactly three. Tap a slot to fill it in.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {movies.map((m, i) => (
          <MovieSlotCard
            key={i}
            index={i as 0 | 1 | 2}
            movie={m}
            filled={isMovieFilled(m)}
            onOpen={() => onEditSlot(i as 0 | 1 | 2)}
          />
        ))}
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "#a07b53", marginBottom: 10 }}>
        {filledCount} of 3 added
      </div>

      {hasDuplicate && (
        <div style={{ fontSize: 12.5, color: "var(--cinema-red)", marginBottom: 10 }}>
          Two of these have the same title — probably not what you meant.
        </div>
      )}

      <button
        onClick={onNext}
        disabled={filledCount < 3}
        style={{
          width: "100%",
          border: 0,
          cursor: filledCount < 3 ? "not-allowed" : "pointer",
          opacity: filledCount < 3 ? 0.5 : 1,
          background: "var(--cinema-red)",
          color: "#fbeede",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 20,
          padding: 15,
          borderRadius: 14,
        }}
      >
        {filledCount < 3 ? `Add ${3 - filledCount} more to continue` : "Review →"}
      </button>
    </div>
  );
}

function MovieSlotCard({
  index,
  movie,
  filled,
  onOpen,
}: {
  index: 0 | 1 | 2;
  movie: Movie;
  filled: boolean;
  onOpen: () => void;
}) {
  if (!filled) {
    return (
      <button
        onClick={onOpen}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 64,
          border: "1.5px dashed #cdb488",
          borderRadius: 12,
          background: "rgba(255,255,255,.4)",
          cursor: "pointer",
          color: "#a07b53",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        <Plus size={18} /> Add movie {index + 1}
      </button>
    );
  }
  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        textAlign: "left",
        border: 0,
        cursor: "pointer",
        padding: 10,
        background: "#fffaf0",
        borderRadius: 12,
        boxShadow: "0 0 0 1px rgba(38,23,15,.06)",
      }}
    >
      <div
        style={{
          width: 44,
          height: 56,
          flex: "none",
          borderRadius: 6,
          background: movie.posterBg,
          color: movie.posterFg,
          display: "flex",
          alignItems: "flex-end",
          padding: 5,
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 10,
          lineHeight: 0.9,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {movie.title}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: "#26170f",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {movie.title}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "#8a7458" }}>
          {[movie.year, movie.runtime, movie.genre].filter(Boolean).join(" · ")}
        </div>
      </div>
    </button>
  );
}

function PosterSwatchPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (preset: (typeof POSTER_PRESETS)[number]) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {POSTER_PRESETS.map((p) => {
        const selected = p.bg === value;
        return (
          <button
            key={p.name}
            type="button"
            aria-pressed={selected}
            aria-label={p.name}
            onClick={() => onChange(p)}
            style={{
              position: "relative",
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: p.bg,
              border: selected ? "3px solid var(--cinema-red)" : "1.5px solid #cdb488",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: p.fg,
            }}
          >
            {selected && <Check size={16} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

function MovieEditorSheet({
  movie,
  isDesktop,
  onChange,
  onDone,
}: {
  movie: Movie;
  isDesktop: boolean;
  onChange: (patch: Partial<Movie>) => void;
  onDone: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const sheetStyle: React.CSSProperties = isDesktop
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        width: 480,
        maxHeight: "88vh",
        overflow: "auto",
        background: "#f3e7cf",
        borderRadius: 20,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)",
        zIndex: 61,
      }
    : {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        top: 60,
        background: "#f3e7cf",
        borderRadius: "26px 26px 0 0",
        overflow: "auto",
        boxShadow: "0 -20px 50px -20px rgba(0,0,0,.6)",
        zIndex: 61,
      };

  return (
    <>
      <div className="anim-dim" style={{ position: "fixed", inset: 0, background: "rgba(23,12,8,.55)", zIndex: 60 }} onClick={onDone} />
      <div role="dialog" aria-modal="true" aria-label="Edit movie" className={isDesktop ? undefined : "anim-sheet"} style={sheetStyle}>
        <div
          style={{
            position: "sticky",
            top: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 18px",
            background: movie.posterBg,
            color: movie.posterFg,
            borderRadius: isDesktop ? "20px 20px 0 0" : "26px 26px 0 0",
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{movie.title || "New movie"}</span>
          <button
            ref={closeButtonRef}
            onClick={onDone}
            aria-label="Done editing"
            style={{
              border: 0,
              cursor: "pointer",
              background: "rgba(0,0,0,.25)",
              color: "inherit",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 18 }}>
          <Field id="m-title" label="Title">
            <input id="m-title" style={inputStyle} value={movie.title} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field id="m-year" label="Year">
                <input id="m-year" style={inputStyle} value={movie.year} onChange={(e) => onChange({ year: e.target.value })} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field id="m-runtime" label="Runtime">
                <input
                  id="m-runtime"
                  style={inputStyle}
                  value={movie.runtime}
                  onChange={(e) => onChange({ runtime: e.target.value })}
                  placeholder="1h 32m"
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field id="m-rating" label="Rating">
                <input
                  id="m-rating"
                  style={inputStyle}
                  value={movie.rating ?? ""}
                  onChange={(e) => onChange({ rating: e.target.value })}
                  placeholder="7.6"
                />
              </Field>
            </div>
          </div>
          <Field id="m-genre" label="Genre">
            <input id="m-genre" style={inputStyle} value={movie.genre} onChange={(e) => onChange({ genre: e.target.value })} />
          </Field>
          <Field id="m-mood" label="Mood tag">
            <input
              id="m-mood"
              style={inputStyle}
              value={movie.moodTag}
              onChange={(e) => onChange({ moodTag: e.target.value })}
              placeholder="ODDBALL · DEADPAN"
            />
          </Field>
          <Field id="m-hook" label="One-line hook">
            <input
              id="m-hook"
              style={inputStyle}
              value={movie.hook}
              onChange={(e) => onChange({ hook: e.target.value })}
              placeholder="The line that sells it"
            />
          </Field>
          <Field id="m-director" label="Director">
            <input id="m-director" style={inputStyle} value={movie.director} onChange={(e) => onChange({ director: e.target.value })} />
          </Field>
          <Field id="m-synopsis" label="Synopsis">
            <textarea
              id="m-synopsis"
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              value={movie.synopsis}
              onChange={(e) => onChange({ synopsis: e.target.value })}
            />
          </Field>
          <Field id="m-trailer" label="Trailer search term">
            <input
              id="m-trailer"
              style={inputStyle}
              value={movie.trailerq}
              onChange={(e) => onChange({ trailerq: e.target.value })}
              placeholder="sheep+detectives"
            />
          </Field>
          <Field id="m-poster" label="Poster colour">
            <PosterSwatchPicker value={movie.posterBg} onChange={(preset) => onChange({ posterBg: preset.bg, posterFg: preset.fg })} />
          </Field>
          <button
            onClick={onDone}
            style={{
              width: "100%",
              border: 0,
              cursor: "pointer",
              background: "var(--cinema-red)",
              color: "#fbeede",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 18,
              padding: 14,
              borderRadius: 12,
              marginTop: 6,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}

function ReviewStep({
  isDesktop,
  hostName,
  note,
  eventAt,
  location,
  locationLabel,
  bring,
  movies,
  sending,
  sendError,
  onBack,
  onSend,
  onEditMovie,
}: {
  isDesktop: boolean;
  hostName: string;
  note: string;
  eventAt: Date | null;
  location: string;
  locationLabel: string;
  bring: string;
  movies: [Movie, Movie, Movie];
  sending: boolean;
  sendError: string | null;
  onBack: () => void;
  onSend: () => void;
  onEditMovie: (i: 0 | 1 | 2) => void;
}) {
  const isPast = eventAt !== null && eventAt.getTime() < Date.now();
  return (
    <div
      style={{
        background: "radial-gradient(120% 60% at 50% 0%,#fbf3e2,#f0e3c8)",
        borderRadius: 20,
        padding: "24px 20px 26px",
        color: "#26170f",
      }}
    >
      <button onClick={onBack} style={backLinkStyle}>
        <ChevronLeft size={14} /> Back
      </button>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, margin: "10px 0 16px" }}>Review</h2>

      <p style={{ fontSize: 15.5, lineHeight: 1.55, margin: "0 0 14px" }}>{note}</p>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, textAlign: "right", marginBottom: 18 }}>
        — {hostName}
      </div>

      <div
        style={{
          border: "1.5px dashed #cdb488",
          borderRadius: 14,
          padding: "14px 16px",
          background: "rgba(255,255,255,.5)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <Row label="WHEN" value={eventAt ? formatEventDate(eventAt.toISOString()) : "—"} />
        <Divider />
        <Row
          label="WHERE"
          value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <DiscordIcon /> {locationLabel || location}
            </span>
          }
        />
        <Divider />
        <Row label="BRING" value={bring} />
      </div>

      {isPast && (
        <div style={{ fontSize: 12.5, color: "var(--cinema-red)", marginBottom: 14 }}>
          This date is in the past — the invite will show as expired immediately.
        </div>
      )}

      <div
        style={
          isDesktop
            ? { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }
            : { display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }
        }
      >
        {movies.map((m, i) =>
          isDesktop ? (
            <DesktopMovieCard key={i} movie={m} onOpen={() => onEditMovie(i as 0 | 1 | 2)} />
          ) : (
            <MobileMovieCard key={i} movie={m} onOpen={() => onEditMovie(i as 0 | 1 | 2)} />
          ),
        )}
      </div>

      {sendError && <div style={{ fontSize: 13, color: "var(--cinema-red)", marginBottom: 12 }}>{sendError}</div>}

      <button
        onClick={onSend}
        disabled={sending}
        style={{
          width: "100%",
          border: 0,
          cursor: sending ? "wait" : "pointer",
          background: "var(--cinema-red)",
          color: "#fbeede",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 22,
          padding: 17,
          borderRadius: 14,
          boxShadow: "0 10px 22px -8px rgba(196,54,42,.7)",
        }}
      >
        {sending ? "Sending…" : "Send the invite"}
      </button>
    </div>
  );
}

function SentScreen({
  inviteToken,
  hostToken,
  copied,
  onCopy,
  pushState,
  onEnablePush,
  onBuildAnother,
}: {
  inviteToken: string;
  hostToken: string;
  copied: boolean;
  onCopy: () => void;
  pushState: PushState;
  onEnablePush: () => void;
  onBuildAnother: () => void;
}) {
  const link = `${window.location.origin}/i/${inviteToken}`;
  return (
    <div
      className="anim-rise"
      style={{
        borderRadius: 20,
        padding: "26px 22px",
        background: "radial-gradient(120% 60% at 50% 0%,#2a1712,#170c08)",
        color: "#f3e7cf",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".24em", color: "var(--marquee-gold)" }}>SENT</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, margin: "8px 0 6px", color: "#f7ecd6" }}>
        The invite's out.
      </h2>
      <p style={{ color: "#cdb99a", fontSize: 14, margin: "0 0 20px" }}>Share this link — it works the moment they open it.</p>

      <div
        style={{
          background: "#3a2418",
          borderRadius: 10,
          padding: "12px 14px",
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          wordBreak: "break-all",
          marginBottom: 12,
        }}
      >
        {link}
      </div>

      <button
        onClick={onCopy}
        style={{
          width: "100%",
          border: 0,
          cursor: "pointer",
          background: "var(--cinema-red)",
          color: "#fbeede",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 18,
          padding: 14,
          borderRadius: 12,
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {copied ? (
          <>
            <Check size={16} strokeWidth={3} /> Copied
          </>
        ) : (
          "Copy the link"
        )}
      </button>

      {pushState !== "enabled" && (
        <div style={{ marginBottom: 18, textAlign: "left" }}>
          <PushPrompt state={pushState} onEnable={onEnablePush} />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}>
        <Link to={`/host/${hostToken}`} style={{ color: "var(--marquee-gold)" }}>
          Track it →
        </Link>
        <button
          onClick={onBuildAnother}
          style={{ background: "none", border: 0, cursor: "pointer", color: "#cdb99a", fontSize: 13, textDecoration: "underline" }}
        >
          Build another
        </button>
      </div>
    </div>
  );
}
