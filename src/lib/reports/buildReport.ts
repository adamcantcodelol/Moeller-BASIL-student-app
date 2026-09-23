import type { Evidence } from "@/types/evidence";
import type { Hypothesis } from "@/types/hypothesis";
import type { ModuleRun } from "@/types/moduleRun";
import type { PdbStructure } from "@/types/structure";
import type { Project } from "@/types/project";

export function buildStudentReportMarkdown(input: {
  project: Project;
  structure: PdbStructure | null;
  moduleRuns: ModuleRun[];
  evidence: Evidence[];
  hypothesis: Hypothesis | null;
}): string {
  const lines: string[] = [
    `# Student Research Report`,
    ``,
    `Project: ${input.project.name}`,
    `Generated: ${new Date().toISOString()}`,
    input.project.isDemo ? `Label: DEMO DATA` : `Label: student project`,
    ``,
    `## Structure`,
  ];

  if (!input.structure) {
    lines.push(`No PDB structure saved.`);
  } else {
    lines.push(
      `- PDB ID: ${input.structure.pdbId}`,
      `- Source: ${input.structure.source}`,
      `- Title: ${input.structure.title ?? "(not retrieved)"}`,
      `- Organism: ${input.structure.organism ?? "(not retrieved)"}`,
    );
  }

  lines.push(``, `## Module status`);
  for (const run of input.moduleRuns) {
    lines.push(`- ${run.moduleId}: ${run.status}`);
  }

  lines.push(``, `## Evidence residues (student-recorded)`);
  if (input.evidence.length === 0) {
    lines.push(`None recorded. No residues were invented for this report.`);
  } else {
    for (const item of input.evidence) {
      const residues =
        item.residues
          ?.map(
            (residue) =>
              `${residue.chain ? `${residue.chain}:` : ""}${residue.position}${residue.aminoAcid ?? ""}`,
          )
          .join(", ") ?? "";
      lines.push(
        `- ${item.sourceModuleId}: ${residues} — ${item.description} (${item.strength ?? "n/a"})`,
      );
    }
  }

  lines.push(``, `## Hypothesis (student-authored)`);
  lines.push(input.hypothesis?.text ?? `(none saved)`);
  lines.push(
    ``,
    `## Integrity note`,
    `This report only includes stored project data. It does not invent BLAST/InterPro/Foldseek hits or active-site residues.`,
    ``,
  );
  return lines.join("\n");
}

export function buildTeacherReportMarkdown(input: {
  project: Project;
  structure: PdbStructure | null;
  moduleRuns: ModuleRun[];
  evidence: Evidence[];
  hypothesis: Hypothesis | null;
}): string {
  const student = buildStudentReportMarkdown(input);
  const complete = input.moduleRuns.filter((run) => run.status === "complete");
  const incomplete = input.moduleRuns.filter((run) => run.status !== "complete");
  return [
    `# Teacher Report`,
    ``,
    `Completion: ${complete.length}/${input.moduleRuns.length} modules complete.`,
    `Incomplete: ${incomplete.map((run) => run.moduleId).join(", ") || "none"}`,
    `Evidence records: ${input.evidence.length}`,
    `Hypothesis saved: ${input.hypothesis ? "yes" : "no"}`,
    ``,
    `---`,
    ``,
    student,
  ].join("\n");
}
