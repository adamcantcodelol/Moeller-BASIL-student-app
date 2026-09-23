"use client";

import { useRouter } from "next/navigation";
import type { Evidence } from "@/types/evidence";

export function EvidenceList({
  projectId,
  items,
}: {
  projectId: string;
  items: Evidence[];
}) {
  const router = useRouter();

  async function remove(id: string) {
    await fetch(`/api/projects/${projectId}/evidence/${id}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <h3>Evidence records</h3>
        <p className="muted">No evidence residues recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Evidence records</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Residue</th>
              <th>Module</th>
              <th>Type</th>
              <th>Strength</th>
              <th>Description</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const residue = item.residues?.[0];
              return (
                <tr key={item.id}>
                  <td>
                    {residue
                      ? `${residue.chain ? `${residue.chain}:` : ""}${residue.position}${residue.aminoAcid ? ` (${residue.aminoAcid})` : ""}`
                      : "—"}
                  </td>
                  <td>{item.sourceModuleId ?? "—"}</td>
                  <td>{item.type}</td>
                  <td>{item.strength ?? "—"}</td>
                  <td>{item.description}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        void remove(item.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
