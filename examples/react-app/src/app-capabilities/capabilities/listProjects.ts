import { defineCapability } from "ai-capabilities";
import { listProjects } from "../../data/projectStore.js";

export const listProjectsCapability = defineCapability({
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
  execute: async ({ limit = 10 }) => {
    const projects = listProjects().slice(0, limit);
    return { projects };
  },
});
