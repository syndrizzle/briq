"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { LoginDialog } from "@/components/login-dialog";

export function Navbar() {
  return (
    <header className="fixed top-0 z-50 w-full bg-transparent">
      <nav className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 md:px-0">
        <Link href="/" className="flex items-center space-x-2">
          <span className="font-embryo font-bold text-3xl tracking-wide text-lime-100 text-shadow-lg">
            BRIQ
          </span>
        </Link>
        <LoginDialog>
          {({ onClick }) => (
            <Button
              onClick={onClick}
              className="bg-lime-700 text-primary-foreground hover:bg-lime-800"
            >
              <PlusIcon className="size-4 " />
              Get Started
            </Button>
          )}
        </LoginDialog>
      </nav>
    </header>
  );
}
