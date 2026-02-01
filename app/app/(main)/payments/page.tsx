"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CoinIcon,
  CalendarIcon,
  CheckCircleIcon,
  SpinnerIcon,
  WarningCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  HouseIcon,
  ShieldCheckIcon,
  ClockIcon,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import {
  getAgreementsByTenant,
  getAgreementsByLandlord,
  getEscrowAccount,
  getPaymentHistory,
  type RentalAgreement,
  type EscrowAccount,
  type PaymentRecord,
  PaymentType,
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

// Payment display type combining data
interface PaymentDisplay {
  id: string;
  agreementId: string;
  type: PaymentType;
  amount: bigint;
  timestamp: number;
  propertyTitle?: string;
  isIncoming: boolean; // For landlord: true, for tenant: false
}

// Convert stroops to XLM
const STROOPS_PER_XLM = BigInt(10_000_000);

function formatXLM(stroops: bigint): string {
  const xlm = Number(stroops) / Number(STROOPS_PER_XLM);
  return xlm.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Payment type labels
const paymentTypeLabels: Record<PaymentType, string> = {
  [PaymentType.SecurityDeposit]: "Security Deposit",
  [PaymentType.FirstMonthRent]: "First Month Rent",
  [PaymentType.MonthlyRent]: "Monthly Rent",
  [PaymentType.DepositRelease]: "Deposit Released",
  [PaymentType.EmergencyWithdrawal]: "Emergency Withdrawal",
};

export default function PaymentsPage() {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [payments, setPayments] = useState<PaymentDisplay[]>([]);
  const [escrowAccounts, setEscrowAccounts] = useState<
    Map<string, EscrowAccount>
  >(new Map());
  const [totalPaid, setTotalPaid] = useState<bigint>(BigInt(0));
  const [totalReceived, setTotalReceived] = useState<bigint>(BigInt(0));
  const [pendingDeposits, setPendingDeposits] = useState<bigint>(BigInt(0));

  const isLandlord = user?.userType === "landlord";

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user?.walletAddress) return;

    setIsLoading(true);
    try {
      // Fetch agreements based on role
      const fetchedAgreements = isLandlord
        ? await getAgreementsByLandlord(user.walletAddress)
        : await getAgreementsByTenant(user.walletAddress);

      setAgreements(fetchedAgreements);

      // Fetch escrow accounts and payment history for each agreement
      const escrowMap = new Map<string, EscrowAccount>();
      const allPayments: PaymentDisplay[] = [];
      let paid = BigInt(0);
      let received = BigInt(0);
      let deposits = BigInt(0);

      for (const agreement of fetchedAgreements) {
        const escrow = await getEscrowAccount(agreement.id);
        if (escrow) {
          escrowMap.set(agreement.id, escrow);

          // Track totals based on role
          if (isLandlord) {
            received += escrow.totalRentReleased;
            if (!escrow.isDepositReleased) {
              deposits += escrow.securityDepositHeld;
            }
          } else {
            paid +=
              escrow.totalRentReceived +
              (escrow.isDepositReleased
                ? BigInt(0)
                : escrow.securityDepositHeld);
          }

          // Fetch payment history
          const history = await getPaymentHistory(agreement.id);
          for (const payment of history) {
            allPayments.push({
              id: payment.id,
              agreementId: payment.agreementId,
              type: payment.paymentType,
              amount: payment.amount,
              timestamp: payment.timestamp,
              isIncoming: isLandlord,
            });
          }
        }
      }

      setEscrowAccounts(escrowMap);
      setPayments(allPayments.sort((a, b) => b.timestamp - a.timestamp));
      setTotalPaid(paid);
      setTotalReceived(received);
      setPendingDeposits(deposits);
    } catch (error) {
      console.error("Error fetching payment data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.walletAddress, isLandlord]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Count active agreements that need payment
  const activeAgreements = agreements.filter(
    (a) => a.status === AgreementStatus.Active,
  );

  // Loading state
  if (!user?.walletAddress) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <WarningCircleIcon className="size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Please connect your wallet to view payments.
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
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted-foreground">
          {isLandlord
            ? "Track rent payments and manage deposits"
            : "View your payment history and upcoming rent"}
        </p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : payments.length === 0 && agreements.length === 0 ? (
        /* Empty State */
        <Card className="overflow-hidden py-0">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
              <CoinIcon className="size-10 text-primary" weight="duotone" />
            </div>
            <h2 className="text-2xl font-semibold">No Payments Yet</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              {isLandlord
                ? "When tenants pay rent or deposits, they'll appear here."
                : "Once you have an active rental agreement, your payments will appear here."}
            </p>
          </div>

          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-center gap-12">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <ShieldCheckIcon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Secure Escrow</p>
                  <p className="text-sm text-muted-foreground">
                    All payments held safely
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <ClockIcon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Instant Transfers</p>
                  <p className="text-sm text-muted-foreground">
                    Stellar-powered speed
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <CheckCircleIcon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Full Transparency</p>
                  <p className="text-sm text-muted-foreground">
                    On-chain records
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLandlord ? (
              <>
                {/* Landlord Summary */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                        <ArrowDownIcon className="size-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Received
                        </p>
                        <p className="text-2xl font-bold">
                          {formatXLM(totalReceived)} XLM
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <ShieldCheckIcon className="size-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Deposits Held
                        </p>
                        <p className="text-2xl font-bold">
                          {formatXLM(pendingDeposits)} XLM
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <HouseIcon className="size-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Active Rentals
                        </p>
                        <p className="text-2xl font-bold">
                          {activeAgreements.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                {/* Tenant Summary */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <ArrowUpIcon className="size-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Paid
                        </p>
                        <p className="text-2xl font-bold">
                          {formatXLM(totalPaid)} XLM
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                        <ShieldCheckIcon className="size-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Deposits in Escrow
                        </p>
                        <p className="text-2xl font-bold">
                          {formatXLM(pendingDeposits)} XLM
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <CalendarIcon className="size-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Active Agreements
                        </p>
                        <p className="text-2xl font-bold">
                          {activeAgreements.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Payment History */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Payment History</h2>

            <div className="space-y-3">
              {payments.map((payment) => (
                <PaymentCard key={payment.id} payment={payment} />
              ))}
              {payments.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  No payments recorded yet.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Payment Card Component
function PaymentCard({ payment }: { payment: PaymentDisplay }) {
  const isDeposit =
    payment.type === PaymentType.SecurityDeposit ||
    payment.type === PaymentType.DepositRelease;

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex size-10 items-center justify-center rounded-full ${
              isDeposit ? "bg-muted" : "bg-primary/10"
            }`}
          >
            {isDeposit ? (
              <ShieldCheckIcon
                className="size-5 text-muted-foreground"
                weight="fill"
              />
            ) : (
              <CoinIcon className="size-5 text-primary" weight="fill" />
            )}
          </div>

          <div>
            <p className="font-medium">{paymentTypeLabels[payment.type]}</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(payment.timestamp * 1000), "MMM d, yyyy")}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p
            className={`text-lg font-semibold ${
              payment.isIncoming ? "text-primary" : ""
            }`}
          >
            {payment.isIncoming ? "+" : "-"}
            {formatXLM(payment.amount)} XLM
          </p>
          <Badge variant="secondary" className="text-xs">
            <CheckCircleIcon className="mr-1 size-3" />
            Confirmed
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
