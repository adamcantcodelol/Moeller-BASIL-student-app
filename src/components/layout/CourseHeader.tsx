import Link from "next/link";

export function CourseHeader() {
  return (
    <header className="course-header">
      <p>Moeller High · Molecular Biology</p>
      <h1>
        <Link href="/">BASIL Student Lab</Link>
      </h1>
    </header>
  );
}
