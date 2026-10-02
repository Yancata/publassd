import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameView } from "../../shared/types";
import { api } from "../lib/api";
import { sfx } from "../lib/sfx";
import { REC } from "../lib/rec";
import { Avatar, Button, MuteButton } from "../components/ui";

const SEATS = 6;

export function Lobby({ state, joined, onJoin, llm }: { state: GameView; joined: boolean; onJoin: (name: string) => Promise<void>; llm: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const count = state.players.length;
  const prev = useRef(count);
  const inProgress = state.phase !== "lobby";

  useEffect(() => {
    if (count > prev.current) sfx.join();
    prev.current = count;
  }, [count]);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await onJoin(name);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      await api("start");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const needed = Math.max(0, state.minPlayers - count);

  return (
    <div className="screen lobby">
      <header className="topbar">
        <div className="brand">
          <span className="brand__ghost">👻</span> GHOST ROOM
        </div>
        <MuteButton />
      </header>

      <section className="lobby__hero">
        <motion.h1 className="glitch" data-text="One of you is not human." initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          One of you is not human.
        </motion.h1>
        <p className="lobby__sub">
          Chat. Question everyone. Slide into DMs. Then vote out the AI hiding among you — before it fools the whole room.
        </p>
      </section>

      <section className="seats">
        <AnimatePresence>
          {state.players.map((p, i) => (
            <motion.div
              key={p.uid}
              layout
              className={`seat ${p.uid === state.me?.uid ? "seat--me" : ""}`}
              initial={{ opacity: 0, scale: 0.6, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 300, damping: 22, delay: i * 0.03 }}
            >
              <Avatar src={p.avatar} size={72} glow={p.online} />
              <div className="seat__name">{p.name}</div>
              <div className={`seat__status ${p.online ? "on" : ""}`}>{p.uid === state.me?.uid ? "you" : p.online ? "ready" : "away"}</div>
            </motion.div>
          ))}
          {Array.from({ length: Math.max(0, SEATS - count) }).map((_, i) => (
            <motion.div key={`empty-${i}`} layout className="seat seat--empty">
              <div className="seat__hole">?</div>
              <div className="seat__name">empty seat</div>
            </motion.div>
          ))}
          <motion.div key="ghost-seat" layout className="seat seat--ghost" animate={{ opacity: [0.35, 0.8, 0.35] }} transition={{ repeat: Infinity, duration: 3 }}>
            <div className="seat__hole">👻</div>
            <div className="seat__name">reserved</div>
          </motion.div>
        </AnimatePresence>
      </section>

      <section className="lobby__actions">
        {inProgress && !joined ? (
          <div className="card notice">A round is in progress. You'll be able to join when it ends.</div>
        ) : !joined ? (
          <motion.form
            className="join"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <input autoFocus maxLength={18} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button big disabled={busy || !name.trim()}>
              Enter the room
            </Button>
          </motion.form>
        ) : (
          <div className="start">
            <Button big disabled={busy || needed > 0} onClick={start}>
              {needed > 0 ? `Waiting for ${needed} more human${needed > 1 ? "s" : ""}…` : "Start the game"}
            </Button>
            {!REC && (
              <div className="hint">
                Invite friends: open <code>{location.host}</code> in another tab or device.
              </div>
            )}
          </div>
        )}
        {err && <div className="error-text">{err}</div>}
      </section>

      <section className="howto">
        {[
          ["💬", "Talk", "Answer the Warden's questions in the group chat."],
          ["🔒", "Whisper", "DM anyone privately. The AI will DM you too."],
          ["🗳️", "Vote", "When time's up, vote out the Ghost."],
        ].map(([icon, title, text]) => (
          <div className="howto__step" key={title}>
            <span>{icon}</span>
            <b>{title}</b>
            <p>{text}</p>
          </div>
        ))}
      </section>

      <footer className="footer">
        Real-time chat by <b>CometChat</b> · AI: {llm}
      </footer>
    </div>
  );
}
