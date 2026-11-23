import { PageHeader } from "@/features/admin/ui/PageHeader";

export function PagePlaceholder({ title }: { title: string }) {
  return (
    <section className="space-y-6">
      <PageHeader title={title} description="This screen is coming soon." />
    </section>
  );
}
