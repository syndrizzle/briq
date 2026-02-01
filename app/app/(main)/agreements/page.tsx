"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HouseIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  SpinnerIcon,
  UserIcon,
  CurrencyDollarIcon,
  HandshakeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  getAgreementsByTenant,
  getAgreementsByLandlord,
  buildApproveRequestTx,
  buildRejectRequestTx,
  buildDepositAndRentTx,
  submitTransaction,
  useWallet,
  networkConfig,
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

// Status badge colors and labels
const statusConfig: Record<
  AgreementStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ElementType;
  }
> = {
  [AgreementStatus.PendingLandlordApproval]: {
    label: "Pending Approval",
    variant: "secondary",
    icon: ClockIcon,
  },
  [AgreementStatus.Rejected]: {
    label: "Rejected",
    variant: "destructive",
    icon: XCircleIcon,
  },
  [AgreementStatus.Draft]: {
    label: "Draft",
    variant: "outline",
    icon: HouseIcon,
  },
  [AgreementStatus.PendingTenantSign]: {
    label: "Awaiting Tenant Signature",
    variant: "secondary",
    icon: ClockIcon,
  },
  [AgreementStatus.PendingLandlordSign]: {
    label: "Awaiting Landlord Signature",
    variant: "secondary",
    icon: ClockIcon,
  },
  [AgreementStatus.PendingPayment]: {
    label: "Awaiting Payment",
    variant: "secondary",
    icon: CurrencyDollarIcon,
  },
  [AgreementStatus.Active]: {
    label: "Active",
    variant: "default",
    icon: CheckCircleIcon,
  },
  [AgreementStatus.Completed]: {
    label: "Completed",
    variant: "outline",
    icon: CheckCircleIcon,
  },
  [AgreementStatus.Cancelled]: {
    label: "Cancelled",
    variant: "destructive",
    icon: XCircleIcon,
  },
};

// Convert stroops to XLM
const STROOPS_PER_XLM = 10_000_000;
const toXLM = (stroops: bigint) => Number(stroops) / STROOPS_PER_XLM;

