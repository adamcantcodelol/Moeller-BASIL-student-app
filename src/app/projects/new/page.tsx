import { AppShell } from "@/components/layout/AppShell";
import { CreateProjectForm } from "@/components/dashboard/CreateProjectForm";

export default function NewProjectPage() {
  return (
    <AppShell>
      <section className="card">
        <h2>New project</h2>
        <CreateProjectForm />
      </section>
    </AppShell>
  );
}
