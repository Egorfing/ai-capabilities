import { defineCapability } from "ai-capabilities";
import { listProjects, type ProjectWithTodos } from "../../data/projectStore";

export const listProjectsCapability = defineCapability<
  { limit?: number },
  { projects: ProjectWithTodos[] }
>({
  id: "projects.list",
  kind: "read",
  displayTitle: "List workspace projects",
  description: "Returns the current set of workspace projects.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", minimum: 1, maximum: 50, default: 10 },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      projects: {
        type: "array",
        items: {
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
  },
  aliases: ["list projects", "show my projects"],
  exampleIntents: ["List the latest projects"],
  policy: {
    visibility: "public",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  execute: async ({ limit = 10 }: { limit?: number }) => {
    const projects = await listProjects();
    return { projects: projects.slice(0, limit) };
  },
});
