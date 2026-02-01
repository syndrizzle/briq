"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  HouseIcon,
  MapPinIcon,
  CalendarIcon,
  ArrowLeftIcon,
  UserIcon,
  ShieldCheckIcon,
  ClockIcon,
  SpinnerIcon,
  HandshakeIcon,
} from "@phosphor-icons/react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RentalRequestDialog } from "@/components/rental-request-dialog";
import { getProperty, type Property } from "@/lib/contracts";

// Extended session type
interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  walletAddress?: string;
  userType?: "landlord" | "tenant";
}

// Convert stroops to XLM
const STROOPS_PER_XLM = 10_000_000;

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;

  const [property, setProperty] = useState<Property | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<{
    name: string | null;
    image: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const propertyId = params.id as string;

  useEffect(() => {
    const fetchProperty = async () => {
      if (!propertyId) return;

      setIsLoading(true);
      setError(null);
      try {
        const data = await getProperty(propertyId);
        setProperty(data);

        // Fetch owner profile by wallet address
        if (data.owner) {
          try {
            const res = await fetch(
              `/api/user/by-wallet?address=${data.owner}`,
            );
            if (res.ok) {
              const profile = await res.json();
              setOwnerProfile(profile);
            }
          } catch {
            // Silently fail - will show wallet address fallback
          }
        }
      } catch (err) {
        console.error("Failed to fetch property:", err);
        setError("Property not found or failed to load.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperty();
  }, [propertyId]);

  // Check if current user is the owner
  const isOwner = user?.walletAddress && property?.owner === user.walletAddress;

  // Convert values
  const priceXLM = property
    ? Number(property.pricePerMonth) / STROOPS_PER_XLM
    : 0;
  const depositXLM = property
    ? Number(property.securityDeposit) / STROOPS_PER_XLM
    : 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <SpinnerIcon className="mx-auto size-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading property...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !property) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <HouseIcon className="mx-auto size-16 text-muted-foreground/50" />
        <h1 className="mt-6 text-2xl font-semibold">Property Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          {error || "This property doesn't exist or has been removed."}
        </p>
        <Button className="mt-6" onClick={() => router.push("/app/properties")}>
          <ArrowLeftIcon className="size-4" />
          Back to Properties
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button & Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button
            variant="ghost"
            className="-ml-2 mb-2"
            onClick={() => router.back()}
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{property.title}</h1>
            <Badge variant={property.isAvailable ? "default" : "secondary"}>
              {property.isAvailable ? "Available" : "Rented"}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-1 text-muted-foreground">
            <MapPinIcon className="size-4" />
            {property.location}
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Image & Description */}
        <div className="space-y-6 lg:col-span-2">
          {/* Property Image */}
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
            {property.imageUrl ? (
              <img
                src={property.imageUrl}
                alt={property.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <HouseIcon className="size-24 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Description */}
          {property.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">About This Property</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {property.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Property Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Property Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <CalendarIcon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Minimum Stay</p>
                  <p className="font-medium">{property.minStayDays} days</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <ClockIcon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Maximum Stay</p>
                  <p className="font-medium">{property.maxStayDays} days</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <ShieldCheckIcon className="size-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">
                    {property.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {ownerProfile?.image ? (
                  <Avatar className="size-10">
                    <AvatarImage
                      src={ownerProfile.image}
                      alt={ownerProfile.name || "Owner"}
                    />
                    <AvatarFallback>
                      {ownerProfile.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "U"}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <UserIcon className="size-5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Owner</p>
                  <p className="font-medium">
                    {ownerProfile?.name ||
                      `${property.owner.slice(0, 4)}...${property.owner.slice(-4)}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Pricing & Actions */}
        <div className="space-y-6">
          {/* Pricing Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Rent</p>
                <p className="text-3xl font-bold">
                  {priceXLM.toLocaleString()}{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    XLM
                  </span>
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground">
                  Security Deposit
                </p>
                <p className="text-xl font-semibold">
                  {depositXLM.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    XLM
                  </span>
                </p>
              </div>

              <div className="rounded-lg bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">
                  All payments are secured via{" "}
                  <strong className="text-foreground">
                    Stellar blockchain
                  </strong>{" "}
                  escrow. Your deposit is protected until lease ends.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Card - Different for owner vs tenant */}
          {isOwner ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Property</CardTitle>
                <CardDescription>
                  You are the owner of this property
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3">
                  <ShieldCheckIcon className="size-5 text-primary" />
                  <p className="text-sm">
                    This property is listed on the Stellar blockchain
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Interested?</CardTitle>
                <CardDescription>Request to rent this property</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {property.isAvailable ? (
                  <>
                    <RentalRequestDialog
                      propertyId={property.id}
                      propertyTitle={property.title}
                      pricePerMonth={
                        Number(property.pricePerMonth) / STROOPS_PER_XLM
                      }
                      securityDeposit={
                        Number(property.securityDeposit) / STROOPS_PER_XLM
                      }
                      minStayDays={property.minStayDays}
                      maxStayDays={property.maxStayDays}
                    >
                      <Button className="w-full">
                        <HandshakeIcon className="size-4" />
                        Request to Rent
                      </Button>
                    </RentalRequestDialog>
                    <p className="text-center text-xs text-muted-foreground">
                      The landlord will review your request and contact you.
                    </p>
                  </>
                ) : (
                  <div className="text-center">
                    <Badge variant="secondary" className="mb-2">
                      Currently Rented
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      This property is not available right now.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
