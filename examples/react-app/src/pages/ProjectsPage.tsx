import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listProjects, type ProjectWithTodos } from "../data/projectStore";

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithTodos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const handler = () => {
      void loadProjects();
    };
    window.addEventListener("ai-capabilities:runtime-updated", handler);
    return () => {
      window.removeEventListener("ai-capabilities:runtime-updated", handler);
    };
  }, [loadProjects]);

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Projects</h2>
      <p style={{ color: "var(--color-text-muted)" }}>
        Ask the assistant to create a project, list them, or jump into a detail view.
      </p>

      {error ? <div className="alert">Failed to load projects: {error}</div> : null}

      {loading ? (
        <p className="loading-text">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📋</div>
          <h3>No projects yet</h3>
          <p>Ask the assistant to create your first project, or make sure the API server is running on port 4001.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => {
            const todos = project.todos ?? [];
            const completed = todos.filter((todo) => todo.completed).length;
            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="card card--interactive">
                  <div className="badge" style={{ marginBottom: "0.5rem" }}>
                    {completed}/{todos.length} todos done
                  </div>
                  <h3>{project.name}</h3>
                  <small>Created {new Date(project.createdAt).toLocaleDateString()}</small>
                  {project.description ? <p style={{ color: "var(--color-text-muted)", margin: "0.5rem 0 0" }}>{project.description}</p> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="card" style={{ marginTop: "2rem" }}>
        <h3>Starter prompts</h3>
        <ul style={{ color: "var(--color-text-muted)", lineHeight: 1.8 }}>
          <li>"Create a project called Campaign Ops and open it."</li>
          <li>"List todos for proj_1 and mark todo_2 done."</li>
          <li>"Add a todo to proj_2: review the dashboards."</li>
        </ul>
      </div>
    </section>
  );
}
