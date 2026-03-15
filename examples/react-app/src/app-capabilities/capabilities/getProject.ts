import { defineCapability } from "ai-capabilities";
import { findProjectById, type ProjectWithTodos } from "../../data/projectStore";

export const getProjectCapability = defineCapability<
  { projectId: string },
  { project: ProjectWithTodos }
>({
  id: "projects.get",
  kind: "read",
  displayTitle: "Load a single project with todos",
  description: "Returns a project record along with its todo list.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Identifier of the project" },
    },
    required: ["projectId"],
  },
  outputSchema: {
    type: "object",
    properties: {
      project: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                projectId: { type: "string" },
                title: { type: "string" },
                completed: { type: "boolean" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
  },
  aliases: ["get project", "project details"],
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  async execute({ projectId }: { projectId: string }) {
    const project = await findProjectById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    return { project };
  },
});
