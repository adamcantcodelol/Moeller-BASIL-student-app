/**
 * Plain-English lab explainers for high-school molecular biology students.
 * Keep scientific honesty: never invent results; say when a tool is import-only.
 */

export type LabExplainerCopy = {
  summary: string;
  paragraphs: string[];
  lookFor?: string[];
};

/** Keys match curriculum module ids / result section tools. */
export const LAB_EXPLAINERS: Record<string, LabExplainerCopy> = {
  "pdb-setup": {
    summary: "What does this do?",
    paragraphs: [
      "This step loads your protein from the Protein Data Bank (RCSB) using a four-letter PDB ID.",
      "You get the real title, organism, and 3D structure — nothing is made up.",
      "Everything later in the course builds on this structure.",
    ],
    lookFor: [
      "A valid PDB ID (like 4CHA)",
      "Title and organism from RCSB",
      "A Mol* 3D view of the real coordinates",
    ],
  },
  rcsb: {
    summary: "What does this do?",
    paragraphs: [
      "RCSB is the public archive of protein structures. Your project stores the metadata and coordinates fetched for your PDB ID.",
      "If UniProt IDs are listed, other tools (like InterPro) can use them.",
    ],
  },
  sprite: {
    summary: "What does this do?",
    paragraphs: [
      "SPRITE looks for known active-site shapes in other proteins and sees if your protein has a similar arrangement of amino acids.",
      "Lower RMSD means a closer 3D match.",
      "Each hit shows the known active-site residues next to the matching residues on your protein.",
    ],
    lookFor: [
      "Hits with low RMSD (under ~2 Å are often interesting)",
      "Paired residues like HIS E:57 ↔ HIS F:57",
      "Pattern descriptions that mention catalysis or binding",
    ],
  },
  blast: {
    summary: "What does this do?",
    paragraphs: [
      "BLAST compares your protein’s amino-acid sequence to sequences in a public database.",
      "Similar sequences (homologs) can hint at shared function — but sequence similarity is not the same as a proven active site.",
    ],
    lookFor: [
      "High percent identity / low E-value hits",
      "Proteins with known enzyme names",
      "Whether UniProt or PDB links appear",
    ],
  },
  foldseek: {
    summary: "What does this do?",
    paragraphs: [
      "Foldseek finds proteins with a similar overall 3D fold, even when the sequence looks different.",
      "A similar fold can suggest related function, but it is not proof by itself.",
    ],
    lookFor: [
      "Top structural neighbors",
      "Identity and similarity scores when reported",
      "Whether hits match what BLAST found",
    ],
  },
  dali: {
    summary: "What does this do?",
    paragraphs: [
      "Dali compares your protein’s 3D shape to other structures in the PDB.",
      "Higher Z-scores usually mean a stronger structural match. Results are never invented.",
    ],
    lookFor: [
      "High Z-score neighbors",
      "Proteins with related names or functions",
      "Agreement (or disagreement) with Foldseek / SPRITE",
    ],
  },
  interpro: {
    summary: "What does this do?",
    paragraphs: [
      "InterPro looks up known domains and protein families for a UniProt accession linked to your structure.",
      "Domains are reusable parts of proteins (like a binding pocket fold). Annotations come from InterPro — not from guesses.",
    ],
    lookFor: [
      "Domain or family names",
      "Signature matches with start/end positions",
      "Whether catalytic or binding terms appear",
    ],
  },
  clean: {
    summary: "What does this do?",
    paragraphs: [
      "CLEAN is an AI model that reads your protein's amino-acid sequence and predicts its EC number — a four-part code for the kind of chemical reaction an enzyme speeds up (for example EC 4.2.1.1 is carbonic anhydrase).",
      "The first digit is the big family (1 oxidoreductases, 2 transferases, 3 hydrolases, 4 lyases, 5 isomerases, 6 ligases, 7 translocases); each later digit narrows it down.",
      "This app sends your RCSB sequence to the public CLEAN server at UIUC MoleculeMaker. Each prediction has a confidence score from 0 to 1: High is 0.8 or more, Medium is 0.2–0.8, Low is under 0.2.",
      "If CLEAN's server can't return results, the step says so and offers Retry — you can also import a real CLEAN CSV. EC numbers are never invented.",
    ],
    lookFor: [
      "The top EC number and whether its confidence is High, Medium, or Low",
      "The enzyme name for that EC number (click it for the ExPASy entry)",
      "Whether the predicted chemistry fits SPRITE, InterPro, and BLAST evidence",
    ],
  },
  swissdock: {
    summary: "What does this do?",
    paragraphs: [
      "SwissDock tries docking a small molecule (ligand) into your protein to see possible binding poses.",
      "Docking is a computer model, not a lab experiment. The app only uses ligands found in your PDB (or a SMILES you provide) — it never invents ligands.",
    ],
    lookFor: [
      "Docking scores and poses when a ligand is present",
      "Whether the pose sits near candidate active-site residues",
      "Honest skip if no ligand was available",
    ],
  },
  "active-site-evidence": {
    summary: "What does this do?",
    paragraphs: [
      "Here you gather candidate active-site residues only when earlier modules support them.",
      "The platform never invents residues. Use the 3D viewer and ChimeraX commands to inspect positions you already recorded.",
    ],
    lookFor: [
      "Residues that show up in SPRITE pairs",
      "Agreement across BLAST / domains / docking",
      "Clear notes linking each residue to evidence",
    ],
  },
  "hypothesis-builder": {
    summary: "What does this do?",
    paragraphs: [
      "You write a short scientific claim about your protein’s possible function or active site.",
      "Link each claim to real evidence from your project. The app checks structure — it does not write the hypothesis for you.",
    ],
    lookFor: [
      "A clear claim in your own words",
      "Evidence links to module results",
      "Honest limits (what you still don’t know)",
    ],
  },
  "shannonbot-review": {
    summary: "What does this do?",
    paragraphs: [
      "ShannonBot is a Socratic mentor that asks questions about your evidence and hypothesis.",
      "It guides you back to recorded results. Chat replies are not experimental proof.",
    ],
    lookFor: [
      "Questions that push you toward your data",
      "Gaps or contradictions to fix",
      "A stronger, evidence-linked rewrite",
    ],
  },
  reports: {
    summary: "What does this do?",
    paragraphs: [
      "Reports build a markdown summary from what is already stored in your project.",
      "They document what you ran and what came back — never invented science.",
    ],
    lookFor: [
      "Module statuses and provenance",
      "Your hypothesis text",
      "A shareable record for teachers",
    ],
  },
  analysis: {
    summary: "How this works",
    paragraphs: [
      "After your PDB loads, one button runs the live tools in order on this site’s Worker.",
      "You stay on one URL — adapters talk to SPRITE, BLAST, Foldseek, and the rest. CLEAN stays import-only and is skipped honestly.",
      "When a tool finishes (or fails), Results shows the real outcome — never demo data swapped in.",
    ],
  },
};

export function getLabExplainer(
  key: string,
): LabExplainerCopy | undefined {
  return LAB_EXPLAINERS[key];
}
