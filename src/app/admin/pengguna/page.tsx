import { asc } from "drizzle-orm";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { setUserActive } from "../actions";
import { CreateUserForm, ResetPasswordForm } from "./user-forms";

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Pengguna" description="Akun admin dan tim lapangan." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const me = await requireUser("admin");
  const users = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      username: schema.users.username,
      role: schema.users.role,
      active: schema.users.active,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.name));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr>
              <th className="th">Nama</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">Reset password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="td">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted">@{u.username}</div>
                </td>
                <td className="td">{u.role === "admin" ? "Admin" : "Tim lapangan"}</td>
                <td className="td">
                  {u.id === me.id ? (
                    <span className="text-muted">Anda</span>
                  ) : (
                    <form action={setUserActive.bind(null, u.id, !u.active)}>
                      <button className={`btn px-2.5 py-1 text-xs ${u.active ? "" : "text-muted"}`}>
                        {u.active ? "Aktif" : "Nonaktif"}
                      </button>
                    </form>
                  )}
                </td>
                <td className="td">
                  <ResetPasswordForm userId={u.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CreateUserForm />
    </div>
  );
}
