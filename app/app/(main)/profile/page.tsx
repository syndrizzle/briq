"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
} from "@phosphor-icons/react";
import {
  isConnected,
  getAddress,
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
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              {user?.image && (
                <AvatarImage src={user.image} alt={user?.name || "User"} />
              )}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-xl">{user?.name || "User"}</CardTitle>
              <CardDescription>{user?.email}</CardDescription>
            </div>
            <Badge
              variant={userType === "landlord" ? "default" : "secondary"}
              className="text-sm"
            >
              {userType === "landlord" ? (
                <>
                  <HouseIcon className="size-3" />
                  Landlord
                </>
              ) : (
                <>
                  <UsersIcon className="size-3" />
                  Tenant
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* User Type Switcher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowsClockwiseIcon className="size-5" />
            Mode
          </CardTitle>
          <CardDescription>
            Switch between landlord and tenant mode
          </CardDescription>
        </CardHeader>
        <CardContent>
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
          <p className="mt-3 text-xs text-muted-foreground">
            {userType === "landlord"
              ? "As a landlord, you can list properties and receive rent payments."
              : "As a tenant, you can browse properties and make rental agreements."}
          </p>
        </CardContent>
      </Card>

      {/* Wallet Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WalletIcon className="size-5" />
            Stellar Wallet
          </CardTitle>
          <CardDescription>
            Your connected wallet for blockchain transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {walletAddress ? (
            <>
              {/* Connected Wallet Display */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircleIcon
                    className="size-5 text-green-500"
                    weight="fill"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Wallet Connected</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {walletAddress}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={copyWalletAddress}>
                  <CopyIcon className="size-4" />
                </Button>
              </div>

              {/* Network Badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Network</span>
                <Badge
                  variant="outline"
                  className="border-green-500 text-green-500"
                >
                  Stellar Testnet
                </Badge>
              </div>

              <Separator />

              {/* Relink Option */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Link Different Wallet</p>
                  <p className="text-xs text-muted-foreground">
                    Connect a new Stellar wallet
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={linkWallet}
                  disabled={isLinking}
                >
                  {isLinking ? (
                    <SpinnerIcon className="size-4 animate-spin" />
                  ) : (
                    <LinkIcon className="size-4" />
                  )}
                  Relink
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* No Wallet Connected */}
              <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-yellow-500/10">
                  <WarningIcon
                    className="size-5 text-yellow-500"
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
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-900 dark:bg-yellow-950">
                  <p className="text-yellow-800 dark:text-yellow-200">
                    Freighter wallet extension not detected.
                  </p>
                  <a
                    href="https://freighter.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs underline"
                  >
                    Install Freighter
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

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="size-5" />
            Account Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{user?.name || "-"}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user?.email || "-"}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">User ID</span>
            <span className="font-mono text-xs text-muted-foreground">
              {user?.id || "-"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
