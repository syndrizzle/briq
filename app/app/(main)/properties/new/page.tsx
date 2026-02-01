"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import {
  HouseIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  ImageIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  SpinnerIcon,
  SparkleIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  useWallet,
  buildCreatePropertyTx,
  submitTransaction,
  networkConfig,
} from "@/lib/contracts";

// Step definitions
const STEPS = [
  {
    id: 1,
    title: "Basic Info",
    icon: HouseIcon,
    description: "Property title and description",
  },
  {
    id: 2,
    title: "Location",
    icon: MapPinIcon,
    description: "Where is your property?",
  },
  {
    id: 3,
    title: "Pricing",
    icon: CurrencyDollarIcon,
    description: "Set your rent and deposit",
  },
  {
    id: 4,
    title: "Duration",
    icon: CalendarIcon,
    description: "Minimum and maximum stay",
  },
  {
    id: 5,
    title: "Photos",
    icon: ImageIcon,
    description: "Add property images",
  },
  {
    id: 6,
    title: "Review",
    icon: CheckCircleIcon,
    description: "Confirm and publish",
  },
];

interface PropertyFormData {
  title: string;
  description: string;
  location: string;
  pricePerMonth: string;
  securityDeposit: string;
  minStayDays: string;
  maxStayDays: string;
  imageUrl: string;
}

const initialFormData: PropertyFormData = {
  title: "",
  description: "",
  location: "",
  pricePerMonth: "",
  securityDeposit: "",
  minStayDays: "30",
  maxStayDays: "365",
  imageUrl: "",
};

