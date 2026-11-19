import { useState, type FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { USER_ROLES, type NewUser } from '@/api/admin/settings';
import { Button, ErrorState, Field, Input, Select, Spinner, TBody, TD, TH, THead, TR, Table } from '@/components/ui';
import { fieldErrors, useAddUser, useTenantUsers } from './hooks';

const label = (r: string) =>
  r
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const blank: NewUser = { username: '', full_name: '', email: '', role: 'VIEWER' };

export function UsersPanel() {
  const users = useTenantUsers();
  const add = useAddUser();
  const [form, setForm] = useState<NewUser>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const set = (k: keyof NewUser) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setAdded(null);
    add.mutate(form, {
      onSuccess: (u) => {
        setForm(blank);
        setAdded(u.username);
      },
      onError: (err) => {
        if (err instanceof ApiError && (err.code === 'VALIDATION_ERROR' || err.code === 'CONFLICT')) {
          setErrors(fieldErrors(err.details));
          setFormError(err.message);
        } else {
          setFormError(err instanceof Error ? err.message : 'Could not add user.');
        }
      },
    });
  };

  return (
    <div className="space-y-8">
      {users.isLoading && <Spinner label="Loading users" />}
      {users.isError && (
        <ErrorState
          message={users.error instanceof Error ? users.error.message : 'Could not load users.'}
          onRetry={() => users.refetch()}
        />
      )}
      {users.data && (
        <Table>
          <THead>
            <TR>
              <TH>Username</TH>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {users.data.map((u) => (
              <TR key={u.id}>
                <TD>{u.username}</TD>
                <TD>{u.full_name}</TD>
                <TD>{u.email}</TD>
                <TD>{label(u.role)}</TD>
                <TD>{u.active ? 'Active' : 'Inactive'}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <form onSubmit={onSubmit} noValidate aria-label="Add user" className="max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Add user</h2>
        <Field label="Username" error={errors.username}>
          <Input value={form.username} onChange={set('username')} autoComplete="off" />
        </Field>
        <Field label="Full name" error={errors.full_name}>
          <Input value={form.full_name} onChange={set('full_name')} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Role" error={errors.role}>
          <Select value={form.role} onChange={set('role')}>
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
        {added && (
          <p role="status" className="text-sm font-medium text-success">
            User {added} added.
          </p>
        )}
        <Button type="submit" loading={add.isPending}>
          Add user
        </Button>
      </form>
    </div>
  );
}
