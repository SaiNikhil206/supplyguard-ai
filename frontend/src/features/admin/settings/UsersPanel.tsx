import { useState, type FormEvent } from "react";
import { UserPlus, Users } from "lucide-react";
import { ApiError } from "@/api/client";
import { USER_ROLES, type NewUser } from "@/api/admin/settings";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  toast,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { fieldErrors, useAddUser, useTenantUsers } from "./hooks";

const label = (r: string) =>
  r
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const ROLE_STYLE: Record<string, string> = {
  ADMIN: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400",
  PROCUREMENT_MANAGER:
    "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400",
  OPS_MANAGER: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
  VIEWER:
    "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const blank: NewUser = {
  username: "",
  full_name: "",
  email: "",
  role: "VIEWER",
};

export function UsersPanel() {
  const users = useTenantUsers();
  const add = useAddUser();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewUser>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set =
    (k: keyof NewUser) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setForm(blank);
      setErrors({});
      setFormError(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    add.mutate(form, {
      onSuccess: (u) => {
        toast.success(`User ${u.username} added`);
        onOpenChange(false);
      },
      onError: (err) => {
        if (
          err instanceof ApiError &&
          (err.code === "VALIDATION_ERROR" || err.code === "CONFLICT")
        ) {
          setErrors(fieldErrors(err.details));
          setFormError(err.message);
        } else {
          setFormError(
            err instanceof Error ? err.message : "Could not add user.",
          );
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Users &amp; roles</h2>
          <p className="text-sm text-muted">
            Who can see, approve and administer this tenant.
          </p>
        </div>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add user
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form
              onSubmit={onSubmit}
              noValidate
              aria-label="Add user"
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>New user</DialogTitle>
                <DialogDescription>
                  They can sign in once an administrator shares their
                  credentials.
                </DialogDescription>
              </DialogHeader>
              <Field label="Username" error={errors.username}>
                <Input
                  value={form.username}
                  onChange={set("username")}
                  autoComplete="off"
                />
              </Field>
              <Field label="Full name" error={errors.full_name}>
                <Input value={form.full_name} onChange={set("full_name")} />
              </Field>
              <Field label="Email" error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                />
              </Field>
              <Field label="Role" error={errors.role}>
                <Select value={form.role} onChange={set("role")}>
                  {USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {label(r)}
                    </option>
                  ))}
                </Select>
              </Field>
              {formError && (
                <p role="alert" className="text-sm font-medium text-danger">
                  {formError}
                </p>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={add.isPending}>
                  Create user
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {users.isLoading && (
        <div className="space-y-2" role="status" aria-busy="true">
          <span className="sr-only">Loading users</span>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}
      {users.isError && (
        <ErrorState
          message={
            users.error instanceof Error
              ? users.error.message
              : "Could not load users."
          }
          onRetry={() => users.refetch()}
        />
      )}
      {users.data && users.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-lg font-semibold">No users yet</p>
          <p className="text-sm text-muted">
            Add the first user to start collaborating.
          </p>
        </div>
      )}
      {users.data && users.data.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-2 shadow-sm">
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {users.data.map((u) => (
                <TR key={u.id} className="h-14">
                  <TD>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-xs font-semibold text-white"
                      >
                        {initials(u.full_name)}
                      </span>
                      <div className="leading-tight">
                        <div className="text-sm font-medium">{u.full_name}</div>
                        <div className="font-mono text-xs text-muted">
                          {u.username}
                        </div>
                      </div>
                    </div>
                  </TD>
                  <TD>{u.email}</TD>
                  <TD>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
                        ROLE_STYLE[u.role] ?? ROLE_STYLE.VIEWER,
                      )}
                    >
                      {label(u.role)}
                    </span>
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-2 w-2 rounded-full",
                          u.active ? "bg-emerald-500" : "bg-slate-400",
                        )}
                      />
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
