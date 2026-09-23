import type { ChimeraXCommandSet } from "@/lib/chimerax/generateCommands";

export function ChimeraXPanel({ commands }: { commands: ChimeraXCommandSet | null }) {
  if (!commands) {
    return (
      <div className="card">
        <h3>ChimeraX commands</h3>
        <p className="muted">
          Save a PDB ID in Protein / PDB Setup to generate ChimeraX commands from
          evidence residues.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>ChimeraX commands</h3>
      <p className="muted">
        Residue numbers in this script come only from recorded evidence — never
        invented by the platform.
      </p>
      <pre className="provenance-block">{commands.script}</pre>
    </div>
  );
}
