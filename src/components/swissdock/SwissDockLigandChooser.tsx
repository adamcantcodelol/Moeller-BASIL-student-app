"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LigandSource = "structure" | "rcsb-chemcomp" | "pubchem" | "smiles";

interface Ligand {
  source: LigandSource;
  id: string | null;
  name: string;
  formula: string | null;
  smiles: string | null;
  url?: string | null;
}

interface HetEntry {
  resName: string;
  chain: string;
  resSeq: string;
  atomCount: number;
  category: string;
  categoryLabel: string;
  dockable: boolean;
  boxCenter: string;
}

interface BoxCandidate {
  id: string;
  label: string;
  center: string;
}

interface Setup {
  pdbId: string;
  hets: HetEntry[];
  boxes: BoxCandidate[];
  suggestions: { basis: string | null; names: string[] };
}

type Tab = "structure" | "search" | "smiles";

const SOURCE_LABEL: Record<LigandSource, string> = {
  structure: "from this PDB entry (RCSB chemical component)",
  "rcsb-chemcomp": "RCSB chemical component dictionary",
  pubchem: "PubChem",
  smiles: "your SMILES",
};

async function getJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok || res.status === 202, data };
}

export function SwissDockLigandChooser({
  projectId,
  pdbId,
}: {
  projectId: string;
  pdbId: string | null;
}) {
  const router = useRouter();
  const base = `/api/projects/${projectId}/modules/swissdock`;
  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("structure");
  const [ligand, setLigand] = useState<Ligand | null>(null);
  const [ligandHet, setLigandHet] = useState<HetEntry | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Ligand[] | null>(null);
  const [smiles, setSmiles] = useState("");
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [box, setBox] = useState<{ center: string; label: string } | null>(null);
  const [residueText, setResidueText] = useState("");
  const [boxSize, setBoxSize] = useState("20");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pdbId) return;
    let cancelled = false;
    void getJson<Setup>(`${base}/ligands`).then(({ ok, data }) => {
      if (cancelled) return;
      if (ok) setSetup(data);
      else setSetupError(data.error ?? "Could not load ligands from the PDB entry.");
    });
    return () => {
      cancelled = true;
    };
  }, [base, pdbId]);

  function choose(next: Ligand, het: HetEntry | null) {
    setLigand(next);
    setLigandHet(het);
    setError(null);
    if (het) {
      setBox({
        center: het.boxCenter,
        label: `Centered on ${het.resName} ${het.chain}:${het.resSeq} (the chosen ligand's position in the crystal)`,
      });
    } else if (box?.label.startsWith("Centered on ") && box.label.includes("chosen ligand")) {
      setBox(null);
    }
  }

  async function pickHet(het: HetEntry) {
    setBusy(`het-${het.resName}`);
    setLookupMsg(null);
    const { ok, data } = await getJson<{ results: Ligand[] }>(`${base}/ligands?q=${encodeURIComponent(het.resName)}`);
    setBusy(null);
    const found = ok ? data.results.find((r) => r.source === "rcsb-chemcomp") : null;
    if (!found?.smiles) {
      setLookupMsg(`RCSB has no SMILES for ${het.resName}, so it can't be docked. Nothing was invented.`);
      return;
    }
    choose({ ...found, source: "structure" }, het);
  }

  async function runSearch() {
    setBusy("search");
    setResults(null);
    setLookupMsg(null);
    const { ok, data } = await getJson<{ results: Ligand[]; errors: string[] }>(
      `${base}/ligands?q=${encodeURIComponent(query)}`,
    );
    setBusy(null);
    if (!ok) {
      setLookupMsg(data.error ?? "Search failed.");
      return;
    }
    setResults(data.results);
    if (data.results.length === 0) {
      setLookupMsg(
        `No match in RCSB or PubChem for "${query}".${data.errors.length ? ` (${data.errors.join(" ")})` : ""} Try another name, a PDB ligand ID, or paste a SMILES.`,
      );
    }
  }

  async function runSmilesCheck() {
    setBusy("smiles");
    setLookupMsg(null);
    const { ok, data } = await getJson<{ ok: boolean; error?: string; candidate?: Ligand; note?: string }>(
      `${base}/ligands`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ smiles }) },
    );
    setBusy(null);
    if (!ok || !data.ok || !data.candidate) {
      setLookupMsg(data.error ?? "That SMILES could not be checked.");
      return;
    }
    choose(data.candidate, null);
    if (data.note) setLookupMsg(data.note);
  }

  async function centerOnResidues() {
    setBusy("residues");
    setError(null);
    const { ok, data } = await getJson<{ boxCenter: string; found: string[]; missing: string[] }>(
      `${base}/ligands?residues=${encodeURIComponent(residueText)}`,
    );
    setBusy(null);
    if (!ok) {
      setError(data.error ?? "Could not find those residues.");
      return;
    }
    setBox({
      center: data.boxCenter,
      label: `Centered on residues ${data.found.map((k) => k.split(":").reverse().join(" ").replace(/ (\w)$/, " $1")).join(", ")}${data.missing.length ? ` (not found: ${data.missing.join(", ")})` : ""}`,
    });
  }

  async function poll(jobId: string) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      setStatus(`SwissDock is docking… (${Math.round((attempt * 10) / 60)} min so far; stops after 20 min)`);
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      const { ok, data } = await getJson<{ pending?: boolean }>(`${base}/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!ok) {
        setError(data.error ?? "SwissDock check failed. No poses were invented.");
        return;
      }
      if (!data.pending) {
        setStatus("Docking finished — results are below.");
        router.refresh();
        return;
      }
    }
    setError("SwissDock did not finish within 20 minutes. No poses were invented. Try again or import results.");
  }

  async function submit(auto: boolean) {
    setBusy("submit");
    setError(null);
    setStatus("Sending to SwissDock (Vina)…");
    const body: Record<string, unknown> = { pdbId };
    if (!auto && ligand?.smiles && box) {
      body.ligand = {
        name: ligand.name,
        source: ligand.source,
        id: ligand.id,
        formula: ligand.formula,
        smiles: ligand.smiles,
      };
      body.boxCenter = box.center;
      body.boxSize = `${boxSize}_${boxSize}_${boxSize}`;
      body.boxLabel = box.label;
    }
    const { ok, data } = await getJson<{ pending?: boolean; job?: { id: string }; sessionNumber?: string }>(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!ok) {
      setBusy(null);
      setStatus(null);
      setError(data.error ?? "SwissDock submit failed. No poses were invented.");
      return;
    }
    if (data.pending && data.job?.id) {
      setStatus(`SwissDock session ${data.sessionNumber ?? ""} started…`);
      await poll(data.job.id);
    } else {
      setStatus("Docking finished — results are below.");
      router.refresh();
    }
    setBusy(null);
  }

  if (!pdbId) {
    return <p className="error">Save a PDB ID in Protein / PDB Setup first.</p>;
  }

  const dockableHets = setup?.hets.filter((h) => h.dockable) ?? [];
  const ready = Boolean(ligand?.smiles && box);

  return (
    <div className="form-stack ligand-chooser" id="ligand-chooser">
      <h4>1. Choose a ligand (the small molecule to dock)</h4>
      <div className="mode-row" role="tablist">
        {(
          [
            ["structure", "Found in this PDB entry"],
            ["search", "Search by name or ID"],
            ["smiles", "Paste SMILES"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "chip-button" : "secondary chip-button"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "structure" ? (
        setupError ? (
          <p className="error">{setupError}</p>
        ) : !setup ? (
          <p className="muted">Reading {pdbId} from RCSB…</p>
        ) : setup.hets.length === 0 ? (
          <p className="muted">{pdbId} has no small molecules besides water. Search or paste a SMILES instead.</p>
        ) : (
          <>
            {dockableHets.every((h) => h.category !== "ligand") ? (
              <p className="muted">
                {pdbId} has no bound ligand — only additives/ions/modified residues. You can still dock an
                additive, but a substrate-like molecule from Search is usually more meaningful.
              </p>
            ) : null}
            <ul className="ligand-list">
              {setup.hets.map((h) => (
                <li key={`${h.resName}-${h.chain}-${h.resSeq}`}>
                  <button
                    type="button"
                    className="secondary chip-button"
                    disabled={!h.dockable || busy !== null}
                    onClick={() => void pickHet(h)}
                  >
                    {h.resName} {h.chain}:{h.resSeq}
                  </button>{" "}
                  <span className="muted">
                    {h.categoryLabel} · {h.atomCount} atoms{h.dockable ? "" : " · not dockable"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}

      {tab === "search" ? (
        <>
          <form
            className="mode-row"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch();
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Name (e.g. "4-nitrophenyl acetate") or PDB ligand ID (e.g. ATP)'
              maxLength={80}
            />
            <button type="submit" disabled={busy !== null || query.trim().length < 2}>
              {busy === "search" ? "Searching…" : "Search"}
            </button>
          </form>
          {setup?.suggestions.names.length ? (
            <p className="muted">
              Ideas based on your data — {setup.suggestions.basis}:{" "}
              {setup.suggestions.names.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="secondary chip-button"
                  onClick={() => setQuery(name)}
                >
                  {name}
                </button>
              ))}
            </p>
          ) : null}
          {results?.length ? (
            <ul className="ligand-list">
              {results.map((r) => (
                <li key={`${r.source}-${r.id}`}>
                  <button type="button" className="secondary chip-button" onClick={() => choose(r, null)}>
                    Use
                  </button>{" "}
                  <strong>{r.name}</strong> · {r.formula ?? "formula n/a"} ·{" "}
                  <span className="muted">
                    {r.id} ({SOURCE_LABEL[r.source]})
                  </span>{" "}
                  <code className="smiles">{r.smiles}</code>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {tab === "smiles" ? (
        <form
          className="mode-row"
          onSubmit={(e) => {
            e.preventDefault();
            void runSmilesCheck();
          }}
        >
          <input
            value={smiles}
            onChange={(e) => setSmiles(e.target.value)}
            placeholder="e.g. CC(=O)Oc1ccc(cc1)[N+](=O)[O-]"
            spellCheck={false}
            maxLength={300}
          />
          <button type="submit" disabled={busy !== null || smiles.trim().length < 2}>
            {busy === "smiles" ? "Checking…" : "Check SMILES"}
          </button>
        </form>
      ) : null}

      {lookupMsg ? <p className="muted">{lookupMsg}</p> : null}
      {ligand ? (
        <p className="ligand-picked">
          Chosen ligand: <strong>{ligand.name}</strong>
          {ligand.formula ? ` · ${ligand.formula}` : ""}
          {ligand.id ? ` · ${ligand.id}` : ""} <span className="muted">({SOURCE_LABEL[ligand.source]})</span>
          <br />
          <code className="smiles">{ligand.smiles}</code>
        </p>
      ) : null}

      <h4>2. Choose the docking box</h4>
      <p className="muted">
        The docking box is the 3D region of the protein where SwissDock is allowed to place the ligand —
        like telling it &ldquo;search here&rdquo;. Center it on the active site (for example your catalytic
        residues); a 20 Å box is a good default that covers a typical pocket.
      </p>
      <ul className="ligand-list">
        {ligandHet ? (
          <li>
            <label>
              <input
                type="radio"
                name="box"
                checked={box?.center === ligandHet.boxCenter}
                onChange={() =>
                  setBox({
                    center: ligandHet.boxCenter,
                    label: `Centered on ${ligandHet.resName} ${ligandHet.chain}:${ligandHet.resSeq} (the chosen ligand's position in the crystal)`,
                  })
                }
              />{" "}
              On the chosen ligand&apos;s crystal position ({ligandHet.resName} {ligandHet.chain}:{ligandHet.resSeq})
            </label>
          </li>
        ) : null}
        {setup?.boxes.map((b) => (
          <li key={b.id}>
            <label>
              <input
                type="radio"
                name="box"
                checked={box?.center === b.center && box.label === b.label}
                onChange={() => setBox({ center: b.center, label: b.label })}
              />{" "}
              {b.label}
            </label>
          </li>
        ))}
      </ul>
      {setup && setup.boxes.length === 0 ? (
        <p className="muted">
          No SPRITE match or active-site evidence with residues yet — type residues below instead.
        </p>
      ) : null}
      <form
        className="mode-row"
        onSubmit={(e) => {
          e.preventDefault();
          void centerOnResidues();
        }}
      >
        <input
          value={residueText}
          onChange={(e) => setResidueText(e.target.value)}
          placeholder="Or pick residues, e.g. A:114, A:207, A:236"
        />
        <button type="submit" className="secondary" disabled={busy !== null || !residueText.trim()}>
          {busy === "residues" ? "Finding…" : "Center on these residues"}
        </button>
      </form>
      <label>
        Box size (Å per side)
        <select value={boxSize} onChange={(e) => setBoxSize(e.target.value)}>
          <option value="15">15 Å (small pocket)</option>
          <option value="20">20 Å (default)</option>
          <option value="25">25 Å (larger region)</option>
        </select>
      </label>
      {box ? (
        <p className="muted">
          Box: {box.label} · center {box.center.replace(/_/g, ", ")} · {boxSize} Å
        </p>
      ) : null}

      <h4>3. Dock</h4>
      <button type="button" disabled={!ready || busy !== null} onClick={() => void submit(false)}>
        {busy === "submit" ? "Docking…" : "Dock the chosen ligand with SwissDock (Vina)"}
      </button>
      {!ready ? <p className="muted">Choose a ligand and a box first.</p> : null}
      <details className="data-collapse">
        <summary>Or let the app auto-pick the PDB&apos;s own ligand</summary>
        <p className="muted">
          Uses the largest bound ligand in {pdbId} (additives and modified residues are skipped) and centers
          the box on it. If there is none, SwissDock is skipped honestly.
        </p>
        <button type="button" className="secondary" disabled={busy !== null} onClick={() => void submit(true)}>
          Auto-pick and dock
        </button>
      </details>
      {status ? <p className="muted">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
