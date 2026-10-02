import { motion } from "framer-motion";
import type { GameView } from "../../shared/types";
import { api, useFx } from "../lib/api";
import { sfx } from "../lib/sfx";
import { Avatar, MuteButton, TimerRing } from "../components/ui";

export function VoteStage({ state }: { state: GameView }) {
  const me = state.me!;
  useFx((fx) => fx.type === "vote" && sfx.tick());
  const total = state.phaseEndsAt ? state.phaseEndsAt - state.phaseStartedAt : 0;

  const vote = (uid: string) => {
    sfx.pop();
    void api("vote", { uid: me.uid, target: uid });
  };

  return (
    <div className="screen vote">
      <header className="topbar">
        <div className="brand">
          <span className="brand__ghost">👻</span> GHOST ROOM
        </div>
        <MuteButton />
      </header>
      <motion.div className="vote__head" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <TimerRing endsAt={state.phaseEndsAt} total={total} size={96} />
        <h1>Who is the Ghost?</h1>
        <p>{state.myVote ? "Locked in. You can still change your mind." : "Tap the player you think is the AI."}</p>
      </motion.div>

      <div className="vote__grid">
        {state.players.map((p, i) => {
          const self = p.uid === me.uid;
          const chosen = state.myVote === p.uid;
          return (
            <motion.button
              key={p.uid}
              className={`vote-card ${chosen ? "vote-card--chosen" : ""} ${self ? "vote-card--self" : ""}`}
              style={{ ["--c" as string]: p.color }}
              disabled={self}
              onClick={() => vote(p.uid)}
              initial={{ opacity: 0, y: 40, rotateX: -30 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.08 * i, type: "spring", stiffness: 220, damping: 18 }}
              whileHover={self ? undefined : { y: -6 }}
              whileTap={self ? undefined : { scale: 0.96 }}
            >
              <Avatar src={p.avatar} color={p.color} size={96} glow={chosen} />
              <b style={{ color: p.color }}>{p.alias}</b>
              <small>{self ? "that's you" : p.voted ? "has voted" : "deciding…"}</small>
              {chosen && (
                <motion.span className="stamp" initial={{ scale: 2.4, opacity: 0, rotate: -25 }} animate={{ scale: 1, opacity: 1, rotate: -12 }}>
                  GHOST?
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="pips">
        {Array.from({ length: state.votesNeeded }).map((_, i) => (
          <motion.span key={i} className={`pip ${i < state.votesCast ? "on" : ""}`} animate={i < state.votesCast ? { scale: [1.6, 1] } : {}} />
        ))}
        <span className="pips__label">
          {state.votesCast}/{state.votesNeeded} votes in
        </span>
      </div>
    </div>
  );
}