export default function AgreementsPage() {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;
  const { publicKey, sign } = useWallet();

  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isLandlord = user?.userType === "landlord";

  // Fetch agreements based on user role
  const fetchAgreements = useCallback(async () => {
    if (!user?.walletAddress) return;

    setIsLoading(true);
    try {
      const data = isLandlord
        ? await getAgreementsByLandlord(user.walletAddress)
        : await getAgreementsByTenant(user.walletAddress);
      setAgreements(data);
    } catch (err) {
      console.error("Failed to fetch agreements:", err);
      toast.error("Failed to load agreements");
    } finally {
      setIsLoading(false);
    }
  }, [user?.walletAddress, isLandlord]);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  // Handle approve request
  const handleApprove = async (agreementId: string) => {
    if (!publicKey) {
      toast.error("Wallet not connected");
      return;
    }

    setProcessingId(agreementId);
    try {
      const tx = await buildApproveRequestTx(publicKey, agreementId);
      const signedXdr = await sign(tx.toXDR(), networkConfig.networkPassphrase);
      await submitTransaction(signedXdr);

      toast.success("Request approved!", {
        description: "The tenant can now proceed with payment.",
      });

      // Refresh the list
      fetchAgreements();
    } catch (err) {
      console.error("Failed to approve:", err);
      toast.error("Failed to approve request", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Handle reject request
  const handleReject = async (agreementId: string) => {
    if (!publicKey) {
      toast.error("Wallet not connected");
      return;
    }

    setProcessingId(agreementId);
    try {
      const tx = await buildRejectRequestTx(publicKey, agreementId);
      const signedXdr = await sign(tx.toXDR(), networkConfig.networkPassphrase);
      await submitTransaction(signedXdr);

      toast.success("Request rejected");
      fetchAgreements();
    } catch (err) {
      console.error("Failed to reject:", err);
      toast.error("Failed to reject request", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Handle payment (security deposit + first month rent)
  const handlePayment = async (agreementId: string) => {
    if (!publicKey) {
      toast.error("Wallet not connected");
      return;
    }

    setProcessingId(agreementId);
    try {
      const tx = await buildDepositAndRentTx(publicKey, agreementId);
      const signedXdr = await sign(tx.toXDR(), networkConfig.networkPassphrase);
      await submitTransaction(signedXdr);

      toast.success("Payment successful!", {
        description: "Your rental agreement is now active.",
      });

      fetchAgreements();
    } catch (err) {
      console.error("Payment failed:", err);
      toast.error("Payment failed", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Filter agreements by status category
  const pendingAgreements = agreements.filter(
    (a) => a.status === AgreementStatus.PendingLandlordApproval,
  );
  const activeAgreements = agreements.filter(
    (a) =>
      a.status === AgreementStatus.Active ||
      a.status === AgreementStatus.PendingPayment,
  );
  const pastAgreements = agreements.filter(
    (a) =>
      a.status === AgreementStatus.Completed ||
      a.status === AgreementStatus.Cancelled ||
      a.status === AgreementStatus.Rejected,
  );

  // Determine the default tab (first one with data)
  const getDefaultTab = () => {
    if (pendingAgreements.length > 0) return "pending";
    if (activeAgreements.length > 0) return "active";
    if (pastAgreements.length > 0) return "past";
    return "pending";
  };

  if (!user?.walletAddress) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <WarningCircleIcon className="size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Please connect your wallet to view agreements.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {isLandlord ? "Rental Requests" : "My Agreements"}
        </h1>
        <p className="text-muted-foreground">
          {isLandlord
            ? "Review and manage rental requests from tenants"
            : "Track your rental agreements and requests"}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : agreements.length === 0 ? (
        <Card className="overflow-hidden py-0">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
              <HandshakeIcon
                className="size-10 text-primary"
                weight="duotone"
              />
            </div>
            <h2 className="text-2xl font-semibold">
              {isLandlord ? "No Rental Requests Yet" : "No Agreements Yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              {isLandlord
                ? "When tenants apply to rent your properties, their requests will appear here for your review."
                : "Start your journey by browsing available properties and submitting rental requests."}
            </p>
          </div>

          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-center gap-12">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <CheckCircleIcon
                    className="size-5 text-primary"
                    weight="fill"
                  />
                </div>
                <div>
                  <p className="font-medium">
                    {isLandlord ? "Easy Approvals" : "Quick Apply"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isLandlord ? "One-click review" : "Simple request flow"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <CurrencyDollarIcon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Secure Payments</p>
                  <p className="text-sm text-muted-foreground">
                    Stellar escrow
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <CalendarIcon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Track Status</p>
                  <p className="text-sm text-muted-foreground">
                    Real-time updates
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={getDefaultTab()} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="relative">
              Pending
              {pendingAgreements.length > 0 && (
                <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {pendingAgreements.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="relative">
              Active
              {activeAgreements.filter(
                (a) => a.status === AgreementStatus.PendingPayment,
              ).length > 0 && (
                <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-amber-500 text-xs text-white">
                  {
                    activeAgreements.filter(
                      (a) => a.status === AgreementStatus.PendingPayment,
                    ).length
                  }
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingAgreements.length === 0 ? (
              <EmptyState message="No pending requests" />
            ) : (
              pendingAgreements.map((agreement) => (
                <AgreementCard
                  key={agreement.id}
                  agreement={agreement}
                  isLandlord={isLandlord}
                  processingId={processingId}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onPayment={handlePayment}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {activeAgreements.length === 0 ? (
              <EmptyState message="No active agreements" />
            ) : (
              activeAgreements.map((agreement) => (
                <AgreementCard
                  key={agreement.id}
                  agreement={agreement}
                  isLandlord={isLandlord}
                  processingId={processingId}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onPayment={handlePayment}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {pastAgreements.length === 0 ? (
              <EmptyState message="No past agreements" />
            ) : (
              pastAgreements.map((agreement) => (
                <AgreementCard
                  key={agreement.id}
                  agreement={agreement}
                  isLandlord={isLandlord}
                  processingId={processingId}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onPayment={handlePayment}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function AgreementCard({
  agreement,
  isLandlord,
  processingId,
  onApprove,
  onReject,
  onPayment,
}: {
  agreement: RentalAgreement;
  isLandlord: boolean;
  processingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPayment: (id: string) => void;
}) {
  const config =
    statusConfig[agreement.status] || statusConfig[AgreementStatus.Draft];
  const StatusIcon = config.icon;
  const isProcessing = processingId === agreement.id;

  const startDate = new Date(agreement.startDate * 1000);
  const endDate = new Date(agreement.endDate * 1000);
  const durationDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Fetch the other party's profile
  const [otherPartyProfile, setOtherPartyProfile] = useState<{
    name: string;
    email: string;
    image?: string;
  } | null>(null);

  useEffect(() => {
    const walletAddress = isLandlord ? agreement.tenant : agreement.landlord;
    if (!walletAddress) return;

    const fetchProfile = async () => {
      try {
        const res = await fetch(
          `/api/user/by-wallet?address=${encodeURIComponent(walletAddress)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setOtherPartyProfile(data);
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    };

    fetchProfile();
  }, [agreement.tenant, agreement.landlord, isLandlord]);

  const initials =
    otherPartyProfile?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <HouseIcon className="size-5" />
              Property Rental
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              ID: {agreement.id.slice(0, 8)}...{agreement.id.slice(-8)}
            </CardDescription>
          </div>
          <Badge variant={config.variant} className="flex items-center gap-1">
            <StatusIcon className="size-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Dates and Duration */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Move-in Date</p>
            <p className="flex items-center gap-1 text-sm font-medium">
              <CalendarIcon className="size-4 text-muted-foreground" />
              {format(startDate, "MMM d, yyyy")}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Move-out Date</p>
            <p className="flex items-center gap-1 text-sm font-medium">
              <CalendarIcon className="size-4 text-muted-foreground" />
              {format(endDate, "MMM d, yyyy")}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="flex items-center gap-1 text-sm font-medium">
              <ClockIcon className="size-4 text-muted-foreground" />
              {durationDays} days
            </p>
          </div>
        </div>

        <Separator />

        {/* Financial Details */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Monthly Rent</p>
            <p className="text-sm font-medium">
              {toXLM(agreement.monthlyRent).toLocaleString()} XLM
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Security Deposit</p>
            <p className="text-sm font-medium">
              {toXLM(agreement.securityDeposit).toLocaleString()} XLM
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {isLandlord ? "Tenant" : "Landlord"}
            </p>
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                {otherPartyProfile?.image && (
                  <AvatarImage
                    src={otherPartyProfile.image}
                    alt={otherPartyProfile.name || "User"}
                  />
                )}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                {otherPartyProfile ? (
                  <>
                    <p className="truncate text-sm font-medium">
                      {otherPartyProfile.name}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {isLandlord
                        ? `${agreement.tenant.slice(0, 6)}...${agreement.tenant.slice(-4)}`
                        : `${agreement.landlord.slice(0, 6)}...${agreement.landlord.slice(-4)}`}
                    </p>
                  </>
                ) : (
                  <p className="font-mono text-xs">
                    {isLandlord
                      ? `${agreement.tenant.slice(0, 6)}...${agreement.tenant.slice(-4)}`
                      : `${agreement.landlord.slice(0, 6)}...${agreement.landlord.slice(-4)}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Landlord Actions for Pending Requests */}
        {isLandlord &&
          agreement.status === AgreementStatus.PendingLandlordApproval && (
            <>
              <Separator />
              <div className="flex gap-3">
                <Button
                  onClick={() => onApprove(agreement.id)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <SpinnerIcon className="size-4 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="size-4" />
                  )}
                  Approve Request
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onReject(agreement.id)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <SpinnerIcon className="size-4 animate-spin" />
                  ) : (
                    <XCircleIcon className="size-4" />
                  )}
                  Reject
                </Button>
              </div>
            </>
          )}

        {/* Tenant: Show message for pending */}
        {!isLandlord &&
          agreement.status === AgreementStatus.PendingLandlordApproval && (
            <>
              <Separator />
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                <ClockIcon className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Waiting for the landlord to review your request...
                </p>
              </div>
            </>
          )}

        {/* Pending Payment CTA */}
        {agreement.status === AgreementStatus.PendingPayment && (
          <>
            <Separator />
            <div className="flex items-center justify-between rounded-lg bg-green-500/10 p-3">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="size-5 text-green-600" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Request approved! Payment required to activate.
                </p>
              </div>
              {!isLandlord && (
                <Button
                  size="sm"
                  onClick={() => onPayment(agreement.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <SpinnerIcon className="size-4 animate-spin" />
                  ) : (
                    <CurrencyDollarIcon className="size-4" />
                  )}
                  Pay Now
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
