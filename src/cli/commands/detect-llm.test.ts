import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectLlmStack, formatDetectionReport } from "./detect-llm.js";

const fixturesRoot = fileURLToPath(new URL("../../../fixtures/detect-llm", import.meta.url));

describe("detect-llm", () => {
  it("detects chat stack components", async () => {
    const projectPath = path.join(fixturesRoot, "chat-app");
    const result = await detectLlmStack(projectPath);
    expect(result.libraries).toContain("openai");
    expect(result.libraries).toContain("@ai-sdk/openai");
    expect(result.chatComponents).toContain("src/components/AiChat.tsx");
    expect(result.agentFiles).toContain("src/agent/localAgent.ts");
    expect(result.recommendation).toBe("extend_existing_chat");

    const text = formatDetectionReport(result, projectPath);
    expect(text).toContain("AI Stack Detection");
    expect(text).toContain("✔ src/components/AiChat.tsx");
  });

  it("detects server endpoints", async () => {
    const projectPath = path.join(fixturesRoot, "server-app");
    const result = await detectLlmStack(projectPath);
    expect(result.libraries).toContain("anthropic");
    expect(result.serverEndpoints).toContain("server/api/chat.ts");
    expect(result.recommendation).toBe("extend_existing_server");
  });
});
