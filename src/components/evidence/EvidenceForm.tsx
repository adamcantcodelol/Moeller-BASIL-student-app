"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SOURCE_OPTIONS = [
  { id: "pdb-setup", label: "00 Protein / PDB Setup" },
  { id: "sprite", label: "01 SPRITE" },
  { id: "blast", label: "02 BLAST" },
  { id: "interpro", label: "03 InterPro" },
  { id: "clean", label: "04 CLEAN" },
  { id: "dali", label: "05 Dali" },
  { id: "foldseek", label: "06 Foldseek" },
  { id: "swissdock", label: "08 SwissDock" },
];

export function EvidenceForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [sourceModuleId, setSourceModuleId] = useState("interpro");
  const [type, setType] = useState("domain_residue");
  const [description, setDescription] = useState("");
  const [chain, setChain] = useState("");
  const [position, setPosition] = useState("");
  const [aminoAcid, setAminoAcid] = useState("");
  const [strength, setStrength] = useState("supporting");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const pos = Number(position);
    const response = await fetch(`/api/projects/${projectId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        description,
        sourceModuleId,
        strength,
        residues: [
          {
            chain: chain || null,
            position: pos,
            aminoAcid: aminoAcid || null,
          },
        ],
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save evidence.");
      return;
    }
    setDescription("");
    setPosition("");
    setAminoAcid("");
    router.refresh();
  }

  return (
    <form className="card form-stack" onSubmit={(event) => void onSubmit(event)}>
      <h3>Record evidence-backed residue</h3>
      <p className="muted">
        Enter residues you observed in prior modules. The app will not invent
        active-site positions.
      </p>
      <label>
        Source module
        <select
          value={sourceModuleId}
          onChange={(event) => setSourceModuleId(event.target.value)}
        >
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Evidence type
        <input value={type} onChange={(event) => setType(event.target.value)} />
      </label>
      <label>
        Why this residue is supported
        <textarea
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </label>
      <div className="form-row">
        <label>
          Chain
          <input
            value={chain}
            onChange={(event) => setChain(event.target.value)}
            placeholder="A"
          />
        </label>
        <label>
          Position
          <input
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            placeholder="143"
            required
          />
        </label>
        <label>
          AA
          <input
            value={aminoAcid}
            onChange={(event) => setAminoAcid(event.target.value)}
            placeholder="H"
          />
        </label>
      </div>
      <label>
        Strength
        <select
          value={strength}
          onChange={(event) => setStrength(event.target.value)}
        >
          <option value="preliminary">preliminary</option>
          <option value="supporting">supporting</option>
          <option value="strong">strong</option>
          <option value="conflicting">conflicting</option>
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save evidence"}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
