import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChatOverlay } from "./ChatOverlay";

interface Props {
  children: ReactNode;
}

export function AppLayout({ children }: Props) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div>
          <h1>AI Capabilities Demo</h1>
          <p className="app-shell__header-desc">
            Drive UI flows and API actions via capabilities, a runtime, and an assistant overlay.
          </p>
        </div>
        <nav>
          <Link to="/projects">Projects</Link>
          <Link to="/projects/proj_1">Sample Project</Link>
        </nav>
      </header>
      <main className="app-shell__main">{children}</main>
      <ChatOverlay />
    </div>
  );
}
