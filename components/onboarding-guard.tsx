"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";

interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  walletAddress?: string;
  userType?: "landlord" | "tenant";
}

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * Redirects users to onboarding if they haven't completed it.
 * Onboarding is complete when user has both walletAddress and userType set.
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const user = session?.user as ExtendedUser | undefined;

  useEffect(() => {
    // Wait for session to load
    if (isPending) return;

    // Not logged in - let auth handle it
    if (!session) return;

    // Check if onboarding is complete
    const hasWallet = !!user?.walletAddress;
    const hasUserType = !!user?.userType;
    const isOnboardingComplete = hasWallet && hasUserType;

    // If onboarding not complete, redirect to onboarding
    if (!isOnboardingComplete) {
      router.replace("/app/onboarding");
    }
  }, [isPending, session, user, router, pathname]);

  // Show nothing while checking
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If not logged in, let auth middleware handle
  if (!session) {
    return null;
  }

  // Check onboarding status
  const isOnboardingComplete = !!user?.walletAddress && !!user?.userType;

  // If onboarding not complete, show loading while redirecting
  if (!isOnboardingComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Redirecting to onboarding...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
