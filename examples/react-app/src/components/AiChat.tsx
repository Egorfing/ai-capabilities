import { useMemo, useState } from "react";
import { createExampleRuntime } from "../agent/runtime.js";
import { createLocalAgent, type ChatMessage } from "../agent/localAgent.js";

export function AiChat() {
  const runtime = useMemo(
    () =>
      createExampleRuntime({
        router: { navigate: (path) => console.log(`[router] navigate to ${path}`) },
        ui: { openPanel: (id, payload) => console.log(`[ui] open ${id}`, payload) },
        notify: { info: (msg) => console.log(`[notify] ${msg}`), warn: (msg) => console.warn(msg) },
      }),
    [],
  );
  const agent = useMemo(() => createLocalAgent(runtime), [runtime]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsRunning(true);
    const result = await agent.handleUserMessage(userMessage.content);
    const assistantMessage: ChatMessage = { role: "assistant", content: result.reply };
    setMessages((prev) => [...prev, assistantMessage]);
    setIsRunning(false);
  }

  return (
    <div className="ai-chat">
      <div className="ai-chat__messages">
        {messages.map((message, index) => (
          <div key={index} className={`ai-chat__message ai-chat__message--${message.role}`}>
            <strong>{message.role === "user" ? "You" : "AI"}:</strong> {message.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="ai-chat__form">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask to create/list/open a project"
          disabled={isRunning}
        />
        <button type="submit" disabled={isRunning}>
          {isRunning ? "Thinking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
