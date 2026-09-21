"use client";

export default function ErrorPage({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <main className="card" style={{ margin: "2rem" }}>
      <h1>Something went wrong</h1>
      <p className="muted">
        The platform preserved this as an application error, not a scientific
        result. {error.message}
      </p>
    </main>
  );
}
