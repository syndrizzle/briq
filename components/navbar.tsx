"use client"

import { Button } from "@/components/ui/button"
import { PlusIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { LoginDialog } from "@/components/login-dialog"

export function Navbar() {
  return (
    <header className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl">
      <nav className="flex h-14 items-center justify-between rounded-md border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Link href="/" className="flex items-center space-x-2">
          <span className="font-bold text-xl tracking-tight">Briq</span>
        </Link>
        <LoginDialog>
          {({ onClick }) => (
            <Button size="sm" onClick={onClick}>
              <PlusIcon className="size-4" />
              Get Started
            </Button>
          )}
        </LoginDialog>
      </nav>
    </header>
  )
}
