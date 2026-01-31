import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function AppPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // TODO: Check if user has connected wallet, if not redirect to onboarding
  // For now, redirect to dashboard
  redirect("/app/dashboard");

  return null;
}
