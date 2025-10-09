import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { NavMenu } from "@/components/ui/NavMenu";
import { SafeClerkProvider } from "@/lib/safe-clerk";
import { SkipLink } from "@/components/ui/SkipLink";

export const metadata: Metadata = {
  title: "LLM Usage Tracker",
  description: "Track your LLM API usage and costs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    process.env.CLERK_PUBLISHABLE_KEY ??
    null;

  const frontendApi = process.env.NEXT_PUBLIC_CLERK_FRONTEND_API ?? null;

  if (!publishableKey) {
    const message = frontendApi
      ? "[Clerk] Detected NEXT_PUBLIC_CLERK_FRONTEND_API but no publishable key. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY to enable Clerk. Rendering without ClerkProvider."
      : "[Clerk] Clerk environment variables are not configured. Rendering without ClerkProvider.";

    console.warn(message);
  }

  const appShell = (
    <html lang="en">
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
        )}
      >
        <SkipLink />
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <NavMenu />
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );

  const clerkConfigured = Boolean(publishableKey);

  return (
    <SafeClerkProvider publishableKey={publishableKey} isConfigured={clerkConfigured}>
      {appShell}
    </SafeClerkProvider>
  );
}
