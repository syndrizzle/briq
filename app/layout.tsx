import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BRIQ",
    template: "%s | BRIQ",
  },
  description:
    "A decentralized rental platform built on Stellar. Connect, rent, and earn with blockchain-powered trust and transparency.",
  keywords: [
    "Stellar",
    "Blockchain",
    "Rentals",
    "Decentralized",
    "Web3",
    "Housing",
    "Crypto",
  ],
  authors: [{ name: "Briq Team" }],
  creator: "Briq Team",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://briq.drzl.dev",
    title: "Briq - Decentralized Rental Platform",
    description:
      "Find your next stay with blockchain-powered trust and transparency on Stellar.",
    siteName: "Briq",
  },
  twitter: {
    card: "summary_large_image",
    title: "Briq - Decentralized Rental Platform",
    description:
      "Find your next stay with blockchain-powered trust and transparency on Stellar.",
    creator: "@briq_app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
