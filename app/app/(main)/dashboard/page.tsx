"use client";

import { useState, useEffect, useCallback } from "react";
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
  SpinnerIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import {
  getPropertiesByOwner,
  getAgreementsByTenant,
  getAgreementsByLandlord,
  getEscrowAccount,
  type Property,
  type RentalAgreement,
  AgreementStatus,
} from "@/lib/contracts";

// Extended session type with our custom fields
interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  walletAddress?: string;
  userType?: "landlord" | "tenant";
}

// Convert stroops to XLM
const STROOPS_PER_XLM = BigInt(10_000_000);

function formatXLM(stroops: bigint): string {
  const xlm = Number(stroops) / Number(STROOPS_PER_XLM);
  return xlm.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// Shorten wallet address for display
function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;
  const userName = user?.name || "there";
  const firstName = userName.split(" ")[0];
  const userType = user?.userType || "landlord";

  const [isLoading, setIsLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<bigint>(BigInt(0));
  const [totalPaid, setTotalPaid] = useState<bigint>(BigInt(0));
  const [depositsHeld, setDepositsHeld] = useState<bigint>(BigInt(0));

  const isLandlord = userType === "landlord";

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user?.walletAddress) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch agreements based on role
      const fetchedAgreements = isLandlord
        ? await getAgreementsByLandlord(user.walletAddress)
        : await getAgreementsByTenant(user.walletAddress);

      setAgreements(fetchedAgreements);

      // Fetch properties for landlords
      if (isLandlord) {
        const fetchedProperties = await getPropertiesByOwner(
          user.walletAddress,
        );
        setProperties(fetchedProperties);
      }

      // Fetch escrow data for all agreements
      let earnings = BigInt(0);
      let paid = BigInt(0);
      let deposits = BigInt(0);

      for (const agreement of fetchedAgreements) {
        const escrow = await getEscrowAccount(agreement.id);
        if (escrow) {
          if (isLandlord) {
            earnings += escrow.totalRentReleased;
            if (!escrow.isDepositReleased) {
              deposits += escrow.securityDepositHeld;
            }
          } else {
            paid += escrow.totalRentReceived;
            if (!escrow.isDepositReleased) {
              deposits += escrow.securityDepositHeld;
            }
          }
        }
      }

      setTotalEarnings(earnings);
      setTotalPaid(paid);
      setDepositsHeld(deposits);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.walletAddress, isLandlord]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate stats
  const activeAgreements = agreements.filter(
    (a) => a.status === AgreementStatus.Active,
  );
  const pendingRequests = agreements.filter(
    (a) => a.status === AgreementStatus.PendingLandlordApproval,
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <SpinnerIcon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Landlord Dashboard
  if (isLandlord) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {firstName}!</h1>
            <p className="text-muted-foreground">
              Manage your properties and track your earnings
            </p>
          </div>
          <Link href="/app/properties/new">
            <Button className="w-full sm:w-auto">
              <PlusIcon className="size-4" />
              List New Property
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                My Properties
              </CardTitle>
              <HouseIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{properties.length}</div>
              <p className="text-xs text-muted-foreground">
                {activeAgreements.length} currently rented
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
              <div className="text-2xl font-bold">{pendingRequests.length}</div>
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
                {formatXLM(totalEarnings)} XLM
              </div>
              <p className="text-xs text-muted-foreground">
                Via Stellar escrow
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Deposits Held
              </CardTitle>
              <ShieldCheckIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatXLM(depositsHeld)} XLM
              </div>
              <p className="text-xs text-muted-foreground">
                Security deposits in escrow
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions + Recent Properties */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* My Properties */}
          <div className="order-1 lg:order-none lg:col-span-2">
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
                {properties.slice(0, 3).map((property) => (
                  <div
                    key={property.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{property.title}</p>
                        <Badge
                          variant={
                            property.isAvailable ? "default" : "secondary"
                          }
                        >
                          {property.isAvailable ? "Available" : "Rented"}
                        </Badge>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {property.location}
                      </p>
                      <p className="text-sm">
                        {formatXLM(property.pricePerMonth)} XLM/month
                      </p>
                    </div>
                    <Link href={`/app/properties/${property.id}`}>
                      <Button variant="ghost" size="sm">
                        <ArrowRightIcon className="size-4" />
                      </Button>
                    </Link>
                  </div>
                ))}

                {properties.length === 0 && (
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
                    <p className="font-mono text-xs text-muted-foreground">
                      {shortenAddress(user.walletAddress)}
                    </p>
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

  // Tenant Dashboard
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {firstName}!</h1>
        <p className="text-muted-foreground">Find your next home on Briq</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Rentals
            </CardTitle>
            <HouseIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAgreements.length}</div>
            <p className="text-xs text-muted-foreground">Current agreements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CurrencyDollarIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatXLM(totalPaid)} XLM</div>
            <p className="text-xs text-muted-foreground">Rent payments made</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Deposits in Escrow
            </CardTitle>
            <StarIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatXLM(depositsHeld)} XLM
            </div>
            <p className="text-xs text-muted-foreground">
              Security deposits held
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Agreements */}
      {activeAgreements.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Rentals</CardTitle>
            <Link
              href="/app/agreements"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeAgreements.slice(0, 3).map((agreement) => (
              <div
                key={agreement.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">Active Rental</p>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatXLM(agreement.monthlyRent)} XLM/month
                  </p>
                </div>
                <Link href={`/app/agreements/${agreement.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowRightIcon className="size-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Browse Properties</CardTitle>
          </CardHeader>
          <CardContent className="py-8 text-center">
            <MagnifyingGlassIcon className="mx-auto size-12 text-muted-foreground/50" />
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
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/app/properties">
            <Button variant="outline">
              <MagnifyingGlassIcon className="size-4" />
              Browse Properties
            </Button>
          </Link>
          <Link href="/app/agreements">
            <Button variant="outline">
              <CalendarIcon className="size-4" />
              My Agreements
            </Button>
          </Link>
          <Link href="/app/payments">
            <Button variant="outline">
              <CurrencyDollarIcon className="size-4" />
              Payments
            </Button>
          </Link>
          <Link href="/app/reviews">
            <Button variant="outline">
              <StarIcon className="size-4" />
              Reviews
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
