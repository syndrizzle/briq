"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PropertyCard } from "@/components/property-card";
import {
  HouseIcon,
  PlusIcon,
  CurrencyDollarIcon,
  SparkleIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import {
  getPropertiesByOwner,
  getAvailableProperties,
  type Property,
} from "@/lib/contracts";

// Extended session type
interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  walletAddress?: string;
  userType?: "landlord" | "tenant";
}

// Display property type with XLM values
interface DisplayProperty {
  id: string;
  title: string;
  location: string;
  pricePerMonth: number; // XLM
  securityDeposit: number;
  isAvailable: boolean;
  imageUrl?: string;
}

// Convert stroops to XLM
const STROOPS_PER_XLM = 10_000_000;

export default function PropertiesPage() {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;
  const userType = user?.userType || "landlord";

  const [properties, setProperties] = useState<DisplayProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProperties = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let rawProperties: Property[] = [];

        if (userType === "landlord" && user?.walletAddress) {
          // Landlords see their own properties
          rawProperties = await getPropertiesByOwner(user.walletAddress);
        } else {
          // Tenants see all available properties
          rawProperties = await getAvailableProperties();
        }

        // Convert to display format (stroops to XLM)
        const displayProperties: DisplayProperty[] = rawProperties.map((p) => ({
          id: p.id,
          title: p.title,
          location: p.location,
          pricePerMonth: Number(p.pricePerMonth) / STROOPS_PER_XLM,
          securityDeposit: Number(p.securityDeposit) / STROOPS_PER_XLM,
          isAvailable: p.isAvailable,
          imageUrl: p.imageUrl || undefined,
        }));

        setProperties(displayProperties);
      } catch (err) {
        console.error("Failed to fetch properties:", err);
        // Don't show error for empty results - just show empty state
        setProperties([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperties();
  }, [userType, user?.walletAddress]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <HouseIcon className="mx-auto size-12 animate-pulse text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading properties...</p>
        </div>
      </div>
    );
  }

  // Empty state with creation prompt for landlords
  if (properties.length === 0 && userType === "landlord") {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card className="overflow-hidden pt-0">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
              <HouseIcon className="size-10 text-primary" weight="duotone" />
            </div>
            <h1 className="text-2xl font-semibold">List Your First Property</h1>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Start earning by listing your property on Briq. Our
              blockchain-powered platform ensures secure payments and
              transparent agreements.
            </p>
          </div>

          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <SparkleIcon className="size-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium">Secure Payments</p>
                  <p className="text-sm text-muted-foreground">
                    Via Stellar escrow
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <UsersIcon className="size-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">Verified Tenants</p>
                  <p className="text-sm text-muted-foreground">
                    Wallet-connected users
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <CurrencyDollarIcon className="size-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium">Earn BRIQ</p>
                  <p className="text-sm text-muted-foreground">
                    Rewards for activity
                  </p>
                </div>
              </div>
            </div>

            <Link href="/app/properties/new" className="mt-6 block">
              <Button size="lg" className="w-full">
                <PlusIcon className="size-5" />
                List Your Property
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state for tenants - browse properties
  if (properties.length === 0 && userType === "tenant") {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <HouseIcon className="mx-auto size-16 text-muted-foreground/50" />
        <h1 className="mt-6 text-2xl font-semibold">No Properties Available</h1>
        <p className="mt-2 text-muted-foreground">
          Check back soon for new listings, or switch to landlord mode to list
          your property.
        </p>
      </div>
    );
  }

  // Properties list view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {userType === "landlord" ? "My Properties" : "Browse Properties"}
          </h1>
          <p className="text-muted-foreground">
            {userType === "landlord"
              ? "Manage your property listings"
              : "Find your next home on Briq"}
          </p>
        </div>
        {userType === "landlord" && (
          <Link href="/app/properties/new">
            <Button>
              <PlusIcon className="size-4" />
              List New Property
            </Button>
          </Link>
        )}
      </div>

      {/* Properties Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            isLandlord={userType === "landlord"}
          />
        ))}
      </div>
    </div>
  );
}
