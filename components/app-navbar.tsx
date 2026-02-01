"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession, signOut } from "@/lib/auth-client";
import {
  HouseIcon,
  MagnifyingGlassIcon,
  HandshakeIcon,
  CoinIcon,
  SignOutIcon,
  UserIcon,
  GearIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const navTabs = [
  { href: "/app/dashboard", label: "Home", icon: HouseIcon },
  { href: "/app/properties", label: "Properties", icon: MagnifyingGlassIcon },
  { href: "/app/agreements", label: "Agreements", icon: HandshakeIcon },
  { href: "/app/payments", label: "Payments", icon: CoinIcon },
];

export function AppNavbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Wait for hydration before rendering session-dependent content
  useEffect(() => {
    setMounted(true);
  }, []);

  const user = session?.user;
  const initials = mounted
    ? user?.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "U"
    : "U";

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/app/dashboard" className="flex items-center">
          <span className="text-xl font-bold tracking-tight">Briq</span>
        </Link>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          {navTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border border-primary/50 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon
                  className="size-4"
                  weight={isActive ? "fill" : "regular"}
                />
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Avatar size="default">
              {user?.image && (
                <AvatarImage src={user.image} alt={user.name || "User"} />
              )}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link
                href="/app/profile"
                className="flex w-full items-center gap-2"
              >
                <UserIcon className="size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link
                href="/app/settings"
                className="flex w-full items-center gap-2"
              >
                <GearIcon className="size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} variant="destructive">
              <SignOutIcon className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
}
