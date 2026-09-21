import { AppShell } from "@/components/layout/AppShell";
import { CreateProjectForm } from "@/components/dashboard/CreateProjectForm";
import { ProjectList } from "@/components/dashboard/ProjectList";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { getRequestDatabase } from "@/lib/db/request";
import { listProjects } from "@/lib/services/projectService";
import { LoadDemoButton } from "@/components/dashboard/LoadDemoButton";
import { CURRICULUM_MODULES } from "@/modules/registry";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let databaseError: string | null = null;

  try {
    const db = await getRequestDatabase();
    projects = await listProjects(db);
  } catch {
    databaseError =
      "The local D1 database is not available yet. Run npm run db:migrate:local, then npm run db:seed-demo if you want the labeled demonstration project.";
  }

  const hasDemo = projects.some((project) => project.isDemo);

  return (
    <AppShell>
      {hasDemo ? <DemoBanner show /> : null}
      <section className="card">
        <h2>Research dashboard</h2>
        <p>
          Enter a PDB identifier and move through BASIL modules 00–11. Phase 1
          records the project, structure identifier, notes, and module state
          only. Scientific tools are not called.
        </p>
      </section>
      {databaseError ? <p className="error">{databaseError}</p> : null}
      <section className="card">
        <h2>Projects</h2>
        <ProjectList projects={projects} />
        <LoadDemoButton />
      </section>
      <section className="card">
        <h2>Create a project</h2>
        <CreateProjectForm />
      </section>
      <section className="card">
        <h2>Curriculum registry</h2>
        <ol>
          {CURRICULUM_MODULES.map((module) => (
            <li key={module.id}>
              {module.number} {module.name}
              {module.implemented ? " — available" : " — placeholder"}
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
