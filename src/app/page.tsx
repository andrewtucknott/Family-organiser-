import { redirect } from "next/navigation";
import { getHousehold, getSession } from "@/lib/auth";

/** The front door: send everyone to the right place for how far they've got. */
export default async function Home() {
  if (!getHousehold()) redirect("/setup");

  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.memberId) redirect("/who");

  redirect("/calendar");
}
