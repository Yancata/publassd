import { createRoot } from "react-dom/client";
import "@cometchat/chat-uikit-react/styles";
import "./styles.css";
import { getConfig } from "./lib/api";
import { initCometChat } from "./lib/cometchat";
import { App } from "./App";
import { Setup } from "./screens/Setup";

const root = createRoot(document.getElementById("root")!);
const params = new URLSearchParams(location.search);

if (import.meta.env.DEV && params.has("preview")) {
  void import("./preview").then(({ Preview }) =>
    root.render(<Preview phase={params.get("preview")!} t={Number(params.get("t") ?? 0)} />),
  );
} else getConfig().then(async (cfg) => {
  if (cfg.missing.length) {
    root.render(<Setup missing={cfg.missing} />);
    return;
  }
  await initCometChat(cfg);
  root.render(<App llm={cfg.llm} />);
});
