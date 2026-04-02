import {
  CapabilityRegistry,
  CapabilityRuntime,
  defineCapability,
  registerCapabilityDefinitions,
  type AiCapabilitiesManifest,
} from "ai-capabilities";

// ── In-memory store ───────────────────────────────────────────

interface Order {
  id: string;
  status: string;
  total: number;
  currency: string;
}

interface Todo {
  id: string;
  projectId: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

const store = {
  orders: [
    { id: "ord_1001", status: "pending", total: 120.5, currency: "USD" },
    { id: "ord_1002", status: "processing", total: 89.0, currency: "USD" },
    { id: "ord_1003", status: "shipped", total: 45.99, currency: "USD" },
    { id: "ord_1004", status: "pending", total: 240.0, currency: "USD" },
  ] as Order[],

  projects: [
    { id: "proj_1", name: "Launchpad", description: "Marketing launch campaign", createdAt: "2025-03-01T10:00:00Z" },
    { id: "proj_2", name: "Data Warehouse", description: "Analytics data pipeline", createdAt: "2025-03-05T14:00:00Z" },
    { id: "proj_3", name: "Onboarding Revamp", description: "Improve new user onboarding", createdAt: "2025-03-10T09:00:00Z" },
  ] as Project[],

  todos: [
    { id: "todo_1", projectId: "proj_1", title: "Finalize launch brief", completed: true, createdAt: "2025-03-01T10:30:00Z" },
    { id: "todo_2", projectId: "proj_1", title: "Sync with creative team", completed: false, createdAt: "2025-03-02T11:00:00Z" },
    { id: "todo_3", projectId: "proj_2", title: "Define warehouse SLAs", completed: false, createdAt: "2025-03-06T15:00:00Z" },
    { id: "todo_4", projectId: "proj_3", title: "Audit current onboarding emails", completed: false, createdAt: "2025-03-11T08:00:00Z" },
  ] as Todo[],

  nextId: 100,
};

function genId(prefix: string): string {
  return `${prefix}_${(++store.nextId).toString().padStart(4, "0")}`;
}

// ── Order capabilities ────────────────────────────────────────

export const listOrdersCapability = defineCapability({
  id: "api.orders.list-orders",
  kind: "read",
  displayTitle: "List orders",
  description: "Fetch a filtered list of recent orders for the current workspace.",
  aliases: ["show orders", "orders.list"],
  exampleIntents: ["list my latest orders", "show pending orders"],
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["pending", "processing", "shipped", "delivered"],
        description: "Optional status filter",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 10,
        description: "Max number of orders to return",
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string" },
            total: { type: "number" },
            currency: { type: "string" },
          },
          required: ["id", "status", "total", "currency"],
        },
      },
      total: { type: "integer" },
    },
    required: ["items", "total"],
  },
  policy: {
    visibility: "public",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  execute: async (input) => {
    const filtered = input.status
      ? store.orders.filter((o) => o.status === input.status)
      : store.orders;
    const limit = typeof input.limit === "number" ? input.limit : 10;
    return { items: filtered.slice(0, limit), total: filtered.length };
  },
});

// ── Project capabilities ──────────────────────────────────────

export const listProjectsCapability = defineCapability({
  id: "api.projects.list",
  kind: "read",
  displayTitle: "List projects",
  description: "List all projects, optionally limited.",
  aliases: ["show projects", "projects.list"],
  exampleIntents: ["list all projects", "show my projects"],
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Max projects to return" },
    },
  },
  policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
  execute: async (input) => {
    const limit = typeof input.limit === "number" ? input.limit : 10;
    const items = store.projects.slice(0, limit).map((p) => ({
      ...p,
      todoCount: store.todos.filter((t) => t.projectId === p.id).length,
    }));
    return { items, total: store.projects.length };
  },
});

export const getProjectCapability = defineCapability({
  id: "api.projects.get",
  kind: "read",
  displayTitle: "Get project",
  description: "Get a single project by ID or name, including its todos.",
  aliases: ["get project", "project details"],
  exampleIntents: ["show project Launchpad", "get project proj_1"],
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Project ID (e.g. proj_1) or project name" },
    },
    required: ["projectId"],
  },
  policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
  execute: async (input) => {
    const project = store.projects.find(
      (p) => p.id === input.projectId || p.name.toLowerCase() === String(input.projectId).toLowerCase(),
    );
    if (!project) return { error: `Project not found: ${input.projectId}` };
    const todos = store.todos.filter((t) => t.projectId === project.id);
    return { ...project, todos };
  },
});

