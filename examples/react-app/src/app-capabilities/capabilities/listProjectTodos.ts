import { defineCapability } from "ai-capabilities";
import { listProjectTodos, type Todo } from "../../data/projectStore";

export const listProjectTodosCapability = defineCapability<
  { projectId: string },
  { todos: Todo[] }
>({
  id: "projects.todos.list",
  kind: "read",
  displayTitle: "List todos for a project",
  description: "Returns todos associated with a project ordered by recency.",
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
  aliases: ["list todos", "project tasks"],
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  async execute({ projectId }: { projectId: string }) {
    const todos = await listProjectTodos(projectId);
    return { todos };
  },
});
