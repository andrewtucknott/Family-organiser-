import { redirect } from "next/navigation";
import { getHousehold, getSession } from "@/lib/auth";
import { PinPad } from "./PinPad";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const household = getHousehold();
  if (!household) redirect("/setup");

  const session = await getSession();
  if (session) redirect(session.memberId ? "/calendar" : "/who");

  return (
    <main className="mx-auto flex min-h-dvh max-w-xs flex-col justify-center px-5 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{household.name}</h1>
        <p className="mt-1.5 text-sm text-muted">Enter the family PIN</p>
      </header>
      <PinPad />
    </main>
  );
}
