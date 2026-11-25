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
import { ApprovalForm } from "@/features/admin/settings/ApprovalForm";
import { UsersPanel } from "@/features/admin/settings/UsersPanel";
import { PageHeader } from "@/features/admin/ui/PageHeader";

const TABS = [
  { id: "thresholds", label: "Risk thresholds", icon: SlidersHorizontal },
  { id: "approval", label: "Approval", icon: ShieldAlert },
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

  const body = (id: "thresholds" | "approval") =>
    settings.isLoading ? (
      <Loading />
    ) : settings.isError || !settings.data ? (
      <ErrorState
        message={
          settings.error instanceof Error
            ? settings.error.message
            : "Could not load settings."
        }
        onRetry={() => settings.refetch()}
      />
    ) : id === "thresholds" ? (
      <ThresholdsForm settings={settings.data} />
    ) : (
      <ApprovalForm settings={settings.data} />
    );

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Tenant Settings"
        description="Tune risk bands, approval rules and who has access. Admin only."
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
        <TabsContent value="approval">{body("approval")}</TabsContent>
        <TabsContent value="users">
          <UsersPanel />
        </TabsContent>
      </Tabs>
    </section>
  );
}
