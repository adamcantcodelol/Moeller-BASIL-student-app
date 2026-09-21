import type { Project } from "@/types/project";
import type { PdbStructure } from "@/types/structure";

export function ProjectStatus({
  project,
  structure,
}: {
  project: Project;
  structure: PdbStructure | null;
}) {
  return (
    <section className="card">
      <h2>{project.name}</h2>
      <p className="muted">
        Status: {project.status}
        {project.studentId ? ` · ${project.studentId}` : ""}
      </p>
      <p>
        PDB identifier:{" "}
        {structure ? (
          <strong>{structure.pdbId}</strong>
        ) : (
          <span className="muted">not recorded yet</span>
        )}
      </p>
    </section>
  );
}
