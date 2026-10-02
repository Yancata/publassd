import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CometChatProvider } from "@cometchat/chat-uikit-react";
import type { GameView } from "../shared/types";
import { api, useGameState } from "./lib/api";
import { loginAs, seatStore } from "./lib/cometchat";
import { MessageReporter } from "./components/ChatPanel";
import { Lobby } from "./screens/Lobby";
import { Masking, Intro } from "./screens/Intro";
import { ChatStage } from "./screens/ChatStage";
import { VoteStage } from "./screens/Vote";
import { Reveal } from "./screens/Reveal";
import { Fog } from "./components/Fog";

export function App({ llm }: { llm: string }) {
  const [seat, setSeat] = useState(seatStore.get());
  const [chatReady, setChatReady] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = useGameState<GameView>(seat?.uid ?? null);

  // Server restarted or seat was freed: quietly take a seat again.
  useEffect(() => {
    if (!state || !seat || state.me || state.phase !== "lobby") return;
    api("join", { name: seat.name, uid: seat.uid })
      .then((s) => {
        const next = { uid: s.uid, name: s.name };
        seatStore.set(next);
        setSeat(next);
      })
      .catch(() => {
        seatStore.clear();
        setSeat(null);
      });
  }, [state?.me, state?.phase, seat]);

  useEffect(() => {
    if (!seat) return;
    setChatReady(null);
    loginAs(seat.uid)
      .then(() => setChatReady(seat.uid))
      .catch((e) => setError(`CometChat login failed: ${e?.message ?? e}`));
  }, [seat?.uid]);

  const join = async (name: string) => {
    const s = await api("join", { name });
    const next = { uid: s.uid, name: s.name };
    seatStore.set(next);
    setSeat(next);
  };

  if (error) return <div className="screen center error">{error}</div>;
  if (!state) return <Fog />;

  const inRoom = !!(seat && state.me && chatReady === seat.uid);

  const content = (
      <AnimatePresence mode="wait">
        <motion.div
          key={inRoom ? `${state.phase}-${state.gameNo}` : "lobby"}
          className="phase"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.45 }}
        >
          {!inRoom || state.phase === "lobby" ? (
            <Lobby state={state} joined={inRoom} onJoin={join} llm={llm} />
          ) : state.phase === "masking" ? (
            <Masking />
          ) : state.phase === "intro" ? (
            <Intro state={state} />
          ) : state.phase === "chat" ? (
            <ChatStage state={state} />
          ) : state.phase === "vote" ? (
            <VoteStage state={state} />
          ) : (
            <Reveal state={state} />
          )}
        </motion.div>
      </AnimatePresence>
  );

  return (
    <>
      <Fog intensity={state.phase === "chat" || state.phase === "vote" ? 0.45 : 1} />
      {inRoom ? (
        <CometChatProvider theme="dark" config={{ hideReceipts: true }}>
          <MessageReporter uid={seat!.uid} />
          {content}
        </CometChatProvider>
      ) : (
        content
      )}
    </>
  );
}
