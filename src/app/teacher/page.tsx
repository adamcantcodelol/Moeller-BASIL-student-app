import type { Metadata } from "next";
import Link from "next/link";
import { getRequestDatabase } from "@/lib/db/request";
import { isTeacherRequest } from "@/lib/auth/request";
import { listClasses } from "@/lib/db/queries/classes";
import { listProjectsForClasses } from "@/lib/db/queries/projects";
import { listLatestHypotheses } from "@/lib/teacher/hypothesisExport";
import { getAiKeyStatus, getSettingsSecret } from "@/lib/settings/aiKeys";
import {
  TeacherAiKeyForm,
  TeacherClassActions,
  TeacherCreateClassForm,
  TeacherLoginForm,
  TeacherLogoutButton,
} from "@/components/teacher/TeacherControls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BASIL · Teacher",
  robots: { index: false, follow: false },
};

export default async function TeacherPage() {
  if (!(await isTeacherRequest())) {
    return (
      <main className="main-panel" style={{ maxWidth: 420, margin: "3rem auto" }}>
        <section className="card">
          <h2>Teacher sign-in</h2>
          <TeacherLoginForm />
        </section>
      </main>
    );
  }

  const db = await getRequestDatabase();
  const classes = await listClasses(db);
  const codes = classes.map((c) => c.code);
  const [projects, hypothesisRows, aiKeys] = await Promise.all([
    listProjectsForClasses(db, codes),
    listLatestHypotheses(db, codes),
    getAiKeyStatus(db, await getSettingsSecret()),
  ]);
  const hypothesisByProject = new Map(hypothesisRows.map((h) => [h.projectId, h]));

  return (
    <main className="main-panel" style={{ maxWidth: 1000, margin: "1.5rem auto" }}>
      <section className="card">
        <h2>Teacher dashboard</h2>
        <p className="muted">
          Create a class to get a code for students. Students enter their name
          and the code on the BASIL home page. <TeacherLogoutButton />
        </p>
        <TeacherCreateClassForm />
      </section>
      <TeacherHelp />
      <section className="card">
        <h3>ShannonBot AI key</h3>
        <p className="muted">
          Optional. ShannonBot works without a key in a simpler built-in Socratic mode.
          With a free Groq or OpenRouter key it gives richer questions (it still never
          writes the student&apos;s hypothesis). The key is stored encrypted on the
          server and is never shown again — only its last 4 characters.
        </p>
        <TeacherAiKeyForm initial={aiKeys} />
      </section>
      {classes.length === 0 ? <p>No classes yet.</p> : null}
      {classes.map((c) => {
        const rows = projects.filter((p) => p.classCode === c.code);
        const students = new Set(rows.map((r) => r.studentName ?? ""));
        return (
          <section className="card" key={c.code}>
            <h3>{c.name}</h3>
            <p className="class-code-big">{c.code}</p>
            <p>
              {c.active ? "Active — students can join." : "Inactive — new joins are blocked."}{" "}
              <TeacherClassActions code={c.code} active={c.active} />
            </p>
            <p className="muted">
              {students.size} student{students.size === 1 ? "" : "s"} · {rows.length} project
              {rows.length === 1 ? "" : "s"}
              {rows.length > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={`/api/teacher/hypotheses/export?class=${encodeURIComponent(c.code)}`}
                    download
                  >
                    Export hypotheses (CSV)
                  </a>
                </>
              ) : null}
            </p>
            {rows.length > 0 ? (
              <table className="teacher-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Project</th>
                    <th>PDB ID</th>
                    <th>Created</th>
                    <th>Pipeline</th>
                    <th>Current hypothesis</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.studentName}</td>
                      <td>
                        <Link href={`/projects/${r.id}`}>{r.name}</Link>
                      </td>
                      <td>{r.pdbId ?? "—"}</td>
                      <td>{r.createdAt.slice(0, 10)}</td>
                      <td>{r.pipelineStatus ?? "not started"}</td>
                      <td className="hypothesis-cell">
                        <HypothesisCell
                          projectId={r.id}
                          text={hypothesisByProject.get(r.id)?.hypothesisText ?? null}
                          updatedAt={hypothesisByProject.get(r.id)?.lastUpdated ?? null}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        );
      })}
    </main>
  );
}

function HypothesisCell({
  projectId,
  text,
  updatedAt,
}: {
  projectId: string;
  text: string | null;
  updatedAt: string | null;
}) {
  if (!text) return <span className="muted">No hypothesis saved yet</span>;
  const preview = text.length > 90 ? `${text.slice(0, 90)}…` : text;
  const base = `/api/teacher/projects/${encodeURIComponent(projectId)}/hypothesis`;
  return (
    <details>
      <summary>{preview}</summary>
      <p>{text}</p>
      <span className="muted">
        Saved {updatedAt ? updatedAt.slice(0, 16).replace("T", " ") + " UTC" : "—"} ·{" "}
        <a href={`${base}?format=txt`} download>
          Download .txt
        </a>{" "}
        ·{" "}
        <a href={`${base}?format=csv`} download>
          .csv
        </a>
      </span>
    </details>
  );
}

function TeacherHelp() {
  return (
    <section className="card teacher-help">
      <details>
        <summary>
          <strong>How teacher mode works</strong>
        </summary>
        <ol>
          <li>
            <strong>Sign in:</strong> open <code>/teacher</code> (it isn&apos;t linked from
            student pages) and enter the teacher password. Your session lasts 12 hours on
            this browser; use <em>Sign out</em> on shared computers.
          </li>
          <li>
            <strong>Create a class code:</strong> type a class name (e.g. &ldquo;Period 3&rdquo;)
            and press <em>Generate class code</em>. Each class gets its own short code.
          </li>
          <li>
            <strong>Give the code to students:</strong> write the big code on the board.
            Students open the BASIL home page, enter their name and the code, then create
            projects as usual. Their projects appear under that class below.
          </li>
          <li>
            <strong>Turn a code off:</strong> press <em>Deactivate</em> to stop new students
            joining with that code (existing work is kept). <em>Reactivate</em> turns it
            back on.
          </li>
          <li>
            <strong>View student projects:</strong> each class lists students, projects, PDB
            IDs and pipeline status. Click a project name to open it.
          </li>
          <li>
            <strong>Export hypotheses:</strong> the <em>Current hypothesis</em> column shows
            each student&apos;s most recently saved hypothesis (click to expand, or download
            it as .txt/.csv). <em>Export hypotheses (CSV)</em> downloads the whole class:
            student name, class code, project, PDB ID, hypothesis and last-updated time.
            Projects without a saved hypothesis are marked as such — nothing is filled in.
          </li>
          <li>
            <strong>Set the AI API key (optional):</strong> in <em>ShannonBot AI key</em>,
            choose Groq or OpenRouter, paste a free key and press <em>Save key</em>, then
            <em> Test key</em>. Pasting a new key replaces the old one; <em>Remove</em>
            deletes it. Without a working key ShannonBot falls back to its built-in
            question mode, so class never stops.
          </li>
        </ol>
      </details>
    </section>
  );
}
