import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameView } from "../../shared/types";
import { Avatar, useElapsed, useOnce } from "../components/ui";
import { sfx } from "../lib/sfx";

const ALIASES = ["Velvet Fox", "Neon Owl", "Paper Moth", "Static Crow", "Lunar Newt", "Copper Hare", "Glass Heron", "Ember Lynx"];
const GLYPHS = "!<>-_\\/[]{}—=+*^?#01";

function Scramble({ text }: { text: string }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    let frame = 0;
    const t = setInterval(() => {
      frame++;
      setOut(
        text
          .split("")
          .map((ch, i) => (ch === " " || i < frame / 2 ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(""),
      );
      if (frame / 2 > text.length) clearInterval(t);
    }, 35);
    return () => clearInterval(t);
  }, [text]);
  return <span className="mono">{out}</span>;
}

export function Masking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    sfx.whoosh();
    const t = setInterval(() => setI((x) => x + 1), 420);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="screen center masking">
      <div className="masking__ring" />
      <h2>Masking identities</h2>
      <div className="masking__alias">
        <Scramble key={i} text={ALIASES[i % ALIASES.length]} />
      </div>
      <p>Everyone gets a new name and face. Including the one who isn't real.</p>
    </div>
  );
}

export function Intro({ state }: { state: GameView }) {
  const t = useElapsed(state.phaseStartedAt);
  const step = t < 1800 ? 0 : t < 3700 ? 1 : 2;
  useOnce(step === 1, sfx.glitch);
  useOnce(step === 2, sfx.boom);
  const me = state.me;

  return (
    <div className="screen center intro">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.h2 key="a" className="intro__line" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            {state.players.length} players entered the room.
          </motion.h2>
        )}
        {step === 1 && (
          <motion.h2
            key="b"
            className="intro__line glitch glitch--hard"
            data-text="One of them is not human."
            initial={{ opacity: 0, scale: 1.3, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
          >
            One of them is not human.
          </motion.h2>
        )}
        {step === 2 && me?.alias && (
          <motion.div key="c" className="intro__you" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 16 }}>
            <small>Your mask for this round</small>
            <Avatar src={me.avatar!} color={me.color} size={140} glow />
            <h1 style={{ color: me.color }}>{me.alias}</h1>
            <p>Nobody knows it's you. Act human. Find the one who isn't.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
