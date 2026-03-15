import { defineCapability } from "ai-capabilities";

export const authoredCapability = defineCapability({
  id: "cap.authored",
  kind: "read",
  displayTitle: "Authored",
  description: "Authored cap",
  inputSchema: { type: "object" },
  async execute() {
    return { ok: true };
  },
});
