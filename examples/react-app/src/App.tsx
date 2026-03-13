import { AiChat } from "./components/AiChat.js";

export function App() {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>AI Capabilities Demo</h1>
      <p>
        This chat demonstrates how <code>defineCapability</code>, the runtime, and a simple agent loop fit together.
        Try “Create a project called Analytics”, “List my projects”, or “Open project proj_1”.
      </p>
      <AiChat />
    </div>
  );
}
