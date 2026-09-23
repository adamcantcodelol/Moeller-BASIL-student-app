import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { HypothesisForm } from "@/components/hypothesis/HypothesisForm";
import { ShannonBotChat } from "@/components/shannonbot/ShannonBotChat";
import { getRequestDatabase } from "@/lib/db/request";
import { getProjectOverview, ServiceError } from "@/lib/services/projectService";
import { getHypothesisForProject } from "@/lib/services/hypothesisService";
import { getShannonBotConversation } from "@/lib/services/shannonBotService";
import { listEvidenceForProject } from "@/lib/services/evidenceService";

export const dynamic = "force-dynamic";

export default async function HypothesisPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const db = await getRequestDatabase();
  const overview = await getProjectOverview(db, projectId).catch(
    (error: unknown) => {
      if (error instanceof ServiceError && error.status === 404) {
        notFound();
      }
      throw error;
    },
  );

  const [hypothesisPayload, evidence, conversation] = await Promise.all([
    getHypothesisForProject(db, projectId),
    listEvidenceForProject(db, projectId),
    getShannonBotConversation(db, projectId),
  ]);

  return (
    <AppShell projectId={projectId} moduleRuns={overview.moduleRuns}>
      <DemoBanner show={overview.project.isDemo} />
      <section className="card">
        <h1>Hypothesis</h1>
        <p>
          Write <strong>your own</strong> evidence-linked hypothesis. ShannonBot
          is a Socratic mentor only — it must not author the claim for you, and
          it never invents scientific results.
        </p>
        <div className="mode-row">
          <Link href={`/projects/${projectId}`}>Project overview</Link>
          <Link href={`/projects/${projectId}/results`}>Results</Link>
          <Link href={`/projects/${projectId}/modules/hypothesis-builder`}>
            Full hypothesis module
          </Link>
          <Link href={`/projects/${projectId}/modules/shannonbot-review`}>
            Full ShannonBot module
          </Link>
        </div>
      </section>

      <div className="hypothesis-split">
        <section className="card">
          <h2>Your hypothesis</h2>
          <p className="muted">
            Evidence residues available: {evidence.length}. Cite only residues
            you recorded from real module outputs.
          </p>
          {evidence.length > 0 ? (
            <ul>
              {evidence.slice(0, 12).map((item) => (
                <li key={item.id}>
                  {item.sourceModuleId}: {item.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              No evidence residues yet — you can still draft, then refine after
              Active-Site Evidence Synthesis.
            </p>
          )}
          <HypothesisForm
            projectId={projectId}
            initialText={hypothesisPayload.hypothesis?.text ?? ""}
            initialReview={hypothesisPayload.review}
          />
          {hypothesisPayload.versions.length > 0 ? (
            <div>
              <h3>Version history</h3>
              {hypothesisPayload.versions.map((version) => (
                <p key={version.id}>
                  <span className="muted">{version.createdAt}</span>
                  <br />
                  {version.text}
                </p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2>ShannonBot (mentor)</h2>
          <p className="muted">
            Ask questions about your evidence and draft. ShannonBot guides — it
            does not write the hypothesis.
          </p>
          <ShannonBotChat
            projectId={projectId}
            initialMessages={conversation.messages}
            blocker={conversation.blocker}
            mode={conversation.mode}
            notice={conversation.notice}
            provider={conversation.provider}
          />
        </section>
      </div>
    </AppShell>
  );
}
