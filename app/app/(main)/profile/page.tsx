"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserIcon,
  WalletIcon,
  HouseIcon,
  UsersIcon,
  LinkIcon,
  CheckCircleIcon,
  SpinnerIcon,
  CopyIcon,
  ArrowsClockwiseIcon,
  WarningIcon,
  EnvelopeIcon,
  IdentificationCardIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import {
  isConnected,
  getNetworkDetails,
  requestAccess,
} from "@stellar/freighter-api";
import { toast } from "sonner";

// Extended session type
interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  walletAddress?: string;
  userType?: "landlord" | "tenant";
}

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

// Shorten wallet address for display
function shortenAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isFreighterConnected, setIsFreighterConnected] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [userType, setUserType] = useState<"landlord" | "tenant">("landlord");
  const [isSwitching, setIsSwitching] = useState(false);

  // Initialize from session
  useEffect(() => {
    if (user?.walletAddress) {
      setWalletAddress(user.walletAddress);
    }
    if (user?.userType) {
      setUserType(user.userType);
    }
  }, [user]);

  // Check Freighter status
  useEffect(() => {
    checkFreighter();
  }, []);

  const checkFreighter = async () => {
    try {
      const connected = await isConnected();
      setIsFreighterConnected(connected.isConnected);
    } catch (err) {
      console.error("Error checking Freighter:", err);
    }
  };

  const linkWallet = async () => {
    setIsLinking(true);
    try {
      const access = await requestAccess();

      if (access.error) {
        toast.error(access.error);
        return;
      }

      if (access.address) {
        const network = await getNetworkDetails();
        const isTestnet =
          "networkPassphrase" in network &&
          network.networkPassphrase === TESTNET_PASSPHRASE;

        if (!isTestnet) {
          toast.error("Please switch Freighter to Testnet");
          return;
        }

        // Save to database
        const res = await fetch("/api/user/update-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: access.address }),
        });

        if (res.ok) {
          setWalletAddress(access.address);
          toast.success("Wallet linked successfully!");
        } else {
          toast.error("Failed to save wallet");
        }
      }
    } catch (err) {
      console.error("Error linking wallet:", err);
      toast.error("Failed to link wallet");
    } finally {
      setIsLinking(false);
    }
  };

  const switchUserType = async (newType: "landlord" | "tenant") => {
    if (newType === userType) return;

    setIsSwitching(true);
    try {
      const res = await fetch("/api/user/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userType: newType }),
      });

      if (res.ok) {
        setUserType(newType);
        toast.success(
          `Switched to ${newType === "landlord" ? "Landlord" : "Tenant"} mode`,
        );
      } else {
        toast.error("Failed to switch mode");
      }
    } catch (err) {
      console.error("Error switching user type:", err);
      toast.error("Failed to switch mode");
    } finally {
      setIsSwitching(false);
    }
  };

  const copyWalletAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success("Wallet address copied!");
    }
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Hero Card */}
      <Card className="overflow-hidden py-0">
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Avatar className="size-20 border-4 border-background shadow-lg">
              {user?.image && (
                <AvatarImage src={user.image} alt={user?.name || "User"} />
              )}
              <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-semibold">{user?.name || "User"}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge
                  variant={userType === "landlord" ? "default" : "secondary"}
                >
                  {userType === "landlord" ? (
                    <>
                      <HouseIcon className="mr-1 size-3" weight="fill" />
                      Landlord
                    </>
                  ) : (
                    <>
                      <UsersIcon className="mr-1 size-3" weight="fill" />
                      Tenant
                    </>
                  )}
                </Badge>
                {walletAddress && (
                  <Badge variant="outline" className="border-primary/50">
                    <WalletIcon className="mr-1 size-3" />
                    Connected
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Mode Switcher */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <ArrowsClockwiseIcon className="size-4 text-primary" />
            </div>
            Switch Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => switchUserType("landlord")}
              disabled={isSwitching}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                userType === "landlord"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isSwitching && userType !== "landlord" ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <HouseIcon
                  className="size-4"
                  weight={userType === "landlord" ? "fill" : "regular"}
                />
              )}
              Landlord
            </button>
            <button
              onClick={() => switchUserType("tenant")}
              disabled={isSwitching}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                userType === "tenant"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isSwitching && userType !== "tenant" ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <UsersIcon
                  className="size-4"
                  weight={userType === "tenant" ? "fill" : "regular"}
                />
              )}
              Tenant
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {userType === "landlord"
              ? "As a landlord, you can list properties and receive rent payments."
              : "As a tenant, you can browse properties and make rental agreements."}
          </p>
        </CardContent>
      </Card>

      {/* Wallet Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <WalletIcon className="size-4 text-primary" />
            </div>
            Stellar Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {walletAddress ? (
            <>
              {/* Connected Wallet Display */}
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircleIcon
                    className="size-5 text-primary"
                    weight="fill"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Wallet Connected</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {shortenAddress(walletAddress)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={copyWalletAddress}>
                  <CopyIcon className="size-4" />
                </Button>
              </div>

              {/* Relink Option */}
              <Button
                variant="outline"
                className="w-full"
                onClick={linkWallet}
                disabled={isLinking}
              >
                {isLinking ? (
                  <>
                    <SpinnerIcon className="size-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LinkIcon className="size-4" />
                    Link Different Wallet
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* No Wallet Connected */}
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <WarningIcon
                    className="size-5 text-muted-foreground"
                    weight="fill"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">No Wallet Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Connect your Freighter wallet to use Briq
                  </p>
                </div>
              </div>

              {!isFreighterConnected && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <p className="text-muted-foreground">
                    Freighter wallet extension not detected.
                  </p>
                  <a
                    href="https://freighter.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-primary underline"
                  >
                    Install Freighter →
                  </a>
                </div>
              )}

              <Button
                onClick={linkWallet}
                disabled={isLinking || !isFreighterConnected}
                className="w-full"
              >
                {isLinking ? (
                  <>
                    <SpinnerIcon className="size-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <WalletIcon className="size-4" />
                    Connect Wallet
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <UserIcon className="size-4 text-primary" />
            </div>
            Account Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50">
            <UserIcon className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{user?.name || "-"}</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50">
            <EnvelopeIcon className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user?.email || "-"}</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50">
            <IdentificationCardIcon className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">
              User ID
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {user?.id ? `${user.id.slice(0, 8)}...` : "-"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
