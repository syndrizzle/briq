"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HouseIcon, MapPinIcon, ArrowRightIcon } from "@phosphor-icons/react";

export interface PropertyCardData {
  id: string;
  title: string;
  description?: string;
  location: string;
  pricePerMonth: number; // In XLM
  isAvailable: boolean;
  imageUrl?: string;
}

interface PropertyCardProps {
  property: PropertyCardData;
  /** Show landlord-specific actions like edit */
  isLandlord?: boolean;
  /** Optional link override (defaults to /app/properties/{id}) */
  href?: string;
}

export function PropertyCard({
  property,
  isLandlord = false,
  href,
}: PropertyCardProps) {
  const propertyLink = href || `/app/properties/${property.id}`;

  return (
    <Card className="group overflow-hidden pt-0">
      {/* Image - fixed 16:9 aspect ratio */}
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {property.imageUrl ? (
          <img
            src={property.imageUrl}
            alt={property.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <HouseIcon className="size-12 text-muted-foreground/30" />
          </div>
        )}
        <Badge
          className="absolute right-2 top-2"
          variant={property.isAvailable ? "default" : "secondary"}
        >
          {property.isAvailable ? "Available" : "Rented"}
        </Badge>
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-1 text-lg">{property.title}</CardTitle>
        {property.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {property.description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPinIcon className="size-4 shrink-0" />
          <span className="line-clamp-1">{property.location}</span>
        </div>
      </CardHeader>

      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">
            {property.pricePerMonth.toLocaleString()} XLM
            <span className="text-sm font-normal text-muted-foreground">
              /month
            </span>
          </p>
        </div>

        <Link href={propertyLink}>
          <Button variant="ghost" size="sm">
            View
            <ArrowRightIcon className="size-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
