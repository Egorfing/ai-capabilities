import { defineCapability } from "ai-capabilities";
import { findProjectById } from "../../data/projectStore.js";

export const openProjectPageCapability = defineCapability({
  id: "navigation.open-project-page",
  kind: "navigation",
  displayTitle: "Open project detail page",
  description: "Navigates the UI to the given project page and surfaces a toast notification.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Identifier of the project to open" },
    },
    required: ["projectId"],
  },
  aliases: ["open project", "go to project"],
  exampleIntents: ["Open the Launchpad project page"],
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  async execute({ projectId }, ctx) {
    const project = findProjectById(projectId);
    if (!project) {
      ctx?.notify?.warn?.(`Project ${projectId} not found`);
      return { opened: false };
    }
    ctx?.router?.navigate?.(`/projects/${projectId}`);
    ctx?.notify?.info?.(`Navigated to ${project.name}`);
    ctx?.ui?.openPanel?.("project-details", { projectId });
    return { opened: true, projectId };
  },
});
