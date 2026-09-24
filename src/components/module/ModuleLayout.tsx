import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";
import { ExecutionStateBadge } from "@/components/module/ExecutionStateBadge";
import { LabExplainer } from "@/components/module/LabExplainer";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";

export function ModuleLayout({
  module,
  run,
  children,
}: {
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  children?: React.ReactNode;
}) {
  return (
    <article>
      <header className="card">
        <p className="muted">Module {module.number}</p>
        <h2>
          {module.name}{" "}
          {run ? <ExecutionStateBadge status={run.status} /> : null}
        </h2>
        <LabExplainer labKey={module.id} />
        <p>
          <strong>Purpose.</strong> {module.purpose}
        </p>
        <details className="lab-instructions">
          <summary>Full instructions</summary>
          <p>{module.instructions}</p>
        </details>
      </header>
      {children}
      {!module.implemented ? (
        <div className="card">
          <EmptyScientificPanel
            title="Raw results"
            message="Not available in this phase. No scientific output has been generated."
          />
          <EmptyScientificPanel
            title="Normalized results"
            message="Not available in this phase."
          />
          <EmptyScientificPanel
            title="Interpretation"
            message="Not available in this phase."
          />
          <EmptyScientificPanel
            title="Evidence"
            message="Not available in this phase. Residues and tool hits will never be invented."
          />
        </div>
      ) : null}
    </article>
  );
}
