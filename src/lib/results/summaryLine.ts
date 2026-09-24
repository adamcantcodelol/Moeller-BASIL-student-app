import type { ToolResultSection } from "@/lib/services/pipelineService";

/**
 * One-line collapsed-panel summary built only from stored data. When data is
 * missing, returns the section's own status text — never invented numbers.
 */

type Num = number | null | undefined;

function finite(values: Num[]): number[] {
  return values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

function fmtEvalue(value: number): string {
  return value === 0 ? "0" : value < 0.001 ? value.toExponential(1) : String(Number(value.toPrecision(3)));
}

export function buildResultSummaryLine(section: ToolResultSection): string {
  const n = section.normalized as Record<string, unknown> | null;
  if (section.status !== "succeeded" || !n) return section.summary;
  const parts: string[] = [];

  switch (section.tool) {
    case "sprite": {
      const hits = (n.hits as Array<{ rmsd: Num }> | undefined) ?? [];
      parts.push(plural(hits.length, "match", "matches"));
      const rmsds = finite(hits.map((h) => h.rmsd));
      if (rmsds.length) parts.push(`best RMSD ${Math.min(...rmsds).toFixed(2)} Å`);
      break;
    }
    case "foldseek": {
      const hits = (n.hits as Array<{ eValue: Num; target: string }> | undefined) ?? [];
      parts.push(plural(hits.length, "hit"));
      const evalues = finite(hits.map((h) => h.eValue));
      if (evalues.length) parts.push(`best E-value ${fmtEvalue(Math.min(...evalues))}`);
      break;
    }
    case "dali": {
      const hits = (n.hits as Array<{ zScore: Num; pdbChain: string | null }> | undefined) ?? [];
      parts.push(plural(hits.length, "hit"));
      const withZ = hits.filter((h) => typeof h.zScore === "number");
      if (withZ.length) {
        const top = withZ.reduce((a, b) => ((b.zScore as number) > (a.zScore as number) ? b : a));
        parts.push(`top Z ${top.zScore}${top.pdbChain ? ` (${top.pdbChain})` : ""}`);
      }
      break;
    }
    case "interpro": {
      const entries = (n.entries as Array<{ name: string }> | undefined) ?? [];
      parts.push(plural(entries.length, "entry", "entries"));
      if (entries[0]?.name) parts.push(`first: ${entries[0].name}`);
      break;
    }
    case "swissdock": {
      const poses = (n.poses as Array<{ affinity: Num }> | undefined) ?? [];
      parts.push(plural(poses.length, "pose"));
      const affinities = finite(poses.map((p) => p.affinity));
      if (affinities.length) parts.push(`best affinity ${Math.min(...affinities).toFixed(2)} kcal/mol`);
      break;
    }
    case "blast": {
      const hits =
        (n.hits as Array<{ evalue: string | null; identityPct: Num }> | undefined) ?? [];
      parts.push(plural(hits.length, "hit"));
      const evalues = finite(hits.map((h) => (h.evalue === null ? null : Number(h.evalue))));
      if (evalues.length) parts.push(`best E-value ${fmtEvalue(Math.min(...evalues))}`);
      const ids = finite(hits.map((h) => h.identityPct));
      if (ids.length) parts.push(`top identity ${Math.max(...ids).toFixed(0)}%`);
      break;
    }
    default:
      // rcsb, clean: the stored summary already carries the real key facts.
      return section.summary;
  }
  return parts.join(" · ");
}

/** Open by default: problems/in-progress first, the first section, and CLEAN when it still needs a run. */
export function defaultPanelOpen(section: ToolResultSection, index: number): boolean {
  if (section.status === "failed" || section.status === "running" || section.status === "unavailable") {
    return true;
  }
  if (index === 0) return true;
  if (section.tool === "clean" && !section.normalized) return true;
  return false;
}
