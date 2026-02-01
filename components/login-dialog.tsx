"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoogleLogoIcon } from "@phosphor-icons/react";
import { signIn } from "@/lib/auth-client";
import { useState, ReactNode } from "react";

interface LoginDialogProps {
  children: (props: { onClick: () => void }) => ReactNode;
}

export function LoginDialog({ children }: LoginDialogProps) {
  const [open, setOpen] = useState(false);

  const handleGoogleLogin = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: "/app/onboarding",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children({ onClick: () => setOpen(true) })}
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader className="flex flex-col items-center gap-2 space-y-0 pt-4">
          <div className="flex items-center justify-center">
            <span className="font-embryo text-3xl font-bold tracking-wide text-primary">
              BRIQ
            </span>
          </div>
          <DialogTitle className="text-xl text-center">
            Welcome to Briq
          </DialogTitle>
          <DialogDescription className="text-center">
            Sign in to start renting on Briq.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Button
            variant="outline"
            size="lg"
            className="w-full h-12 gap-3 text-base font-medium shadow-sm transition-all hover:bg-muted hover:text-foreground hover:shadow-md hover:border-primary/20"
            onClick={handleGoogleLogin}
          >
            <GoogleLogoIcon className="size-5" />
            Continue with Google
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
