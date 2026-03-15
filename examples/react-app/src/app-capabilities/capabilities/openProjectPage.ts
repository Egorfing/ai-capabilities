import { defineCapability } from "ai-capabilities";
import { findProjectByIdOrName } from "../../data/projectStore";

export const openProjectPageCapability = defineCapability({
  id: "navigation.open-project-page",
  kind: "navigation",
  displayTitle: "Open project detail page",
  description: "Navigates the UI to the given project page. The projectId can be an ID (e.g. proj_1) or a project name.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Project ID (e.g. proj_1) or project name" },
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
  async execute({ projectId }: { projectId: string }, ctx) {
    const project = await findProjectByIdOrName(projectId);
    if (!project) {
      ctx?.notify?.warn?.(`Project "${projectId}" not found`);
      throw new Error(`Project "${projectId}" not found`);
    }
    ctx?.router?.navigate?.(`/projects/${project.id}`);
    ctx?.notify?.info?.(`Navigated to ${project.name}`);
    ctx?.ui?.openPanel?.("project-details", { projectId: project.id });
    return { opened: true, projectId: project.id, projectName: project.name };
  },
});
