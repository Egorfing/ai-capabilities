import type { CapabilityRegistry } from "ai-capabilities";
import { registerCapabilityDefinitions } from "ai-capabilities";
import { createProjectCapability } from "./capabilities/createProject.js";
import { listProjectsCapability } from "./capabilities/listProjects.js";
import { openProjectPageCapability } from "./capabilities/openProjectPage.js";

export const exampleCapabilities = [
  createProjectCapability,
  listProjectsCapability,
  openProjectPageCapability,
];

export function registerExampleCapabilities(registry: CapabilityRegistry): void {
  registerCapabilityDefinitions(registry, exampleCapabilities);
}
