import Link from "next/link";
import { getRequestIdentity } from "@/lib/auth/request";
import { SwitchStudentButton } from "@/components/identity/SwitchStudentButton";

export async function CourseHeader() {
  const identity = await getRequestIdentity().catch(() => null);
  const student = identity?.student ?? null;
  return (
    <header className="course-header">
      <p>Moeller High · Molecular Biology</p>
      <h1>
        <Link href="/">BASIL Student Lab</Link>
      </h1>
      {student ? (
        <p className="identity-chip">
          Signed in as {student.studentName} · {student.classCode}{" "}
          <SwitchStudentButton />
        </p>
      ) : null}
    </header>
  );
}
