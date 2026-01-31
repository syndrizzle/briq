"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletIcon, SpinnerIcon, ArrowRightIcon } from "@phosphor-icons/react";
import {
  isConnected,
  requestAccess,
  getAddress,
  getNetworkDetails,
} from "@stellar/freighter-api";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Image from "next/image";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

export default function OnboardingPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkFreighter();
  }, []);

  const checkFreighter = async () => {
    try {
      const connected = await isConnected();
      setIsFreighterInstalled(connected.isConnected);

      if (connected.isConnected) {
        const address = await getAddress();
        const network = await getNetworkDetails();
        const isTestnet =
          "networkPassphrase" in network &&
          network.networkPassphrase === TESTNET_PASSPHRASE;

        if (address.address && isTestnet) {
          setConnectedAddress(address.address);
        } else if (address.address && !isTestnet) {
          setConnectedAddress(null);
          setError("Please switch your Freighter network and try again.");
        }
      }
    } catch (err) {
      console.error("Error checking Freighter:", err);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const access = await requestAccess();

      // Handle user closing popup or denying access
      if (access.error) {
        // Check if it's a user rejection (popup closed)
        if (
          access.error === "User declined access" ||
          access.error.includes("rejected") ||
          access.error.includes("cancelled")
        ) {
          setError(
            "Connection cancelled. You can try again when you're ready.",
          );
        } else {
          setError(access.error);
        }
        setIsConnecting(false);
        return;
      }

      if (access.address) {
        const network = await getNetworkDetails();
        const isTestnet =
          "networkPassphrase" in network &&
          network.networkPassphrase === TESTNET_PASSPHRASE;

        if (!isTestnet) {
          setError("Please switch your Freighter network and try again.");
          setIsConnecting(false);
          return;
        }

        setConnectedAddress(access.address);
        // TODO: Save wallet address to database
        // After successful connection, redirect to main app
        setTimeout(() => {
          router.push("/app");
        }, 1500);
      }
    } catch (err) {
      // Handle case where user closes the popup
      if (err instanceof Error) {
        if (
          err.message?.includes("rejected") ||
          err.message?.includes("cancelled") ||
          err.message?.includes("declined") ||
          err.message?.includes("User denied")
        ) {
          setError(
            "Connection cancelled. You can try again when you're ready.",
          );
        } else {
          setError("Failed to connect wallet. Please try again.");
        }
      } else {
        setError("Connection cancelled. You can try again when you're ready.");
      }
      console.error("Error connecting wallet:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const userName = session?.user?.name || "there";
  const firstName = userName.split(" ")[0];

  // Show loading state while fetching session
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <SpinnerIcon className="size-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (connectedAddress) {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Welcome, {firstName}!</h1>
            <p className="text-sm text-muted-foreground">
              Choose how you want to use Briq
            </p>
          </div>

          <div className="grid min-h-[70vh] gap-12 md:grid-cols-2">
            <Card className="group overflow-hidden border-0 pt-0 transition-transform duration-300 hover:scale-105">
              <div className="relative aspect-3/2 w-full">
                <Image
                  src="/types/landlord.webp"
                  alt="List your home"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <CardHeader>
                <CardTitle className="text-xl">List a Home</CardTitle>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  <li>
                    Connect with verified tenants through our trusted network
                  </li>
                  <li>
                    Receive secure, instant payments powered by Stellar
                    blockchain
                  </li>
                  <li>
                    Set your own rental terms and pricing with full control
                  </li>
                  <li>
                    Built-in dispute resolution and transparent agreements
                  </li>
                  <li>Earn passive income from your unused space</li>
                </ul>
              </CardHeader>
              <CardContent>
                <Button className="w-full" size="lg">
                  I want to list
                  <ArrowRightIcon className="ml-2 size-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="group overflow-hidden border-0 pt-0 transition-transform duration-300 hover:scale-105">
              <div className="relative aspect-3/2 w-full">
                <Image
                  src="/types/tenant.webp"
                  alt="Rent a home"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <CardHeader>
                <CardTitle className="text-xl">Rent a Home</CardTitle>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  <li>
                    Browse verified listings with transparent pricing and photos
                  </li>
                  <li>
                    Secure your booking with blockchain-backed payment
                    protection
                  </li>
                  <li>Direct communication with hosts before confirming</li>
                  <li>
                    Clear rental agreements with no hidden fees or surprises
                  </li>
                  <li>
                    Find stays for any duration from short-term to long-term
                  </li>
                </ul>
              </CardHeader>
              <CardContent>
                <Button className="w-full" size="lg">
                  I want to rent
                  <ArrowRightIcon className="ml-2 size-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome, {firstName}!</CardTitle>
          <p className="text-sm text-muted-foreground">
            One more step to start renting on Briq
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 text-center">
            <h3 className="font-semibold">Connect Your Stellar Wallet</h3>
            <p className="text-sm text-muted-foreground">
              Briq uses Stellar blockchain for secure rentals. Connect your
              Freighter wallet to continue.
            </p>
          </div>

          {!isFreighterInstalled && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-900 dark:bg-yellow-950">
              <p className="text-yellow-800 dark:text-yellow-200">
                Freighter wallet not detected. Please install the extension
                first.
              </p>
              <a
                href="https://freighter.app"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs underline"
              >
                Install Freighter
              </a>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <Button
            onClick={connectWallet}
            disabled={isConnecting || !isFreighterInstalled}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <SpinnerIcon className="size-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <WalletIcon className="size-4" />
                Connect Freighter Wallet
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
