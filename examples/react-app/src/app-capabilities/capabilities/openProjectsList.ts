import { defineCapability } from "ai-capabilities";

export const openProjectsListCapability = defineCapability({
  id: "navigation.open-projects-list",
  kind: "navigation",
  displayTitle: "Open the projects list view",
  description: "Navigates back to the main projects list page.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  aliases: ["go to projects", "back to projects"],
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  async execute(_input, ctx) {
    ctx?.router?.navigate?.("/projects");
    ctx?.notify?.info?.("Showing the projects list");
    return { opened: true };
  },
});
