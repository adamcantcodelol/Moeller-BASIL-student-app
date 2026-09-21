import Link from "next/link";

export function CourseHeader() {
  return (
    <header className="course-header">
      <p>Archbishop Moeller High School · Molecular Biology Research Course</p>
      <h1>
        <Link href="/">BASIL Protein Platform</Link>
      </h1>
    </header>
  );
}
