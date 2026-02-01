"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "@phosphor-icons/react";
import { LoginDialog } from "@/components/login-dialog";

export function Hero() {
  return (
    <section
      className="relative flex min-h-screen flex-col justify-center px-4 py-20 text-left"
      style={{
        backgroundImage: "url('/background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative z-10 container mx-auto max-w-6xl">
        <div className="max-w-3xl space-y-8">
          <h1 className="text-4xl font-bold tracking-tighter text-lime-900 text-shadow-lg sm:text-5xl md:text-6xl lg:text-7xl">
            Home Rentals, <br />
            Reimagined.
          </h1>
          <p className="max-w-xl text-md text-lime-900 text-shadow-lg sm:text-2xl ">
            Briq is a decentralized home rental platform built on Stellar. Find
            your next stay with blockchain-powered trust and transparency.
          </p>
          <div className="flex justify-start">
            <LoginDialog>
              {({ onClick }) => (
                <Button
                  size="lg"
                  className="h-12 px-8 text-base bg-lime-700 text-primary-foreground hover:bg-lime-800"
                  onClick={onClick}
                  variant={"secondary"}
                >
                  <PlusIcon className="mr-2 size-5" />
                  Get Started
                </Button>
              )}
            </LoginDialog>
          </div>
        </div>
      </div>
    </section>
  );
}
