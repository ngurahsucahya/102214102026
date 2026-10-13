import type { Metadata } from "next";
import { DoorMark } from "@/components/door-mark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <DoorMark className="mb-3 h-14 w-10" />
          <h1 className="text-2xl font-semibold">Pintu Custom</h1>
          <p className="mt-1 text-sm text-muted">Masuk untuk melanjutkan</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
