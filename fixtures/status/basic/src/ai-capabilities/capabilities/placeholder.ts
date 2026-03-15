import { defineCapabilityFromExtracted } from "ai-capabilities";

export const placeholderCapability = defineCapabilityFromExtracted({
  sourceId: "cap.placeholder",
  id: "cap.placeholder",
  displayTitle: "Placeholder",
  description: "Placeholder",
  inputSchema: { type: "object" },
  async execute() {
    throw new Error("TODO: implement cap.placeholder capability");
  },
});
