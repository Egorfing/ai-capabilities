import { defineCapability } from "ai-capabilities";
import { createProject, type Project } from "../../data/projectStore";

export const createProjectCapability = defineCapability<
  { name: string; description?: string },
  Project
>({
  id: "projects.create",
  kind: "mutation",
  displayTitle: "Create workspace project",
  description: "Creates a new workspace project and returns its identifier.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Project name" },
      description: { type: "string", description: "Optional short description" },
    },
    required: ["name"],
  },
  aliases: ["create project", "new project"],
  exampleIntents: ["Create a project called Analytics"],
  policy: {
    visibility: "internal",
    riskLevel: "medium",
    confirmationPolicy: "once",
  },
  async execute({ name, description }: { name: string; description?: string }) {
    return createProject({ name, description });
  },
});
