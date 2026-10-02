export const ALIASES: { alias: string; color: string }[] = [
  { alias: "Velvet Fox", color: "#ff6b8b" },
  { alias: "Neon Owl", color: "#5eead4" },
  { alias: "Paper Moth", color: "#fbbf24" },
  { alias: "Static Crow", color: "#a78bfa" },
  { alias: "Lunar Newt", color: "#60a5fa" },
  { alias: "Copper Hare", color: "#fb923c" },
  { alias: "Glass Heron", color: "#34d399" },
  { alias: "Ember Lynx", color: "#f472b6" },
  { alias: "Frost Wren", color: "#93c5fd" },
];

/** Questions the Warden asks. Each one is designed to make a machine sound like a machine. */
export const PROMPTS = [
  "What's the last thing you ate? Be specific.",
  "Describe the room you're in using 4 words.",
  "What song is stuck in your head right now?",
  "Name the weirdest thing within arm's reach.",
  "Rate your day 1-10. One line why.",
  "Hot take. Go. Fast.",
  "What's something you're genuinely bad at?",
  "What's the weather doing where you are?",
  "Say something only a human would say.",
  "Who here do you trust the least? One name.",
  "What did you do right before joining this game?",
  "Type the last emoji you used, no cheating.",
  "What's your most useless talent?",
  "Worst food you've ever eaten?",
];

export const FALLBACK = {
  prompt: [
    "cold pizza from last night lol",
    "honestly nothing, i skipped breakfast",
    "messy. way too many cables",
    "idk some song from a tiktok i cant name it",
    "6/10, long day",
    "cereal is a soup. fight me",
    "parallel parking. every time",
    "raining. obviously",
    "my cat is literally sitting on my keyboard",
    "a sock?? why is there a sock here",
  ],
  chat: [
    "wait who said that",
    "lol ok thats sus",
    "nah i believe that one",
    "why is everyone typing so fast",
    "that sounded kinda rehearsed ngl",
    "ok im watching you",
    "hm",
    "that's exactly what a bot would say",
  ],
  defend: ["what lol no", "bro i literally just got here", "ok thats rude", "its not me i swear"],
  dm: ["ok between us... i think it's the quiet one", "lets team up, i trust you", "you noticed that too right?"],
  goodbye: ["gg lol. you almost had me", "gg. that was fun", "ok that was close"],
};
