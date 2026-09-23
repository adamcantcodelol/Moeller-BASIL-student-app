export interface Hypothesis {
  id: string;
  projectId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface HypothesisVersion {
  id: string;
  hypothesisId: string;
  text: string;
  reasonForChange: string | null;
  createdAt: string;
}

export interface HypothesisCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface HypothesisReview {
  checks: HypothesisCheck[];
  /** Guidance only — never a replacement hypothesis written by the system. */
  guidance: string[];
}
