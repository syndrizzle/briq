"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  StarIcon,
  SpinnerIcon,
  WarningCircleIcon,
  UserIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import {
  getAgreementsByTenant,
  getAgreementsByLandlord,
  type RentalAgreement,
  AgreementStatus,
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

// Mock review type (will connect to contract later)
interface Review {
  id: string;
  agreementId: string;
  reviewerName: string;
  reviewerImage?: string;
  rating: number;
  text: string;
  createdAt: number;
  reviewerType: "tenant" | "landlord";
}

// Star rating component
function StarRating({
  rating,
  size = "md",
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={`${sizeClass} ${
            star <= rating ? "text-primary" : "text-muted-foreground/30"
          }`}
          weight={star <= rating ? "fill" : "regular"}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);

  const isLandlord = user?.userType === "landlord";

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.walletAddress) return;

      setIsLoading(true);
      try {
        // Fetch agreements to check eligibility
        const fetchedAgreements = isLandlord
          ? await getAgreementsByLandlord(user.walletAddress)
          : await getAgreementsByTenant(user.walletAddress);

        setAgreements(fetchedAgreements);

        // TODO: Fetch reviews from contract when available
        // For now, reviews will be empty
        setReviews([]);
        setAverageRating(0);
      } catch (error) {
        console.error("Error fetching review data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.walletAddress, isLandlord]);

  // Calculate eligible agreements (30+ days active)
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const eligibleAgreements = agreements.filter((a) => {
    if (
      a.status !== AgreementStatus.Active &&
      a.status !== AgreementStatus.Completed
    ) {
      return false;
    }
    const startDate = new Date(a.startDate * 1000);
    const now = new Date();
    return now.getTime() - startDate.getTime() >= thirtyDaysMs;
  });

  // Loading state
  if (!user?.walletAddress) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <WarningCircleIcon className="size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Please connect your wallet to view reviews.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-muted-foreground">
            {isLandlord
              ? "See what tenants are saying about you"
              : "See what landlords are saying about you"}
          </p>
        </div>

        {/* Rating summary */}
        {reviews.length > 0 && (
          <div className="flex items-center gap-3">
            <StarRating rating={Math.round(averageRating)} size="lg" />
            <div className="text-right">
              <p className="text-2xl font-bold">{averageRating.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">
                {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        /* Empty State */
        <Card className="overflow-hidden py-0">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
              <StarIcon className="size-10 text-primary" weight="duotone" />
            </div>
            <h2 className="text-2xl font-semibold">No Reviews Yet</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              {isLandlord
                ? "When tenants review you after 30 days of renting, their reviews will appear here."
                : "When landlords review you after 30 days of staying, their reviews will appear here."}
            </p>
          </div>

          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-center gap-12">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <ClockIcon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">30-Day Requirement</p>
                  <p className="text-sm text-muted-foreground">
                    Reviews open after 30 days
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <StarIcon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">On-Chain Verified</p>
                  <p className="text-sm text-muted-foreground">
                    Immutable & trustworthy
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <CheckCircleIcon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Mutual Reviews</p>
                  <p className="text-sm text-muted-foreground">
                    Both parties can review
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Reviews List */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Your Reviews</h2>

            <div className="space-y-3">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Eligible Agreements Section */}
      {eligibleAgreements.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Write a Review</h2>
          <p className="text-sm text-muted-foreground">
            You can write reviews for these agreements:
          </p>

          <div className="space-y-3">
            {eligibleAgreements.map((agreement) => (
              <Card key={agreement.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <UserIcon className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {isLandlord ? "Tenant" : "Landlord"} Review
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Started{" "}
                        {format(
                          new Date(agreement.startDate * 1000),
                          "MMM d, yyyy",
                        )}
                      </p>
                    </div>
                  </div>

                  <Badge variant="secondary">
                    <CalendarIcon className="mr-1 size-3" />
                    Eligible
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Review Card Component
function ReviewCard({ review }: { review: Review }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="size-10">
            <AvatarImage src={review.reviewerImage} />
            <AvatarFallback>
              {review.reviewerName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{review.reviewerName}</p>
                <p className="text-sm text-muted-foreground">
                  {review.reviewerType === "tenant" ? "Tenant" : "Landlord"} •{" "}
                  {format(new Date(review.createdAt * 1000), "MMM d, yyyy")}
                </p>
              </div>
              <StarRating rating={review.rating} size="sm" />
            </div>

            <p className="mt-3 text-sm text-muted-foreground">{review.text}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
