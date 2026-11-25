import { useState } from "react";
import { ShieldAlert, SlidersHorizontal, Users } from "lucide-react";
import {
  ErrorState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { useSettings } from "@/features/admin/settings/hooks";
import { ThresholdsForm } from "@/features/admin/settings/ThresholdsForm";
import { PolicyForm } from "@/features/admin/settings/PolicyForm";
import { describeError } from "@/features/admin/ui/errors";
import { UsersPanel } from "@/features/admin/settings/UsersPanel";
import { PageHeader } from "@/features/admin/ui/PageHeader";

const TABS = [
  { id: "thresholds", label: "Risk thresholds", icon: SlidersHorizontal },
  { id: "policy", label: "Recovery policy", icon: ShieldAlert },
  { id: "users", label: "Users & roles", icon: Users },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading settings</span>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export default function TenantSettings() {
  const [tab, setTab] = useState<TabId>("thresholds");
  const settings = useSettings();

  const errView = describeError(
    settings.error,
    "Only tenant admins can view or change settings.",
  );

  const body = (id: "thresholds" | "policy") =>
    settings.isLoading ? (
      <Loading />
    ) : settings.isError || !settings.data ? (
      <ErrorState
        title={errView.title}
        message={errView.message}
        correlationId={errView.correlationId}
        onRetry={errView.retryable ? () => settings.refetch() : undefined}
      />
    ) : id === "thresholds" ? (
      <ThresholdsForm settings={settings.data} />
    ) : (
      <PolicyForm settings={settings.data} />
    );

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Tenant Settings"
        description="Tune risk bands, recovery policy and who has access. Admin only."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabId)}
        className="space-y-6"
      >
        <TabsList aria-label="Settings sections">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-2">
              <t.icon className="h-4 w-4" aria-hidden="true" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="thresholds">{body("thresholds")}</TabsContent>
        <TabsContent value="policy">{body("policy")}</TabsContent>
        <TabsContent value="users">
          <UsersPanel />
        </TabsContent>
      </Tabs>
    </section>
  );
}
