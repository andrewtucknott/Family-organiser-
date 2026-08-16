import { redirect } from "next/navigation";
import { getHousehold, getSession, setSessionMember } from "@/lib/auth";
import { listMembers } from "@/lib/members";
import { Avatar, button, card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WhoPage() {
  const household = getHousehold();
  if (!household) redirect("/setup");

  const session = await getSession();
  if (!session) redirect("/login");

  const members = listMembers(session.householdId);

  async function choose(form: FormData) {
    "use server";
    const memberId = form.get("memberId");
    await setSessionMember(typeof memberId === "string" && memberId ? memberId : null);
    redirect("/calendar");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Who's using this?</h1>
        <p className="mt-1.5 text-sm text-muted">
          This device will remember, so you only pick once.
        </p>
      </header>

      <div className={`${card} divide-y divide-line overflow-hidden`}>
        {members.map((member) => (
          <form action={choose} key={member.id}>
            <input type="hidden" name="memberId" value={member.id} />
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-hover"
            >
              <Avatar member={member} size="lg" />
              <span className="text-base font-medium text-ink">{member.name}</span>
            </button>
          </form>
        ))}
      </div>

      <form action={choose} className="mt-4">
        <button type="submit" className={`${button.ghost} w-full`}>
          Skip for now
        </button>
      </form>
    </main>
  );
}
