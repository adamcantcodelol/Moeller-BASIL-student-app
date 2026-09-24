import type { Metadata } from "next";
import Link from "next/link";
import { getRequestDatabase } from "@/lib/db/request";
import { isTeacherRequest } from "@/lib/auth/request";
import { listClasses } from "@/lib/db/queries/classes";
import { listProjectsForClasses } from "@/lib/db/queries/projects";
import {
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
  const projects = await listProjectsForClasses(db, classes.map((c) => c.code));

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
