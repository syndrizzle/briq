"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GoogleLogoIcon } from "@phosphor-icons/react"
import { signIn } from "@/lib/auth-client"
import { useState, ReactNode } from "react"

interface LoginDialogProps {
  children: (props: { onClick: () => void }) => ReactNode
}

export function LoginDialog({ children }: LoginDialogProps) {
  const [open, setOpen] = useState(false)

  const handleGoogleLogin = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: "/app",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children({ onClick: () => setOpen(true) })}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Get Started</DialogTitle>
          <DialogDescription>
            Sign in with Google to start renting on Briq.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
          >
            <GoogleLogoIcon className="size-4" />
            Continue with Google
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
