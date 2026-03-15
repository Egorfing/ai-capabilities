import type { CapabilityRegistry, DefinedCapability } from "ai-capabilities";
import { registerCapabilityDefinitions } from "ai-capabilities";
import { createProjectCapability } from "./capabilities/createProject";
import { listProjectsCapability } from "./capabilities/listProjects";
import { openProjectPageCapability } from "./capabilities/openProjectPage";
import { getProjectCapability } from "./capabilities/getProject";
import { addProjectTodoCapability } from "./capabilities/addProjectTodo";
import { listProjectTodosCapability } from "./capabilities/listProjectTodos";
import { toggleProjectTodoCapability } from "./capabilities/toggleProjectTodo";
import { openProjectsListCapability } from "./capabilities/openProjectsList";

export const exampleCapabilities = [
  createProjectCapability,
  listProjectsCapability,
  openProjectPageCapability,
  openProjectsListCapability,
  getProjectCapability,
  listProjectTodosCapability,
  addProjectTodoCapability,
  toggleProjectTodoCapability,
];

export function registerExampleCapabilities(registry: CapabilityRegistry): void {
  registerCapabilityDefinitions(registry, exampleCapabilities as DefinedCapability[]);
}
