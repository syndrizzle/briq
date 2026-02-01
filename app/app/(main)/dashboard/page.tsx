"use client";

import { useSession } from "@/lib/auth-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  HouseIcon,
  PlusIcon,
  CurrencyDollarIcon,
  StarIcon,
  ArrowRightIcon,
  UsersIcon,
  CalendarIcon,
  ChartLineUpIcon,
} from "@phosphor-icons/react";

// Extended session type with our custom fields
interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  walletAddress?: string;
  userType?: "landlord" | "tenant";
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;
  const userName = user?.name || "there";
  const firstName = userName.split(" ")[0];
  const userType = user?.userType || "landlord"; // Default to landlord for now

  // Mock data for MVP demo - will be replaced with contract calls
  const landlordStats = {
    totalProperties: 2,
    activeAgreements: 1,
    pendingRequests: 3,
    totalEarnings: 450,
    briqRewards: 150,
    avgRating: 4.8,
  };

  const mockProperties = [
    {
      id: "1",
      title: "Modern 2BHK Apartment",
      location: "Koramangala, Bangalore",
      pricePerMonth: 250,
      isAvailable: true,
      pendingRequests: 2,
    },
    {
      id: "2",
      title: "Cozy Studio Near Metro",
      location: "HSR Layout, Bangalore",
      pricePerMonth: 150,
      isAvailable: false,
      pendingRequests: 0,
    },
  ];

  // Landlord Dashboard
  if (userType === "landlord") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Welcome back, {firstName}!
            </h1>
            <p className="text-muted-foreground">
              Manage your properties and track your earnings
            </p>
          </div>
          <Link href="/app/properties/new">
            <Button>
              <PlusIcon className="size-4" />
              List New Property
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                My Properties
              </CardTitle>
              <HouseIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {landlordStats.totalProperties}
              </div>
              <p className="text-xs text-muted-foreground">
                {landlordStats.activeAgreements} currently rented
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Requests
              </CardTitle>
              <UsersIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {landlordStats.pendingRequests}
              </div>
              <p className="text-xs text-muted-foreground">
                Awaiting your response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Earnings
              </CardTitle>
              <CurrencyDollarIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {landlordStats.totalEarnings.toLocaleString()} XLM
              </div>
              <p className="text-xs text-muted-foreground">
                Via Stellar escrow
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                BRIQ Rewards
              </CardTitle>
              <StarIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {landlordStats.briqRewards}
                </span>
                <Badge variant="secondary">BRIQ</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Rating: {landlordStats.avgRating} ★
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions + Recent Properties */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* My Properties */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>My Properties</CardTitle>
                <Link
                  href="/app/properties"
                  className="text-sm text-primary hover:underline"
                >
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockProperties.map((property) => (
                  <div
                    key={property.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{property.title}</p>
                        <Badge
                          variant={
                            property.isAvailable ? "default" : "secondary"
                          }
                        >
                          {property.isAvailable ? "Available" : "Rented"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {property.location}
                      </p>
                      <p className="text-sm">
                        {property.pricePerMonth.toLocaleString()} XLM/month
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {property.pendingRequests > 0 && (
                        <Badge
                          variant="outline"
                          className="border-orange-500 text-orange-500"
                        >
                          {property.pendingRequests} requests
                        </Badge>
                      )}
                      <Link href={`/app/properties/${property.id}`}>
                        <Button variant="ghost" size="sm">
                          <ArrowRightIcon className="size-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}

                {mockProperties.length === 0 && (
                  <div className="py-8 text-center">
                    <HouseIcon className="mx-auto size-12 text-muted-foreground/50" />
                    <p className="mt-2 text-muted-foreground">
                      No properties listed yet
                    </p>
                    <Link href="/app/properties/new">
                      <Button className="mt-4" variant="outline">
                        <PlusIcon className="size-4" />
                        List your first property
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/app/properties/new" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <PlusIcon className="size-4" />
                    List New Property
                  </Button>
                </Link>
                <Link href="/app/agreements" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="size-4" />
                    View Agreements
                  </Button>
                </Link>
                <Link href="/app/payments" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <CurrencyDollarIcon className="size-4" />
                    Payment History
                  </Button>
                </Link>
                <Link href="/app/reviews" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <StarIcon className="size-4" />
                    My Reviews
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Wallet Connected</CardTitle>
              </CardHeader>
              <CardContent>
                {user?.walletAddress ? (
                  <div className="space-y-2">
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {user.walletAddress}
                    </p>
                    <Badge
                      variant="outline"
                      className="border-green-500 text-green-500"
                    >
                      Stellar Testnet
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Wallet not connected
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Tenant Dashboard (placeholder - will implement after landlord)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {firstName}!</h1>
        <p className="text-muted-foreground">Find your next home on Briq</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Rentals
            </CardTitle>
            <HouseIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Current agreements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Payments
            </CardTitle>
            <CurrencyDollarIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 XLM</div>
            <p className="text-xs text-muted-foreground">Due this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BRIQ Rewards</CardTitle>
            <StarIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">0</span>
              <Badge variant="secondary">BRIQ</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Browse Properties</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <ChartLineUpIcon className="mx-auto size-12 text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">
            Start exploring available properties
          </p>
          <Link href="/app/properties">
            <Button className="mt-4">
              <HouseIcon className="size-4" />
              Browse Properties
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
