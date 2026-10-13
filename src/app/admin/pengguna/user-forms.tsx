"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormAlert } from "@/components/admin-ui";
import { createUser, resetPassword, type FormState } from "../actions";

export function CreateUserForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const fe = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="card space-y-4 p-5">
      <h2 className="text-lg font-semibold">Tambah pengguna</h2>
      <div>
        <label className="label" htmlFor="u-name">
          Nama
        </label>
        <input id="u-name" name="name" className="input" required />
        <FieldError message={fe.name} />
      </div>
      <div>
        <label className="label" htmlFor="u-username">
          Username
        </label>
        <input id="u-username" name="username" autoCapitalize="none" className="input" required />
        <FieldError message={fe.username} />
      </div>
      <div>
        <label className="label" htmlFor="u-password">
          Password
        </label>
        <input id="u-password" name="password" type="password" autoComplete="new-password" className="input" required />
        <FieldError message={fe.password} />
      </div>
      <div>
        <label className="label" htmlFor="u-role">
          Role
        </label>
        <select id="u-role" name="role" className="input" defaultValue="field">
          <option value="field">Tim lapangan</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <FormAlert state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Menyimpan…" : "Tambah"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword.bind(null, userId), undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input
        name="password"
        type="password"
        placeholder="Password baru"
        aria-label="Password baru"
        autoComplete="new-password"
        className="input max-w-36 py-1.5"
      />
      <button className="btn px-2.5 py-1.5 text-xs" disabled={pending}>
        Ubah
      </button>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
      {state?.ok && <span className="text-xs text-ok">Diubah</span>}
    </form>
  );
}
