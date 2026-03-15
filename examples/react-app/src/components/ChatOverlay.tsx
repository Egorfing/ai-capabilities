import { useState } from "react";
import { AiChat } from "./AiChat";

export function ChatOverlay() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="chat-overlay">
      <div className="chat-overlay__header">
        <div>
          <strong>Project assistant</strong>
          <div className="assistant-status">{collapsed ? "Hidden" : "Ready to help"}</div>
        </div>
        <button
          type="button"
          className="chat-overlay__toggle"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? "Open" : "Hide"}
        </button>
      </div>
      <div className="chat-overlay__body" style={{ display: collapsed ? "none" : undefined }}>
        <AiChat />
      </div>
    </div>
  );
}