export default function NewPropertyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const wallet = useWallet();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PropertyFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<PropertyFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof PropertyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<PropertyFormData> = {};

    switch (step) {
      case 1:
        if (!formData.title.trim()) newErrors.title = "Title is required";
        else if (formData.title.length > 100)
          newErrors.title = "Title must be under 100 characters";
        if (formData.description.length > 1000)
          newErrors.description = "Description must be under 1000 characters";
        break;
      case 2:
        if (!formData.location.trim())
          newErrors.location = "Location is required";
        else if (formData.location.length > 200)
          newErrors.location = "Location must be under 200 characters";
        break;
      case 3:
        const price = parseFloat(formData.pricePerMonth);
        const deposit = parseFloat(formData.securityDeposit);
        if (!formData.pricePerMonth || price <= 0)
          newErrors.pricePerMonth = "Valid rent amount is required";
        if (formData.securityDeposit && deposit < 0)
          newErrors.securityDeposit = "Deposit cannot be negative";
        break;
      case 4:
        const minDays = parseInt(formData.minStayDays);
        const maxDays = parseInt(formData.maxStayDays);
        if (!formData.minStayDays || minDays < 30)
          newErrors.minStayDays = "Minimum stay must be at least 30 days";
        if (!formData.maxStayDays || maxDays < minDays)
          newErrors.maxStayDays = "Max stay must be greater than min stay";
        break;
      case 5:
        // Image is optional
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    // Check wallet connection
    if (!wallet.publicKey) {
      toast.error("Please connect your wallet first");
      try {
        await wallet.connect();
      } catch {
        return;
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert XLM to stroops (1 XLM = 10^7 stroops)
      const STROOPS_PER_XLM = BigInt(10_000_000);
      const priceInStroops = BigInt(
        Math.floor(
          parseFloat(formData.pricePerMonth) * Number(STROOPS_PER_XLM),
        ),
      );
      const depositInStroops = BigInt(
        Math.floor(
          parseFloat(formData.securityDeposit || "0") * Number(STROOPS_PER_XLM),
        ),
      );

      // Build the transaction (generates property ID client-side)
      const { transaction } = await buildCreatePropertyTx(wallet.publicKey, {
        title: formData.title,
        description: formData.description || "",
        location: formData.location,
        pricePerMonth: priceInStroops,
        securityDeposit: depositInStroops,
        minStayDays: parseInt(formData.minStayDays),
        maxStayDays: parseInt(formData.maxStayDays),
        imageUrl: formData.imageUrl || "",
      });

      // Sign with wallet
      toast.info("Please sign the transaction in Freighter...");
      const signedXdr = await wallet.sign(
        transaction.toXDR(),
        networkConfig.networkPassphrase,
      );

      // Submit to blockchain
      toast.info("Submitting to Stellar network...");
      const result = await submitTransaction(signedXdr);

      if (result.status === "SUCCESS") {
        toast.success("Property listed on the blockchain!");
        router.push("/app/properties");
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error("Failed to create property:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to list property: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Progress percentage
  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          className="-ml-2 mb-2"
          onClick={() => router.back()}
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">List Your Property</h1>
        <p className="text-muted-foreground">
          Fill in the details to list your property on the Stellar blockchain
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-3">
        {/* Step indicator */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Step {currentStep} of {STEPS.length}
          </span>
          <span className="text-muted-foreground">
            {STEPS[currentStep - 1].title}
          </span>
        </div>

        {/* Progress track */}
        <div className="relative">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step pills */}
        <div className="flex justify-between">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <button
                key={step.id}
                onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                disabled={step.id > currentStep}
                className={`flex flex-col items-center gap-1 transition-all ${
                  step.id <= currentStep
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-40"
                }`}
              >
                <div
                  className={`flex size-10 items-center justify-center rounded-full border-2 transition-all ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCompleted
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircleIcon className="size-5" weight="fill" />
                  ) : (
                    <Icon
                      className="size-5"
                      weight={isActive ? "fill" : "regular"}
                    />
                  )}
                </div>
                <span className="hidden text-xs font-medium sm:block">
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {(() => {
              const Icon = STEPS[currentStep - 1].icon;
              return (
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="size-5 text-primary" weight="duotone" />
                </div>
              );
            })()}
            <div>
              <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
              <CardDescription>
                {STEPS[currentStep - 1].description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Property Title *</FieldLabel>
                <Input
                  id="title"
                  placeholder="e.g., Modern 2BHK Apartment with City View"
                  value={formData.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  data-invalid={!!errors.title}
                />
                <FieldDescription>
                  A catchy title helps attract tenants ({formData.title.length}
                  /100)
                </FieldDescription>
                {errors.title && <FieldError>{errors.title}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  placeholder="Describe your property's features, amenities, nearby facilities..."
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={5}
                  className="resize-none"
                  data-invalid={!!errors.description}
                />
                <FieldDescription>
                  {formData.description.length}/1000 characters
                </FieldDescription>
                {errors.description && (
                  <FieldError>{errors.description}</FieldError>
                )}
              </Field>
            </FieldGroup>
          )}

          {/* Step 2: Location */}
          {currentStep === 2 && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="location">Property Address *</FieldLabel>
                <Input
                  id="location"
                  placeholder="e.g., Koramangala, Bangalore, Karnataka"
                  value={formData.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  data-invalid={!!errors.location}
                />
                <FieldDescription>
                  Full address or area name ({formData.location.length}/200)
                </FieldDescription>
                {errors.location && <FieldError>{errors.location}</FieldError>}
              </Field>

              <div className="rounded-lg border border-dashed bg-muted/50 p-4 text-center">
                <MapPinIcon className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Map integration coming soon
                </p>
              </div>
            </FieldGroup>
          )}

          {/* Step 3: Pricing */}
          {currentStep === 3 && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="pricePerMonth">
                  Monthly Rent (XLM) *
                </FieldLabel>
                <Input
                  id="pricePerMonth"
                  type="number"
                  placeholder="500"
                  value={formData.pricePerMonth}
                  onChange={(e) => updateField("pricePerMonth", e.target.value)}
                  data-invalid={!!errors.pricePerMonth}
                />
                <FieldDescription>
                  Price in XLM (Stellar Lumens)
                </FieldDescription>
                {errors.pricePerMonth && (
                  <FieldError>{errors.pricePerMonth}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="securityDeposit">
                  Security Deposit (XLM)
                </FieldLabel>
                <Input
                  id="securityDeposit"
                  type="number"
                  placeholder="1000"
                  value={formData.securityDeposit}
                  onChange={(e) =>
                    updateField("securityDeposit", e.target.value)
                  }
                  data-invalid={!!errors.securityDeposit}
                />
                <FieldDescription>
                  Held securely in Stellar escrow until lease ends
                </FieldDescription>
                {errors.securityDeposit && (
                  <FieldError>{errors.securityDeposit}</FieldError>
                )}
              </Field>

              <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3">
                <SparkleIcon className="size-5 text-primary" />
                <p className="text-sm">
                  Payments are secured on the{" "}
                  <strong>Stellar blockchain</strong> via smart contract escrow
                </p>
              </div>
            </FieldGroup>
          )}

          {/* Step 4: Duration */}
          {currentStep === 4 && (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="minStayDays">
                    Minimum Stay (days) *
                  </FieldLabel>
                  <Input
                    id="minStayDays"
                    type="number"
                    placeholder="30"
                    min={30}
                    value={formData.minStayDays}
                    onChange={(e) => updateField("minStayDays", e.target.value)}
                    data-invalid={!!errors.minStayDays}
                  />
                  {errors.minStayDays && (
                    <FieldError>{errors.minStayDays}</FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="maxStayDays">
                    Maximum Stay (days) *
                  </FieldLabel>
                  <Input
                    id="maxStayDays"
                    type="number"
                    placeholder="365"
                    value={formData.maxStayDays}
                    onChange={(e) => updateField("maxStayDays", e.target.value)}
                    data-invalid={!!errors.maxStayDays}
                  />
                  {errors.maxStayDays && (
                    <FieldError>{errors.maxStayDays}</FieldError>
                  )}
                </Field>
              </div>

              <FieldDescription>
                Briq requires a minimum stay of 30 days to ensure quality
                long-term rentals
              </FieldDescription>
            </FieldGroup>
          )}

          {/* Step 5: Photos */}
          {currentStep === 5 && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="imageUrl">Property Image URL</FieldLabel>
                <Input
                  id="imageUrl"
                  type="url"
                  placeholder="https://example.com/property-image.jpg"
                  value={formData.imageUrl}
                  onChange={(e) => updateField("imageUrl", e.target.value)}
                />
                <FieldDescription>
                  Paste a URL to your property image (optional for MVP)
                </FieldDescription>
              </Field>

              <div className="rounded-lg border-2 border-dashed bg-muted/30 p-8 text-center">
                <ImageIcon className="mx-auto size-12 text-muted-foreground/50" />
                <p className="mt-3 font-medium">Image upload coming soon</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  For now, you can paste an image URL above
                </p>
              </div>

              {formData.imageUrl && (
                <div className="overflow-hidden rounded-lg border">
                  <img
                    src={formData.imageUrl}
                    alt="Property preview"
                    className="h-48 w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </FieldGroup>
          )}

          {/* Step 6: Review */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="rounded-lg border bg-muted/30 p-4">
                <h3 className="mb-4 font-medium">Review your listing</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Title</dt>
                    <dd className="font-medium">{formData.title}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="font-medium">{formData.location}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Monthly Rent</dt>
                    <dd className="font-medium">
                      {parseInt(formData.pricePerMonth || "0").toLocaleString()}{" "}
                      XLM
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Security Deposit</dt>
                    <dd className="font-medium">
                      {parseInt(
                        formData.securityDeposit || "0",
                      ).toLocaleString()}{" "}
                      XLM
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Stay Duration</dt>
                    <dd className="font-medium">
                      {formData.minStayDays} - {formData.maxStayDays} days
                    </dd>
                  </div>
                </dl>
              </div>

              {formData.description && (
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                    Description
                  </h4>
                  <p className="text-sm">{formData.description}</p>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-green-700 dark:text-green-400">
                <CheckCircleIcon className="size-5" weight="fill" />
                <p className="text-sm">
                  Your property will be stored on the{" "}
                  <strong>Stellar blockchain</strong>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          <ArrowLeftIcon className="size-4" />
          Previous
        </Button>

        {currentStep < STEPS.length ? (
          <Button onClick={nextStep}>
            Next
            <ArrowRightIcon className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-primary to-primary/80"
          >
            {isSubmitting ? (
              <>
                <SpinnerIcon className="size-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <SparkleIcon className="size-4" />
                Publish Property
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
