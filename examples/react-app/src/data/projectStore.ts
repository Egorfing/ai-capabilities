export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};

const projects: Project[] = [
  { id: "proj_1", name: "Launchpad", description: "Marketing launch backlog", createdAt: isoDaysAgo(14) },
  { id: "proj_2", name: "Data Warehouse", description: "Analytics infra", createdAt: isoDaysAgo(7) },
];

export function listProjects(): Project[] {
  return [...projects];
}

export function createProject(input: { name: string; description?: string }): Project {
  const project: Project = {
    id: `proj_${projects.length + 1}`,
    name: input.name,
    description: input.description,
    createdAt: new Date().toISOString(),
  };
  projects.unshift(project);
  return project;
}

export function findProjectById(projectId: string): Project | undefined {
  return projects.find((project) => project.id === projectId);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
