import Link from "next/link";
import type { Project } from "@/types/project";

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <p className="muted">
        No projects yet. Create one to begin Protein / PDB Setup.
      </p>
    );
  }

  return (
    <div className="project-grid">
      {projects.map((project) => (
        <Link key={project.id} href={`/projects/${project.id}`} className="card">
          <strong>{project.name}</strong>
          <p className="muted">
            {project.isDemo ? "DEMO DATA · " : ""}
            {project.status} · updated {project.updatedAt}
          </p>
        </Link>
      ))}
    </div>
  );
}
