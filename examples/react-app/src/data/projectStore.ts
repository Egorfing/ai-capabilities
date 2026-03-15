const DEFAULT_API_BASE_URL = "http://localhost:4001";

export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};

export type Todo = {
  id: string;
  projectId: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

export type ProjectWithTodos = Project & {
  todos?: Todo[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}): ${errorText || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listProjects(): Promise<ProjectWithTodos[]> {
  return apiFetch<ProjectWithTodos[]>(
    "/projects?_sort=-createdAt&_embed=todos",
  );
}

export async function createProject(input: { name: string; description?: string }): Promise<Project> {
  const project: Project = {
    id: generateProjectId(),
    name: input.name,
    description: input.description,
    createdAt: new Date().toISOString(),
  };
  return apiFetch<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(project),
  });
}

export async function findProjectById(projectId: string): Promise<ProjectWithTodos | undefined> {
  try {
    return await apiFetch<ProjectWithTodos>(`/projects/${projectId}?_embed=todos`);
  } catch (error) {
    console.warn(`Failed to load project ${projectId}`, error);
    return undefined;
  }
}

export async function findProjectByIdOrName(idOrName: string): Promise<ProjectWithTodos | undefined> {
  const byId = await findProjectById(idOrName);
  if (byId) return byId;
  const all = await listProjects();
  return all.find((p) => p.name.toLowerCase() === idOrName.toLowerCase());
}

export async function listProjectTodos(projectId: string): Promise<Todo[]> {
  return apiFetch<Todo[]>(
    `/todos?projectId=${encodeURIComponent(projectId)}&_sort=-createdAt`,
  );
}

export async function addProjectTodo(input: { projectId: string; title: string }): Promise<Todo> {
  const todo: Todo = {
    id: generateTodoId(),
    projectId: input.projectId,
    title: input.title,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  return apiFetch<Todo>("/todos", {
    method: "POST",
    body: JSON.stringify(todo),
  });
}

export async function toggleProjectTodo(input: { todoId: string; completed: boolean }): Promise<Todo> {
  return apiFetch<Todo>(`/todos/${input.todoId}`, {
    method: "PATCH",
    body: JSON.stringify({ completed: input.completed }),
  });
}

function generateProjectId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `proj_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `proj_${Math.random().toString(36).slice(2, 8)}`;
}

function generateTodoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `todo_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `todo_${Math.random().toString(36).slice(2, 8)}`;
}
