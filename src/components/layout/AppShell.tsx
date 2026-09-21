import { CourseHeader } from "@/components/layout/CourseHeader";
import { ModuleNav } from "@/components/layout/ModuleNav";
import type { ModuleRun } from "@/types/moduleRun";

export function AppShell({
  children,
  projectId,
  moduleRuns,
}: {
  children: React.ReactNode;
  projectId?: string;
  moduleRuns?: ModuleRun[];
}) {
  return (
    <div className="app-shell">
      <CourseHeader />
      <div className="page-body">
        <ModuleNav projectId={projectId} moduleRuns={moduleRuns} />
        <div className="main-panel">{children}</div>
      </div>
      <footer className="footer">
        Educational research platform. Scientific results are never fabricated.
        AI explanations are not experimental evidence.
      </footer>
    </div>
  );
}
