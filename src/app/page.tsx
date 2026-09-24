import { AppShell } from "@/components/layout/AppShell";
import { CreateProjectForm } from "@/components/dashboard/CreateProjectForm";
import { ProjectList } from "@/components/dashboard/ProjectList";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { getRequestDatabase } from "@/lib/db/request";
import { listProjects } from "@/lib/services/projectService";
import { LoadDemoButton } from "@/components/dashboard/LoadDemoButton";
import { CURRICULUM_MODULES } from "@/modules/registry";
import { JoinClassForm } from "@/components/identity/JoinClassForm";
import { MoveDeviceProjectsButton } from "@/components/identity/MoveDeviceProjectsButton";
import { getRequestIdentity } from "@/lib/auth/request";
import { ownerForIdentity } from "@/lib/auth/identity";
import { countDeviceProjects } from "@/lib/db/queries/projects";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let databaseError: string | null = null;
  let deviceProjectCount = 0;
  const identity = await getRequestIdentity();

  try {
    const db = await getRequestDatabase();
    // Only this student's (or this computer's) projects — never everyone's.
    projects = await listProjects(db, ownerForIdentity(identity));
    if (identity.student && identity.deviceId) {
      deviceProjectCount = await countDeviceProjects(db, identity.deviceId);
    }
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
      {identity.student ? null : (
        <section className="card">
          <h2>Join your class (optional)</h2>
          <JoinClassForm />
        </section>
      )}
      <section className="card">
        <h2>{identity.student ? "Your projects" : "Projects on this computer"}</h2>
        {deviceProjectCount > 0 ? (
          <MoveDeviceProjectsButton count={deviceProjectCount} />
        ) : null}
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