export const createProjectCapability = defineCapability({
  id: "api.projects.create",
  kind: "mutation",
  displayTitle: "Create project",
  description: "Create a new project with a name and optional description.",
  aliases: ["create project", "new project"],
  exampleIntents: ["create a project called Analytics", "new project: Mobile App"],
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Project name" },
      description: { type: "string", description: "Optional project description" },
    },
    required: ["name"],
  },
  policy: { visibility: "public", riskLevel: "medium", confirmationPolicy: "none" },
  execute: async (input) => {
    const project: Project = {
      id: genId("proj"),
      name: input.name,
      description: input.description ?? "",
      createdAt: new Date().toISOString(),
    };
    store.projects.push(project);
    return project;
  },
});

// ── Todo capabilities ─────────────────────────────────────────

export const listTodosCapability = defineCapability({
  id: "api.projects.todos.list",
  kind: "read",
  displayTitle: "List project todos",
  description: "List all todos for a given project.",
  aliases: ["show todos", "project todos"],
  exampleIntents: ["list todos for Launchpad", "show tasks in proj_1"],
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Project ID or name" },
    },
    required: ["projectId"],
  },
  policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
  execute: async (input) => {
    const project = store.projects.find(
      (p) => p.id === input.projectId || p.name.toLowerCase() === String(input.projectId).toLowerCase(),
    );
    if (!project) return { error: `Project not found: ${input.projectId}` };
    const todos = store.todos.filter((t) => t.projectId === project.id);
    return { projectId: project.id, projectName: project.name, todos, total: todos.length };
  },
});

export const addTodoCapability = defineCapability({
  id: "api.projects.todos.add",
  kind: "mutation",
  displayTitle: "Add todo",
  description: "Add a new todo item to a project.",
  aliases: ["add todo", "create task", "new todo"],
  exampleIntents: ["add todo to Launchpad: Review copy", "create task in proj_2: Write docs"],
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Project ID or name" },
      title: { type: "string", description: "Todo title / description" },
    },
    required: ["projectId", "title"],
  },
  policy: { visibility: "public", riskLevel: "medium", confirmationPolicy: "none" },
  execute: async (input) => {
    const project = store.projects.find(
      (p) => p.id === input.projectId || p.name.toLowerCase() === String(input.projectId).toLowerCase(),
    );
    if (!project) return { error: `Project not found: ${input.projectId}` };
    const todo: Todo = {
      id: genId("todo"),
      projectId: project.id,
      title: input.title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    store.todos.push(todo);
    return todo;
  },
});

export const toggleTodoCapability = defineCapability({
  id: "api.projects.todos.toggle",
  kind: "mutation",
  displayTitle: "Toggle todo",
  description: "Mark a todo as done or reopen it.",
  aliases: ["toggle todo", "complete task", "mark done"],
  exampleIntents: ["mark todo_1 as done", "reopen todo_2"],
  inputSchema: {
    type: "object",
    properties: {
      todoId: { type: "string", description: "Todo ID (e.g. todo_1)" },
      completed: { type: "boolean", description: "Set to true to complete, false to reopen. Toggles if omitted." },
    },
    required: ["todoId"],
  },
  policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
  execute: async (input) => {
    const todo = store.todos.find((t) => t.id === input.todoId);
    if (!todo) return { error: `Todo not found: ${input.todoId}` };
    todo.completed = typeof input.completed === "boolean" ? input.completed : !todo.completed;
    return todo;
  },
});

// ── All capabilities ──────────────────────────────────────────

const allCapabilities = [
  listOrdersCapability,
  listProjectsCapability,
  getProjectCapability,
  createProjectCapability,
  listTodosCapability,
  addTodoCapability,
  toggleTodoCapability,
];

// ── Registry, manifest & runtime builder ──────────────────────

function capToManifestEntry(cap: ReturnType<typeof defineCapability>) {
  return {
    id: cap.id,
    kind: cap.kind ?? "read",
    displayTitle: cap.displayTitle,
    description: cap.description,
    userDescription: cap.userDescription,
    aliases: cap.aliases,
    exampleIntents: cap.exampleIntents,
    inputSchema: cap.inputSchema,
    outputSchema: cap.outputSchema,
    policy: cap.policy,
    tags: ["demo"],
    sources: [{ type: "manual" as const }],
  };
}

export function buildRuntimeAndManifest() {
  const registry = new CapabilityRegistry();
  registerCapabilityDefinitions(registry, allCapabilities);

  const manifest: AiCapabilitiesManifest = {
    manifestVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    app: {
      name: "Express AI Capabilities Demo",
      version: "0.2.0",
      baseUrl: "http://localhost:3000",
    },
    defaults: {
      visibility: "public",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    capabilities: allCapabilities.map(capToManifestEntry),
  };

  const runtime = new CapabilityRuntime({ manifest, registry, mode: "public" });

  return { registry, manifest, runtime };
}
