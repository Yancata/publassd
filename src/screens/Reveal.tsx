import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import type { GameView, PlayerView } from "../../shared/types";
import { api } from "../lib/api";
import { sfx } from "../lib/sfx";
import { ChatPanel } from "../components/ChatPanel";
import { Avatar, Button, MuteButton, useElapsed, useOnce } from "../components/ui";

// Beats of the reveal, in ms since the phase started. Every tab plays it in sync.
const BEAT = { tally: 2200, spotlight: 5600, flip: 8600, unmask: 10_200, verdict: 11_200, epilogue: 13_000 };

export function Reveal({ state }: { state: GameView }) {
  const t = useElapsed(state.phaseStartedAt, 80);
  const r = state.reveal!;
  const players = state.players;
  const ejected = players.find((p) => p.uid === r.ejectedUid) ?? null;
  const ghost = players.find((p) => p.isGhost)!;
  const iWasRight = state.myVote === r.ghostUid;
  const [showChat, setShowChat] = useState(false);

  useOnce(t >= BEAT.tally, sfx.whoosh);
  useOnce(t >= BEAT.spotlight, useCallback(() => sfx.drumroll(2.8), []));
  useOnce(t >= BEAT.flip, ejected?.isGhost ? sfx.boom : sfx.glitch);
  useOnce(t >= BEAT.unmask, sfx.glitch);
  useOnce(
    t >= BEAT.verdict,
    useCallback(() => {
      if (r.humansWin) {
        sfx.win();
        const colors = players.map((p) => p.color);
        confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 }, colors });
        setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0 }, colors }), 250);
        setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1 }, colors }), 400);
      } else sfx.lose();
    }, [r.humansWin, players]),
  );

  const maxVotes = Math.max(1, ...players.map((p) => p.votesReceived ?? 0));

  return (
    <div className={`screen reveal ${t >= BEAT.verdict && !r.humansWin ? "reveal--lost" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand__ghost">👻</span> GHOST ROOM
        </div>
        <MuteButton />
      </header>

      <div className="reveal__title">
        <AnimatePresence mode="wait">
          {t < BEAT.spotlight ? (
            <motion.h1 key="in" initial={{ opacity: 0, scale: 1.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              The votes are in
            </motion.h1>
          ) : t < BEAT.flip ? (
            <motion.h1 key="out" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {ejected ? (
                <>
                  The room voted out… <span style={{ color: ejected.color }}>{ejected.alias}</span>
                </>
              ) : (
                "A tie. Nobody was voted out…"
              )}
            </motion.h1>
          ) : t < BEAT.verdict ? (
            <motion.h1 key="was" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              {ejected ? (ejected.isGhost ? "…and they were the Ghost." : "…and they were human.") : "…so the Ghost walks free."}
            </motion.h1>
          ) : (
            <motion.h1
              key="verdict"
              className={`verdict ${r.humansWin ? "verdict--win" : "verdict--lose glitch glitch--hard"}`}
              data-text={r.humansWin ? "HUMANS WIN" : "THE GHOST WINS"}
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 14 }}
            >
              {r.humansWin ? "HUMANS WIN" : "THE GHOST WINS"}
            </motion.h1>
          )}
        </AnimatePresence>
        {t >= BEAT.verdict && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="reveal__you">
            {iWasRight ? "You spotted it. Nice instincts." : "It got past you this time."}
          </motion.p>
        )}
      </div>

      <div className="reveal__row">
        {players.map((p, i) => (
          <RevealCard
            key={p.uid}
            p={p}
            index={i}
            t={t}
            spotlight={t >= BEAT.spotlight && t < BEAT.unmask && (ejected ? p.uid === ejected.uid : false)}
            dim={t >= BEAT.spotlight && t < BEAT.unmask && !!ejected && p.uid !== ejected.uid}
            flipped={(t >= BEAT.flip && p.uid === ejected?.uid) || t >= BEAT.unmask}
            barFrac={(p.votesReceived ?? 0) / maxVotes}
            voters={players.filter((v) => v.votedFor === p.uid)}
          />
        ))}
      </div>

      {t >= BEAT.epilogue && (
        <motion.div className="epilogue" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <div className="monologue card">
            <div className="monologue__head">
              <Avatar src={ghost.avatar} color={ghost.color} size={44} />
              <div>
                <b style={{ color: ghost.color }}>{ghost.alias}</b>
                <small>the Ghost's private thoughts during the game</small>
              </div>
            </div>
            {r.thoughts.length ? (
              r.thoughts.map((th, i) => (
                <motion.blockquote key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.6 }}>
                  “{th}”
                </motion.blockquote>
              ))
            ) : (
              <blockquote>“…”</blockquote>
            )}
            <div className="monologue__stats">
              <span>
                <b>{r.ghostMessages}</b> messages sent
              </span>
              <span>
                <b>{r.ghostDms}</b> DMs received
              </span>
            </div>
          </div>
          <div className="epilogue__actions">
            <Button big onClick={() => void api("reset")}>
              Play again
            </Button>
            <Button variant="ghost" onClick={() => setShowChat((s) => !s)}>
              {showChat ? "Hide chat" : "Read the chat"}
            </Button>
          </div>
          {showChat && (
            <div className="epilogue__chat card">
              <ChatPanel guid={state.groupGuid} readOnly />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function RevealCard({
  p,
  index,
  t,
  spotlight,
  dim,
  flipped,
  barFrac,
  voters,
}: {
  p: PlayerView;
  index: number;
  t: number;
  spotlight: boolean;
  dim: boolean;
  flipped: boolean;
  barFrac: number;
  voters: PlayerView[];
}) {
  const showTally = t >= BEAT.tally;
  return (
    <motion.div
      className={`rcard ${spotlight ? "rcard--spot" : ""} ${dim ? "rcard--dim" : ""}`}
      style={{ ["--c" as string]: p.color }}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: dim ? 0.35 : 1, y: spotlight ? -18 : 0, scale: spotlight ? 1.12 : 1 }}
      transition={{ delay: t < 1000 ? index * 0.1 : 0, type: "spring", stiffness: 200, damping: 20 }}
    >
      <motion.div className="rcard__inner" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}>
        <div className="rcard__face rcard__front">
          <Avatar src={p.avatar} color={p.color} size={84} />
          <b style={{ color: p.color }}>{p.alias}</b>
          <div className="rcard__votes">
            {showTally &&
              voters.map((v, i) => (
                <motion.span key={v.uid} initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 * i + index * 0.12 }}>
                  <Avatar src={v.avatar} color={v.color} size={22} />
                </motion.span>
              ))}
          </div>
          <div className="rcard__bar">
            <motion.i initial={{ width: 0 }} animate={{ width: showTally ? `${barFrac * 100}%` : 0 }} transition={{ duration: 0.9, delay: index * 0.12 }} />
          </div>
        </div>
        <div className={`rcard__face rcard__back ${p.isGhost ? "rcard__back--ghost" : ""}`}>
          {p.isGhost ? (
            <>
              <div className="rcard__ghost glitch glitch--hard" data-text="AI">
                AI
              </div>
              <b>👻 the Ghost</b>
            </>
          ) : (
            <>
              <div className="rcard__human">HUMAN</div>
              <b>{p.name}</b>
            </>
          )}
          <small>was {p.alias}</small>
        </div>
      </motion.div>
    </motion.div>
  );
}
