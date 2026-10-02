// Dev-only visual preview of each screen with fake state: /?preview=lobby|intro|vote|reveal&t=12000
import type { GameView, Phase } from "../shared/types";
import { Lobby } from "./screens/Lobby";
import { Intro, Masking } from "./screens/Intro";
import { VoteStage } from "./screens/Vote";
import { Reveal } from "./screens/Reveal";
import { Fog } from "./components/Fog";

const av = (s: string, c: string) => `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(s)}&backgroundColor=${c}`;
const cast = [
  { uid: "gr-p1", alias: "Velvet Fox", color: "#ff6b8b", name: "Yan" },
  { uid: "gr-p2", alias: "Neon Owl", color: "#5eead4", name: "Maya" },
  { uid: "gr-p5", alias: "Paper Moth", color: "#fbbf24", name: "an AI", ghost: true },
  { uid: "gr-p3", alias: "Static Crow", color: "#a78bfa", name: "Leo" },
];

export function Preview({ phase, t }: { phase: string; t: number }) {
  const inGame = phase !== "lobby";
  const votes: Record<string, string> = { "gr-p1": "gr-p5", "gr-p2": "gr-p5", "gr-p3": "gr-p2", "gr-p5": "gr-p3" };
  const state: GameView = {
    phase: (phase === "masking" ? "masking" : phase) as Phase,
    phaseStartedAt: Date.now() - t,
    phaseEndsAt: phase === "vote" ? Date.now() + 14000 : null,
    serverNow: Date.now(),
    gameNo: 1,
    me: { uid: "gr-p1", alias: "Velvet Fox", color: "#ff6b8b", avatar: av("Velvet Fox", "ff6b8b") },
    players: cast.map((c) => ({
      uid: c.uid,
      alias: inGame ? c.alias : undefined,
      name: !inGame || phase === "reveal" ? c.name : undefined,
      avatar: inGame ? av(c.alias, c.color.slice(1)) : `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${c.name}`,
      color: inGame ? c.color : "#8b5cf6",
      online: true,
      voted: phase === "vote" ? c.uid !== "gr-p3" : false,
      ...(phase === "reveal"
        ? { isGhost: !!c.ghost, votesReceived: Object.values(votes).filter((v) => v === c.uid).length, votedFor: votes[c.uid] }
        : {}),
    })),
    groupGuid: null,
    wardenUid: "gr-warden",
    prompt: "What's the last thing you ate? Be specific.",
    promptNo: 1,
    votesCast: 3,
    votesNeeded: 4,
    myVote: phase === "vote" || phase === "reveal" ? "gr-p5" : null,
    reveal:
      phase === "reveal"
        ? {
            ghostUid: "gr-p5",
            ejectedUid: "gr-p5",
            humansWin: true,
            thoughts: ["owl keeps asking me weirdly specific stuff", "crow is way too calm, pushing suspicion there", "ok fox is onto me"],
            ghostMessages: 14,
            ghostDms: 3,
          }
        : null,
    minPlayers: 2,
    llm: "openai · gpt-4.1-mini",
  };
  return (
    <>
      <Fog />
      <div className="phase">
        {phase === "lobby" ? (
          <Lobby state={state} joined onJoin={async () => {}} llm={state.llm} />
        ) : phase === "masking" ? (
          <Masking />
        ) : phase === "intro" ? (
          <Intro state={state} />
        ) : phase === "vote" ? (
          <VoteStage state={state} />
        ) : (
          <Reveal state={state} />
        )}
      </div>
    </>
  );
}
