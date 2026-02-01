"use client";

import * as React from "react";
import { useState } from "react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, SpinnerIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  buildRequestRentalTx,
  submitTransaction,
  useWallet,
  networkConfig,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";

interface RentalRequestDialogProps {
  propertyId: string;
  propertyTitle: string;
  pricePerMonth: number; // In XLM
  securityDeposit: number; // In XLM
  minStayDays: number;
  maxStayDays: number;
  children: React.ReactNode;
  onSuccess?: () => void;
}

export function RentalRequestDialog({
  propertyId,
  propertyTitle,
  pricePerMonth,
  securityDeposit,
  minStayDays,
  maxStayDays,
  children,
  onSuccess,
}: RentalRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { publicKey, sign } = useWallet();

  // Calculate duration and total
  const getStayDays = () => {
    if (!startDate || !endDate) return 0;
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const stayDays = getStayDays();
  const stayMonths = stayDays / 30;
  const estimatedRent = pricePerMonth * stayMonths;
  const totalUpfront = estimatedRent + securityDeposit;

  const isValidDuration = stayDays >= minStayDays && stayDays <= maxStayDays;
  const isStartInFuture = startDate && startDate > new Date();
  const isEndAfterStart = startDate && endDate && endDate > startDate;

  const canSubmit =
    startDate &&
    endDate &&
    isValidDuration &&
    isStartInFuture &&
    isEndAfterStart &&
    publicKey;

  const handleSubmit = async () => {
    if (!publicKey || !canSubmit || !startDate || !endDate) return;

    setIsSubmitting(true);
    try {
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      const { transaction } = await buildRequestRentalTx(publicKey, {
        propertyId,
        startDate: startTimestamp,
        endDate: endTimestamp,
      });

      const signedXdr = await sign(
        transaction.toXDR(),
        networkConfig.networkPassphrase,
      );
      await submitTransaction(signedXdr);

      toast.success("Rental request sent!", {
        description: "The landlord will review your request.",
      });

      setOpen(false);
      setStartDate(undefined);
      setEndDate(undefined);
      onSuccess?.();
    } catch (err) {
      console.error("Failed to submit rental request:", err);
      toast.error("Failed to send request", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Minimum date for move-in (tomorrow)
  const tomorrow = addDays(new Date(), 1);

  // Minimum date for move-out based on start + minStayDays
  const minEndDate = startDate ? addDays(startDate, minStayDays) : tomorrow;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement}></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request to Rent</DialogTitle>
          <DialogDescription>
            Submit a rental request for <strong>{propertyTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Selection */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Move-in Date</Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground",
                      )}
                    />
                  }
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(date) => date < tomorrow}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Move-out Date</Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground",
                      )}
                    />
                  }
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => date < minEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Duration Info */}
          {stayDays > 0 && (
            <div
              className={`rounded-lg p-3 ${
                isValidDuration
                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <p className="text-sm font-medium">
                {stayDays} days ({stayMonths.toFixed(1)} months)
              </p>
              {!isValidDuration && (
                <p className="text-xs">
                  Stay must be between {minStayDays} and {maxStayDays} days
                </p>
              )}
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly Rent</span>
              <span>{pricePerMonth.toLocaleString()} XLM</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Estimated Rent ({stayMonths.toFixed(1)} mo)
              </span>
              <span>
                {estimatedRent.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                XLM
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Security Deposit</span>
              <span>{securityDeposit.toLocaleString()} XLM</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between font-semibold">
                <span>Total Upfront</span>
                <span>
                  {totalUpfront.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  XLM
                </span>
              </div>
            </div>
          </div>

          {/* Blockchain Note */}
          <p className="text-xs text-muted-foreground">
            Your request will be recorded on the Stellar blockchain. The
            landlord will review and approve or decline your request.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <SpinnerIcon className="size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Send Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
