import { defineCapability } from "ai-capabilities";
import { toggleProjectTodo, type Todo } from "../../data/projectStore";

export const toggleProjectTodoCapability = defineCapability<
  { todoId: string; completed: boolean },
  { todo: Todo }
>({
  id: "projects.todos.toggle",
  kind: "mutation",
  displayTitle: "Toggle a todo status",
  description: "Marks a todo as completed or reopens it.",
  inputSchema: {
    type: "object",
    properties: {
      todoId: { type: "string", description: "Identifier of the todo item" },
      completed: { type: "boolean", description: "Desired completion state" },
    },
    required: ["todoId", "completed"],
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
  aliases: ["complete todo", "mark task done", "reopen todo"],
  policy: {
    visibility: "internal",
    riskLevel: "medium",
    confirmationPolicy: "once",
  },
  async execute({ todoId, completed }: { todoId: string; completed: boolean }) {
    const todo = await toggleProjectTodo({ todoId, completed });
    return { todo };
  },
});
