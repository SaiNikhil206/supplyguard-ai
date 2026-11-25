export function PagePlaceholder({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">This screen is coming soon.</p>
    </section>
  );
}
