import { AppNavbar } from "@/components/app-navbar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppNavbar />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
