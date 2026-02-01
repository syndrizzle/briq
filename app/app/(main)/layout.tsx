"use client";

import { AppNavbar } from "@/components/app-navbar";
import { OnboardingGuard } from "@/components/onboarding-guard";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <AppNavbar />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </OnboardingGuard>
  );
}
