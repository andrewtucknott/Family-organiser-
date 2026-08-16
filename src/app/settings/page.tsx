import Link from "next/link";
import { redirect } from "next/navigation";
import { getHousehold, getSession } from "@/lib/auth";
import { listMembers } from "@/lib/members";
import { button, card } from "@/components/ui";
import { MemberRow } from "./MemberRow";
import { AddMemberForm, ChangePinForm } from "./SettingsForms";
import { signOut, switchMember } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const household = getHousehold();
  if (!household) redirect("/setup");

  const session = await getSession();
  if (!session) redirect("/login");

  const members = listMembers(session.householdId);

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-20">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Settings</h1>
          <p className="text-sm text-muted">{household.name}</p>
        </div>
        <Link href="/calendar" className={button.secondary}>
          Back to calendar
        </Link>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-muted">Family members</h2>
        <div className={`${card} divide-y divide-line overflow-hidden`}>
          <ul className="divide-y divide-line">
            {members.map((member) => (
              <MemberRow key={member.id} member={member} canRemove={members.length > 1} />
            ))}
          </ul>
          <AddMemberForm />
        </div>
        <p className="mt-2 text-xs text-faint">
          Removing someone keeps their name on events already in the calendar — nothing
          in your history disappears.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-muted">Family PIN</h2>
        <div className={`${card} overflow-hidden`}>
          <ChangePinForm />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">This device</h2>
        <div className={`${card} flex flex-wrap gap-3 p-4`}>
          <form action={switchMember}>
            <button type="submit" className={button.secondary}>
              Switch who I am
            </button>
          </form>
          <form action={signOut}>
            <button type="submit" className={button.secondary}>
              Sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
