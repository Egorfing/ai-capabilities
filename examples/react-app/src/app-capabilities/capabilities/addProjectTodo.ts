import { defineCapability } from "ai-capabilities";
import { addProjectTodo, findProjectByIdOrName, type Todo } from "../../data/projectStore";

export const addProjectTodoCapability = defineCapability<
  { projectId: string; title: string },
  { todo: Todo }
>({
  id: "projects.todos.add",
  kind: "mutation",
  displayTitle: "Add todo to a project",
  description: "Creates a todo item for the specified project. The projectId can be an ID (e.g. proj_1) or a project name.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Project ID (e.g. proj_1) or project name" },
      title: { type: "string", description: "Todo description" },
    },
    required: ["projectId", "title"],
  },
  outputSchema: {
    type: "object",
    properties: {
      todo: {
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
  aliases: ["add todo", "create task"],
  exampleIntents: ["Add a todo for proj_1 to review mockups"],
  policy: {
    visibility: "internal",
    riskLevel: "medium",
    confirmationPolicy: "once",
  },
  async execute({ projectId, title }: { projectId: string; title: string }) {
    const project = await findProjectByIdOrName(projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found`);
    }
    const todo = await addProjectTodo({ projectId: project.id, title });
    return { todo };
  },
});
