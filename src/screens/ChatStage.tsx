import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCometChatEvents } from "@cometchat/chat-uikit-react";
import type { GameView, PlayerView } from "../../shared/types";
import { api, serverNow, useFx, useNow } from "../lib/api";
import { sfx } from "../lib/sfx";
import { ChatPanel } from "../components/ChatPanel";
import { Avatar, MuteButton, TimerRing, Toasts, TypingDots, useToasts } from "../components/ui";

type TypingMap = Record<string, { where: string; until: number }>;

export function ChatStage({ state }: { state: GameView }) {
  const me = state.me!;
  const [dm, setDm] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [typing, setTyping] = useState<TypingMap>({});
  const [promptCard, setPromptCard] = useState<string | null>(null);
  const toasts = useToasts();
  const now = useNow(250);
  const byUid = Object.fromEntries(state.players.map((p) => [p.uid, p]));
  const others = state.players.filter((p) => p.uid !== me.uid);

  useFx((fx) => {
    if (fx.type === "typing") setTyping((t) => ({ ...t, [fx.uid]: { where: fx.where, until: serverNow() + fx.ms } }));
    if (fx.type === "prompt") {
      setPromptCard(fx.text);
      sfx.bell();
      setTimeout(() => setPromptCard(null), 4200);
    }
  });

  useCometChatEvents(
    (e) => {
      if (e.type !== "message/text-received") return;
      const from = e.message.getSender().getUid();
      setTyping((t) => {
        const n = { ...t };
        delete n[from];
        return n;
      });
      if (e.message.getReceiverType() === "user" && from !== me.uid && dm !== from) {
        setUnread((u) => ({ ...u, [from]: (u[from] ?? 0) + 1 }));
        const p = byUid[from];
        toasts.push(
          <button className="toast__btn" onClick={() => openDm(from)}>
            🔒 <b style={{ color: p?.color }}>{p?.alias ?? "Someone"}</b> whispered to you
          </button>,
        );
        sfx.pop();
      }
    },
    [dm, me.uid, state.players],
  );

  const openDm = (uid: string) => {
    setDm(uid);
    setUnread((u) => ({ ...u, [uid]: 0 }));
  };

  const isTyping = (uid: string, where: string) => {
    const t = typing[uid];
    return !!t && t.until > now && t.where === where;
  };
  const groupTypers = others.filter((p) => isTyping(p.uid, "group"));
  const dmPlayer = dm ? byUid[dm] : null;
  const total = state.phaseEndsAt ? state.phaseEndsAt - state.phaseStartedAt : 0;

  return (
    <div className="screen stage">
      <header className="topbar topbar--stage">
        <div className="brand">
          <span className="brand__ghost">👻</span> GHOST ROOM
        </div>
        <div className="ticker">
          {state.prompt ? (
            <motion.div key={state.promptNo} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <span className="ticker__label">The Warden asks</span> {state.prompt}
            </motion.div>
          ) : (
            <span className="ticker__label">Warm up. Say hi. Watch closely.</span>
          )}
        </div>
        <div className="topbar__right">
          <MuteButton />
          <TimerRing endsAt={state.phaseEndsAt} total={total} label="left" />
        </div>
      </header>

      <div className={`stage__grid ${dm ? "stage__grid--dm" : ""}`}>
        <aside className="roster">
          <div className="me-card" style={{ ["--c" as string]: me.color }}>
            <Avatar src={me.avatar!} color={me.color} size={52} glow />
            <div>
              <small>You are</small>
              <b style={{ color: me.color }}>{me.alias}</b>
            </div>
          </div>
          <div className="roster__title">Suspects · {others.length}</div>
          {others.map((p) => (
            <RosterItem
              key={p.uid}
              p={p}
              typing={isTyping(p.uid, "group")}
              unread={unread[p.uid] ?? 0}
              active={dm === p.uid}
              onClick={() => (dm === p.uid ? setDm(null) : openDm(p.uid))}
            />
          ))}
          <div className="roster__tip">Tip: the AI can't read your DMs. Compare notes privately.</div>
        </aside>

        <main className="room">
          <AnimatePresence>
            {promptCard && (
              <motion.div
                className="prompt-card"
                initial={{ opacity: 0, y: -30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <span>🎙️ The Warden asks</span>
                <h3>{promptCard}</h3>
              </motion.div>
            )}
          </AnimatePresence>
          <ChatPanel
            guid={state.groupGuid}
            placeholder="Say something human…"
            onTyping={() => void api("typing", { uid: me.uid, where: "group" })}
            footer={<TypingBar players={groupTypers} />}
          />
        </main>

        <AnimatePresence>
          {dmPlayer && (
            <motion.section
              key={dmPlayer.uid}
              className="dm"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
              <header className="dm__head" style={{ ["--c" as string]: dmPlayer.color }}>
                <Avatar src={dmPlayer.avatar} color={dmPlayer.color} size={40} />
                <div>
                  <b style={{ color: dmPlayer.color }}>{dmPlayer.alias}</b>
                  <small>🔒 private · only you two can see this</small>
                </div>
                <button className="icon-btn" onClick={() => setDm(null)}>
                  ✕
                </button>
              </header>
              <ChatPanel
                uid={dmPlayer.uid}
                placeholder={`Whisper to ${dmPlayer.alias}…`}
                onTyping={() => void api("typing", { uid: me.uid, where: dmPlayer.uid })}
                footer={<TypingBar players={isTyping(dmPlayer.uid, "dm") ? [dmPlayer] : []} />}
                emptyView={<div className="empty">Ask them something only a human would know.</div>}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
      <Toasts items={toasts.items} />
    </div>
  );
}

function RosterItem({ p, typing, unread, active, onClick }: { p: PlayerView; typing: boolean; unread: number; active: boolean; onClick: () => void }) {
  return (
    <motion.button layout className={`roster__item ${active ? "active" : ""}`} style={{ ["--c" as string]: p.color }} onClick={onClick} whileHover={{ x: 4 }}>
      <Avatar src={p.avatar} color={p.color} size={40} glow={typing} />
      <div className="roster__meta">
        <b style={{ color: p.color }}>{p.alias}</b>
        <small>{typing ? <TypingDots color={p.color} /> : p.online ? "in the room" : "went quiet…"}</small>
      </div>
      <span className="roster__dm">{unread > 0 ? <em>{unread}</em> : "DM"}</span>
    </motion.button>
  );
}

function TypingBar({ players }: { players: PlayerView[] }) {
  return (
    <div className="typing-bar">
      <AnimatePresence>
        {players.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <TypingDots color={players[0].color} />
            <span>
              {players.map((p, i) => (
                <b key={p.uid} style={{ color: p.color }}>
                  {i ? ", " : ""}
                  {p.alias}
                </b>
              ))}{" "}
              {players.length > 1 ? "are" : "is"} typing
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
