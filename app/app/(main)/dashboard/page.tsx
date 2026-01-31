"use client";

import { useSession } from "@/lib/auth-client";

export default function DashboardPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "there";
  const firstName = userName.split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {firstName}!</h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your activity on Briq.
        </p>
      </div>

      {/* Placeholder content - will be expanded later */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Properties</p>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Active Agreements</p>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">BRIQ Rewards</p>
          <p className="text-2xl font-bold">0</p>
        </div>
      </div>
    </div>
  );
}
