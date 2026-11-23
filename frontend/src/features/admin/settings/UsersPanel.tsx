import { useState, type FormEvent } from "react";
import { UserPlus, Users } from "lucide-react";
import { ApiError } from "@/api/client";
import { USER_ROLES, type NewUser } from "@/api/admin/settings";
import {
  Badge,
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
          <h2 className="text-sm font-semibold">Users &amp; roles</h2>
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
            <Skeleton key={i} className="h-14 w-full rounded-md" />
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
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <Users
            className="h-10 w-10 text-muted"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="text-sm font-semibold">No users yet</p>
          <p className="text-sm text-muted">
            Add the first user to start collaborating.
          </p>
        </div>
      )}
      {users.data && users.data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
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
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-muted"
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
                    <Badge tone={u.role === "ADMIN" ? "primary" : "neutral"}>
                      {label(u.role)}
                    </Badge>
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          u.active ? "bg-success" : "bg-slate-400",
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
