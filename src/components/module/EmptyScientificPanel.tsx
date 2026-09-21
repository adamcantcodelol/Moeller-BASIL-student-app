export function EmptyScientificPanel({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="empty-scientific">
      <h3>{title}</h3>
      <p>{message}</p>
    </section>
  );
}
