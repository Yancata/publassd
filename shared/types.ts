export type Phase = "lobby" | "masking" | "intro" | "chat" | "vote" | "reveal";

export interface PlayerView {
  uid: string;
  /** Real name — only visible in the lobby and after the reveal. */
  name?: string;
  alias?: string;
  avatar: string;
  color: string;
  online: boolean;
  voted: boolean;
  isGhost?: boolean;
  votesReceived?: number;
  votedFor?: string;
}

export interface RevealView {
  ghostUid: string;
  ejectedUid: string | null;
  humansWin: boolean;
  thoughts: string[];
  ghostMessages: number;
  ghostDms: number;
}

export interface GameView {
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  serverNow: number;
  gameNo: number;
  me: { uid: string; alias?: string; color?: string; avatar?: string } | null;
  players: PlayerView[];
  groupGuid: string | null;
  wardenUid: string;
  prompt: string | null;
  promptNo: number;
  votesCast: number;
  votesNeeded: number;
  myVote: string | null;
  reveal: RevealView | null;
  minPlayers: number;
  llm: string;
}
