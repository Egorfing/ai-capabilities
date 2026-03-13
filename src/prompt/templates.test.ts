import { describe, it, expect } from "vitest";
import { buildBackendPrompt, buildFrontendPrompt, buildImprovementPrompt, buildAllowlistPrompt } from "./templates.js";
import type { AiCapability } from "../types/index.js";

const baseCapability: AiCapability = {
  id: "hook.create-project-mutation",
  kind: "mutation",
  displayTitle: "useCreateProjectMutation",
  description: "useCreateProjectMutation",
  inputSchema: { type: "object", properties: {} },
  userDescription: "",
  sources: [{ type: "manual" }],
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
};

describe("prompt templates", () => {
  it("builds backend prompt with capability data", () => {
    const prompt = buildBackendPrompt(baseCapability);
    expect(prompt).toContain("Backend/API Capability Completion");
    expect(prompt).toContain(baseCapability.id);
    expect(prompt).toContain("defineCapability");
  });

  it("builds frontend prompt with rules", () => {
    const prompt = buildFrontendPrompt({ ...baseCapability, id: "navigation.open-project-page", kind: "navigation" });
    expect(prompt).toContain("Frontend/UI Capability Completion");
    expect(prompt).toContain("ctx.router");
  });

  it("builds improvement prompt", () => {
    const prompt = buildImprovementPrompt(baseCapability);
    expect(prompt).toContain("Capability Improvement");
    expect(prompt).toContain("Findings");
  });

  it("builds allowlist prompt with table", () => {
    const prompt = buildAllowlistPrompt([baseCapability]);
    expect(prompt).toContain("Capability Safety Review");
    expect(prompt).toContain(baseCapability.id);
    expect(prompt).toContain("Safe Reads");
  });
});
