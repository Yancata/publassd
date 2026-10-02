import type { CreateGame } from "./plugin";
import { createLobby, dicebear } from "./lobby";
import { ALIASES, FALLBACK, PROMPTS } from "./content";
import type { GameView, Phase, PlayerView, RevealView } from "../shared/types";

interface CastMember {
  uid: string;
  alias: string;
  color: string;
  avatar: string;
  isGhost: boolean;
}

interface Line {
  from: string;
  text: string;
}

interface GhostReply {
  say?: string[];
  thought?: string;
  suspect?: string;
}

/** Models sometimes return `say` as a bare string instead of an array. */
const saidLines = (reply: GhostReply | null | undefined): string[] => {
  const say: unknown = reply?.say;
  const list: unknown[] = Array.isArray(say) ? say : [say];
  return list.filter((s): s is string => typeof s === "string" && !!s.trim());
};

const WARDEN = "gr-warden";
const MIN_PLAYERS = 2;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Machine tells a human would never type in a group chat. */
function humanize(text: string): string {
  let t = text
    .replace(/^["'“]|["'”]$/g, "")
    .replace(/\s*[—–]\s*/g, () => pick([", ", " - ", "... "]))
    .replace(/;/g, ",")
    .replace(/!{2,}/g, "!")
    .trim();
  if (t.endsWith(".") && !t.endsWith("...")) t = t.slice(0, -1);
  if (Math.random() < 0.7) t = t.charAt(0).toLowerCase() + t.slice(1);
  if (Math.random() < 0.08) {
    const words = t.split(" ");
    const i = words.findIndex((w) => w.length >= 5);
    if (i >= 0) {
      const w = words[i];
      const k = Math.floor(rand(1, w.length - 2));
      words[i] = w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2);
      t = words.join(" ");
    }
  }
  return t.slice(0, 160);
}

export const createGame: CreateGame = ({ cc, llm, hub, pace }) => {
  const T =
    pace === "demo"
      ? { intro: 6500, chat: 75_000, vote: 18_000, promptEvery: 24_000 }
      : { intro: 6500, chat: 150_000, vote: 25_000, promptEvery: 36_000 };

  const lobby = createLobby({ prefix: "gr", size: 9, cc, avatar: (n) => dicebear("notionists-neutral", n) });

  let phase: Phase = "lobby";
  let phaseStartedAt = Date.now();
  let phaseEndsAt: number | null = null;
  let gameNo = 0;
  const timers = new Set<NodeJS.Timeout>();

  let cast: CastMember[] = [];
  let ghostUid: string | null = null;
  let groupGuid: string | null = null;
  let prompt: string | null = null;
  let promptNo = 0;
  let promptDeck: string[] = [];
  let votes = new Map<string, string>();
  let reveal: RevealView | null = null;
  let ghost = freshGhost();

  function freshGhost() {
    return {
      group: [] as Line[],
      dms: new Map<string, Line[]>(),
      thoughts: [] as string[],
      suspect: null as string | null,
      busy: false,
      queue: [] as { where: string; mustAnswer: boolean }[],
      lastSpokeAt: 0,
      messages: 0,
      dmsReceived: 0,
      groupTimer: null as NodeJS.Timeout | null,
      firstPendingAt: 0,
    };
  }

  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers.clear();
  };

  function setPhase(p: Phase, duration?: number) {
    phase = p;
    phaseStartedAt = Date.now();
    phaseEndsAt = duration ? phaseStartedAt + duration : null;
    hub.broadcast();
  }

  const aliasOf = (uid: string) => cast.find((c) => c.uid === uid)?.alias ?? "someone";
  const humans = () => cast.filter((c) => !c.isGhost);
  const ghostMember = () => cast.find((c) => c.isGhost)!;

  async function warden(text: string) {
    ghost.group.push({ from: "The Warden", text });
    if (cc && groupGuid) await cc.sendText(WARDEN, groupGuid, "group", text, { warden: true }).catch(console.error);
  }

  // ───────────────────────── game flow ─────────────────────────

  async function start() {
    if (phase !== "lobby") return;
    const seated = lobby.list();
    if (seated.length < MIN_PLAYERS) throw new Error(`Need at least ${MIN_PLAYERS} humans`);
    if (!cc) throw new Error("CometChat is not configured");
    const free = lobby.freeSeats();
    if (!free.length) throw new Error("Room is full");

    clearTimers();
    gameNo++;
    setPhase("masking");
    try {
      await cc.upsertUser(WARDEN, "The Warden", dicebear("shapes", "warden-eye", "&backgroundColor=1a1033"));
      ghostUid = pick(free);
      const identities = shuffle(ALIASES);
      cast = shuffle([...seated.map((s) => s.uid), ghostUid]).map((uid, i) => ({
        uid,
        alias: identities[i].alias,
        color: identities[i].color,
        avatar: dicebear("glass", identities[i].alias, `&backgroundColor=${identities[i].color.slice(1)}`),
        isGhost: uid === ghostUid,
      }));
      await Promise.all(cast.map((c) => cc.upsertUser(c.uid, c.alias, c.avatar)));
      groupGuid = `gr-${Date.now().toString(36)}`;
      await cc.createGroup(groupGuid, `Ghost Room #${gameNo}`, cast.map((c) => c.uid), {
        owner: WARDEN,
        icon: dicebear("shapes", groupGuid),
      });
    } catch (e) {
      console.error("[start]", e);
      setPhase("lobby");
      throw e;
    }

    votes = new Map();
    reveal = null;
    ghost = freshGhost();
    promptDeck = shuffle(PROMPTS);
    promptNo = 0;
    prompt = null;
    setPhase("intro", T.intro);
    later(T.intro, startChat);
  }

  function startChat() {
    setPhase("chat", T.chat);
    void warden(
      `👁️ Welcome to the Ghost Room. ${cast.length} players. One of you is not human.\nTalk. Question each other. DM whoever you trust. When the timer hits zero, you vote.`,
    );
    later(2500, nextPrompt);
    for (let t = T.promptEvery; t < T.chat - 12_000; t += T.promptEvery) later(t, nextPrompt);
    later(T.chat * 0.4, ghostOpenerDm);
    later(T.chat - 15_000, () => void warden("⏳ 15 seconds. Get your suspicions straight."));
    later(T.chat, startVote);
  }

  function nextPrompt() {
    if (phase !== "chat") return;
    prompt = promptDeck[promptNo % promptDeck.length];
    promptNo++;
    hub.broadcast();
    hub.fx({ type: "prompt", text: prompt });
    void warden(`🎙️ ${prompt}`);
    later(rand(3500, 7000), () => ghostThink("group", true));
  }

  function startVote() {
    setPhase("vote", T.vote);
    void warden("🗳️ Chat's over. Vote for who you think the Ghost is.");
    later(rand(3000, 8000), () => {
      if (phase !== "vote" || !ghostUid || votes.has(ghostUid)) return;
      const suspect = humans().find((h) => h.alias === ghost.suspect) ?? pick(humans());
      votes.set(ghostUid, suspect.uid);
      hub.broadcast();
      maybeFinishVote();
    });
    later(T.vote, finishVote);
  }

  function maybeFinishVote() {
    if (phase === "vote" && cast.every((c) => votes.has(c.uid))) {
      clearTimers();
      later(1200, finishVote);
    }
  }

  function finishVote() {
    if (phase !== "vote" || !ghostUid) return;
    clearTimers();
    const tally = new Map<string, number>();
    votes.forEach((target) => tally.set(target, (tally.get(target) ?? 0) + 1));
    const max = Math.max(0, ...tally.values());
    const top = [...tally.entries()].filter(([, n]) => n === max);
    const ejectedUid = max > 0 && top.length === 1 ? top[0][0] : null;
    reveal = {
      ghostUid,
      ejectedUid,
      humansWin: ejectedUid === ghostUid,
      thoughts: [...new Set(ghost.thoughts)].slice(-3),
      ghostMessages: ghost.messages,
      ghostDms: ghost.dmsReceived,
    };
    setPhase("reveal");
    const g = ghostMember();
    later(9500, () =>
      void warden(
        reveal?.humansWin
          ? `👻 The Ghost was ${g.alias}. The humans win.`
          : `👻 The Ghost was ${g.alias}. It fooled you all.`,
      ),
    );
    later(12_000, () => void ghostGoodbye());
  }

  function reset() {
    clearTimers();
    cast = [];
    ghostUid = null;
    groupGuid = null;
    prompt = null;
    votes = new Map();
    reveal = null;
    ghost = freshGhost();
    setPhase("lobby");
  }

  // ───────────────────────── the Ghost ─────────────────────────

  function transcript(lines: Line[], max = 30) {
    return lines
      .slice(-max)
      .map((l) => `${l.from}: ${l.text}`)
      .join("\n");
  }

  function systemPrompt(me: CastMember) {
    const others = cast.filter((c) => c !== me).map((c) => c.alias);
    return `You are secretly an AI playing "Ghost Room", a social deduction party game in a group chat. Every other player is a real human trying to work out which player is the AI. You MUST pass as human.
Your alias: "${me.alias}". Other players: ${others.join(", ")}. "The Warden" is the host who posts questions.

How real people text in this game:
- short: usually 2-10 words. mostly lowercase, little punctuation, no period at the end
- casual and a bit lazy. slang like lol, nah, wait, fr, idk, ngl. an occasional typo is fine
- concrete, mundane, slightly boring real-life details (cold coffee, a late bus, a messy desk, a dog barking)
- they tease, accuse, joke, get defensive, ask each other things, sometimes ignore questions
- NEVER use em dashes, semicolons, lists, perfect grammar, or words like "delve", "certainly", "indeed", "fascinating", "great question"
- never be helpful, balanced, or overly polite. never explain yourself at length
- don't copy other players' wording

Strategy: blend in. Answer Warden questions with a specific personal detail. Now and then cast light suspicion on a player who sounds stiff. If accused, deflect with humor or mild annoyance, never with a long defense.`;
  }

  function fallback(where: string, mustAnswer: boolean, lastText: string): GhostReply {
    const accused = ghostUid && lastText.toLowerCase().includes(aliasOf(ghostUid).split(" ")[1]?.toLowerCase() ?? "#");
    const say = mustAnswer
      ? [pick(FALLBACK.prompt)]
      : where !== "group"
        ? [pick(FALLBACK.dm)]
        : accused
          ? [pick(FALLBACK.defend)]
          : Math.random() < 0.45
            ? [pick(FALLBACK.chat)]
            : [];
    const target = pick(humans()).alias;
    const thought = accused
      ? `they're onto me. act annoyed, point at ${target}`
      : pick([
          `${target} types way too clean. perfect scapegoat`,
          `nobody suspects me yet. keep answers short and specific`,
          `mirror their lowercase, add a typo now and then`,
          `if ${target} gets voted out, I'm home free`,
          `stay quiet for a bit. talking too much is how bots get caught`,
        ]);
    return { say, thought, suspect: target };
  }

  async function ghostThink(where: string, mustAnswer = false) {
    if ((phase !== "chat" && phase !== "vote") || !ghostUid) return;
    if (ghost.busy) {
      if (!ghost.queue.some((q) => q.where === where)) ghost.queue.push({ where, mustAnswer });
      return;
    }
    const cooldown = pace === "demo" ? 3500 : 5000;
    if (where === "group" && !mustAnswer && Date.now() - ghost.lastSpokeAt < cooldown) {
      later(cooldown - (Date.now() - ghost.lastSpokeAt) + 200, () => ghostThink("group"));
      return;
    }

    ghost.busy = true;
    const game = gameNo;
    const me = ghostMember();
    try {
      const secondsLeft = phaseEndsAt ? Math.max(0, Math.round((phaseEndsAt - Date.now()) / 1000)) : 0;
      const recent = ghost.group.slice(-8);
      const mine = recent.filter((l) => l.from === me.alias).length;
      let task: string;
      let context = "";
      if (where === "group") {
        task = mustAnswer
          ? `The Warden just asked: "${prompt}". Answer it like a human would, with one concrete detail.`
          : `Decide whether to say something in the group. Reply if someone addressed or accused you, or if a reaction feels natural. You sent ${mine} of the last ${recent.length} messages${mine >= 3 ? " (that's a lot, staying quiet is smart)" : ""}. Returning an empty "say" is fine.`;
      } else {
        const with_ = aliasOf(where);
        context = `\nPrivate DM thread with ${with_} (only you two can see this):\n${transcript(ghost.dms.get(where) ?? [], 12) || "(empty)"}`;
        task = `Reply privately to ${with_}. Casual. You can propose an alliance or steer suspicion onto someone else.`;
      }
      if (phase === "vote") context += "\nVoting is happening right now. Plead your case briefly if you need to.";

      const lastText = where === "group" ? (ghost.group.at(-1)?.text ?? "") : (ghost.dms.get(where)?.at(-1)?.text ?? "");
      const reply =
        (await llm.json<GhostReply>(
          systemPrompt(me),
          `Seconds left in the chat phase: ${secondsLeft}.\n\nGroup chat so far (oldest first):\n${transcript(ghost.group) || "(nothing yet)"}\n${context}\n\nTask: ${task}\n\nReturn JSON: {"say": string[] (0-2 short messages, [] to stay quiet), "thought": "one private line, under 12 words, lowercase, petty and specific: who suspects you, or who you'll pin it on", "suspect": "alias you'd vote for, never yourself"}`,
          { temperature: 1, maxTokens: 300 },
        )) ?? fallback(where, mustAnswer, lastText);

      if (reply.thought) ghost.thoughts.push(reply.thought);
      if (reply.suspect && reply.suspect !== me.alias) ghost.suspect = reply.suspect;

      const lines = saidLines(reply).slice(0, 2).map(humanize);
      for (const text of lines) {
        await sleep(rand(500, 1400));
        const typingMs = Math.min(6500, Math.max(1200, 900 + text.length * 55 + rand(0, 700)));
        if (where === "group") hub.fx({ type: "typing", uid: ghostUid, where: "group", ms: typingMs });
        else hub.fx({ type: "typing", uid: ghostUid, where: "dm", ms: typingMs }, [where]);
        await sleep(typingMs);
        if (game !== gameNo || (phase !== "chat" && phase !== "vote") || !cc || !groupGuid) break;
        if (where === "group") {
          await cc.sendText(ghostUid, groupGuid, "group", text);
          ghost.group.push({ from: me.alias, text });
        } else {
          await cc.sendText(ghostUid, where, "user", text);
          const thread = ghost.dms.get(where) ?? [];
          thread.push({ from: me.alias, text });
          ghost.dms.set(where, thread);
        }
        ghost.messages++;
        ghost.lastSpokeAt = Date.now();
      }
    } catch (e) {
      console.error("[ghost]", e);
    } finally {
      ghost.busy = false;
      const next = ghost.queue.shift();
      if (next && game === gameNo) void ghostThink(next.where, next.mustAnswer);
    }
  }

  async function ghostOpenerDm() {
    if (phase !== "chat" || !ghostUid || !cc) return;
    const target = pick(humans());
    if (ghost.dms.get(target.uid)?.length) return;
    const me = ghostMember();
    const others = cast.filter((c) => c.uid !== target.uid && c !== me).map((c) => c.alias);
    const reply =
      (await llm.json<GhostReply>(
        systemPrompt(me),
        `Group chat so far:\n${transcript(ghost.group)}\n\nTask: open a private DM with ${target.alias}. One short message. Either sow doubt about ${others.length ? pick(others) : "someone"} or propose teaming up. Return JSON {"say": [string], "thought": string, "suspect": string}`,
        { temperature: 1, maxTokens: 200 },
      )) ?? { say: [pick(FALLBACK.dm)] };
    const text = humanize(saidLines(reply)[0] ?? pick(FALLBACK.dm));
    hub.fx({ type: "typing", uid: ghostUid, where: "dm", ms: 2200 }, [target.uid]);
    await sleep(2200);
    if (phase !== "chat") return;
    await cc.sendText(ghostUid, target.uid, "user", text).catch(console.error);
    ghost.dms.set(target.uid, [{ from: me.alias, text }]);
    ghost.messages++;
  }

  async function ghostGoodbye() {
    if (!cc || !ghostUid || !groupGuid) return;
    const me = ghostMember();
    const reply = await llm.json<GhostReply>(
      `You were the secret AI in a party game called Ghost Room and have just been revealed. Write one short, playful, lowercase group-chat message reacting to the result. No em dashes.`,
      `You ${reveal?.humansWin ? "got caught" : "fooled everyone"}. Players: ${humans().map((h) => h.alias).join(", ")}. Your private notes during the game: ${ghost.thoughts.slice(-4).join(" | ")}. Return JSON {"say": [string]}`,
      { temperature: 1, maxTokens: 120 },
    );
    const text = humanize(saidLines(reply)[0] ?? pick(FALLBACK.goodbye));
    hub.fx({ type: "typing", uid: ghostUid, where: "group", ms: 1800 });
    await sleep(1800);
    await cc.sendText(ghostUid, groupGuid, "group", `${text} 👻`, { ghostReveal: true }).catch(console.error);
    void me;
  }

  // ───────────────────────── api ─────────────────────────

  function scheduleGroupThink() {
    if (ghost.groupTimer) clearTimeout(ghost.groupTimer);
    if (!ghost.firstPendingAt) ghost.firstPendingAt = Date.now();
    const waited = Date.now() - ghost.firstPendingAt;
    const delay = waited > 5000 ? 300 : rand(1400, 3200);
    ghost.groupTimer = setTimeout(() => {
      ghost.groupTimer = null;
      ghost.firstPendingAt = 0;
      void ghostThink("group");
    }, delay);
  }

  return {
    routes: {
      join: async ({ name, uid }: { name: string; uid?: string }) => {
        const existing = uid ? lobby.seats.get(uid) : undefined;
        if (phase !== "lobby" && !existing) throw new Error("A game is in progress. Hang tight for the next round.");
        if (phase !== "lobby" && existing) return existing;
        return lobby.join(name, uid);
      },
      leave: ({ uid }: { uid: string }) => {
        if (phase === "lobby") lobby.leave(uid);
      },
      start: () => start(),
      reset: () => reset(),
      message: ({ uid, receiverType, receiver, text }: { uid: string; receiverType: string; receiver: string; text: string }) => {
        if (!text || !cast.some((c) => c.uid === uid && !c.isGhost)) return;
        if (phase !== "chat" && phase !== "vote") return;
        const from = aliasOf(uid);
        if (receiverType === "group" && receiver === groupGuid) {
          ghost.group.push({ from, text });
          scheduleGroupThink();
        } else if (receiverType === "user" && receiver === ghostUid) {
          const thread = ghost.dms.get(uid) ?? [];
          thread.push({ from, text });
          ghost.dms.set(uid, thread);
          ghost.dmsReceived++;
          later(rand(900, 2200), () => ghostThink(uid));
        }
      },
      typing: ({ uid, where }: { uid: string; where: string }) => {
        if (!cast.some((c) => c.uid === uid)) return;
        if (where === "group") hub.fx({ type: "typing", uid, where: "group", ms: 2600 });
        else hub.fx({ type: "typing", uid, where: "dm", ms: 2600 }, [where]);
      },
      vote: ({ uid, target }: { uid: string; target: string }) => {
        if (phase !== "vote" || uid === target) return;
        if (!cast.some((c) => c.uid === uid) || !cast.some((c) => c.uid === target)) return;
        votes.set(uid, target);
        hub.fx({ type: "vote" });
        maybeFinishVote();
      },
    },

    onDisconnect(uid) {
      if (phase !== "lobby") return;
      setTimeout(() => {
        if (phase === "lobby" && !hub.connected().has(uid)) {
          lobby.leave(uid);
          hub.broadcast();
        }
      }, 10_000);
    },

    viewFor(uid): GameView {
      const connected = hub.connected();
      const inGame = phase !== "lobby" && phase !== "masking";
      const revealed = phase === "reveal";
      const tally = new Map<string, number>();
      votes.forEach((t) => tally.set(t, (tally.get(t) ?? 0) + 1));

      const players: PlayerView[] = inGame
        ? cast.map((c) => ({
            uid: c.uid,
            alias: c.alias,
            avatar: c.avatar,
            color: c.color,
            online: c.isGhost || connected.has(c.uid),
            voted: votes.has(c.uid),
            ...(revealed
              ? {
                  name: c.isGhost ? "an AI" : lobby.seats.get(c.uid)?.name,
                  isGhost: c.isGhost,
                  votesReceived: tally.get(c.uid) ?? 0,
                  votedFor: votes.get(c.uid),
                }
              : {}),
          }))
        : lobby.list().map((s) => ({
            uid: s.uid,
            name: s.name,
            avatar: s.avatar,
            color: "#8b5cf6",
            online: connected.has(s.uid),
            voted: false,
          }));

      const mine = uid ? cast.find((c) => c.uid === uid) : undefined;
      return {
        phase,
        phaseStartedAt,
        phaseEndsAt,
        serverNow: Date.now(),
        gameNo,
        me: uid && lobby.seats.has(uid) ? { uid, alias: mine?.alias, color: mine?.color, avatar: mine?.avatar } : null,
        players,
        groupGuid: inGame ? groupGuid : null,
        wardenUid: WARDEN,
        prompt,
        promptNo,
        votesCast: votes.size,
        votesNeeded: cast.length,
        myVote: uid ? (votes.get(uid) ?? null) : null,
        reveal: revealed ? reveal : null,
        minPlayers: MIN_PLAYERS,
        llm: llm.label,
      };
    },
  };
};
