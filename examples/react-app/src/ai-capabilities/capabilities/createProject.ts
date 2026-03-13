import { defineCapability } from "ai-capabilities";
import { createProject } from "../../data/projectStore.js";

export const createProjectCapability = defineCapability({
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
  async execute({ name, description }) {
    return createProject({ name, description });
  },
});
