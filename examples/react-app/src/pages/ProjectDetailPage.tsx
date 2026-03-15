import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addProjectTodo,
  findProjectById,
  listProjectTodos,
  toggleProjectTodo,
  type ProjectWithTodos,
  type Todo,
} from "../data/projectStore";

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const [project, setProject] = useState<ProjectWithTodos | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todoInput, setTodoInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [projectResponse, todoResponse] = await Promise.all([
        findProjectById(projectId),
        listProjectTodos(projectId),
      ]);
      setProject(projectResponse ?? null);
      setTodos(todoResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    const handler = () => {
      void loadProject();
    };
    window.addEventListener("ai-capabilities:runtime-updated", handler);
    return () => {
      window.removeEventListener("ai-capabilities:runtime-updated", handler);
    };
  }, [loadProject]);

  const todoStats = useMemo(() => {
    const completed = todos.filter((todo) => todo.completed).length;
    return { completed, total: todos.length };
  }, [todos]);

  async function handleAddTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!todoInput.trim() || !projectId) return;
    setIsSubmitting(true);
    try {
      await addProjectTodo({ projectId, title: todoInput.trim() });
      setTodoInput("");
      const updatedTodos = await listProjectTodos(projectId);
      setTodos(updatedTodos);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(todo: Todo) {
    await toggleProjectTodo({ todoId: todo.id, completed: !todo.completed });
    if (projectId) {
      const updatedTodos = await listProjectTodos(projectId);
      setTodos(updatedTodos);
    }
  }

  if (loading) {
    return <p className="loading-text">Loading project...</p>;
  }

  if (!project || error) {
    return (
      <div className="card">
        <p>Unable to load project {projectId}.</p>
        {error ? <div className="alert">Error: {error}</div> : null}
        <Link to="/projects">Back to projects</Link>
      </div>
    );
  }

  return (
    <section>
      <Link to="/projects" style={{ textDecoration: "none", fontSize: "0.9rem" }}>
        &larr; Back to projects
      </Link>
      <h2 style={{ marginBottom: "0.25rem" }}>{project.name}</h2>
      {project.description ? (
        <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>{project.description}</p>
      ) : null}
      <div className="badge" style={{ marginBottom: "1.5rem" }}>
        {todoStats.completed}/{todoStats.total} todos done
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3>Todo list</h3>
        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo.id} className="todo-item">
              <div className="todo-item__left">
                <div
                  className={`todo-checkbox ${todo.completed ? "todo-checkbox--checked" : ""}`}
                  onClick={() => handleToggle(todo)}
                  role="checkbox"
                  aria-checked={todo.completed}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggle(todo);
                    }
                  }}
                />
                <span className={`todo-title ${todo.completed ? "todo-title--completed" : ""}`}>
                  {todo.title}
                </span>
              </div>
              <button type="button" className="btn-secondary" onClick={() => handleToggle(todo)}>
                {todo.completed ? "Reopen" : "Done"}
              </button>
            </li>
          ))}
          {todos.length === 0 ? (
            <li className="todo-item" style={{ color: "var(--color-text-muted)", justifyContent: "center" }}>
              No todos yet. Ask the assistant to add one!
            </li>
          ) : null}
        </ul>
      </div>

      <form className="card" onSubmit={handleAddTodo}>
        <h3>Add todo</h3>
        <input
          type="text"
          className="input"
          placeholder="E.g. Prepare kickoff brief"
          value={todoInput}
          onChange={(event) => setTodoInput(event.currentTarget.value)}
          style={{ marginBottom: "0.75rem" }}
        />
        <button type="submit" className="btn-primary" disabled={isSubmitting || !todoInput.trim()}>
          {isSubmitting ? "Adding..." : "Add todo"}
        </button>
      </form>
    </section>
  );
}
