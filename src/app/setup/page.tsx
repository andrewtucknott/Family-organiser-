import { redirect } from "next/navigation";
import { getHousehold } from "@/lib/auth";
import { card } from "@/components/ui";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (getHousehold()) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Let's set up your family calendar
        </h1>
        <p className="mt-2 text-muted">
          One shared calendar everyone can see, on any phone or laptop in the house.
          This takes about a minute.
        </p>
      </header>

      <div className={`${card} p-6 sm:p-7`}>
        <SetupForm />
      </div>
    </main>
  );
}
