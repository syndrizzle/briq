"use client"

import { Button } from "@/components/ui/button"
import { PlusIcon } from "@phosphor-icons/react"
import { LoginDialog } from "@/components/login-dialog"

export function Hero() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center px-4 py-20 text-center">
      <div className="max-w-3xl space-y-8">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
          Home Rentals, Reimagined
        </h1>
        <p className="mx-auto max-w-[700px] text-lg text-muted-foreground sm:text-xl">
          Briq is a decentralized home rental platform built on Stellar. 
          Find your next stay with blockchain-powered trust and transparency.
        </p>
        <div className="flex justify-center">
          <LoginDialog>
            {({ onClick }) => (
              <Button size="lg" className="text-base px-8" onClick={onClick}>
                <PlusIcon className="size-4" />
                Get Started
              </Button>
            )}
          </LoginDialog>
        </div>
      </div>
    </section>
  )
}
