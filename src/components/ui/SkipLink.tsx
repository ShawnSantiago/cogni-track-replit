"use client";

import React from "react";
import { cn } from "@/lib/utils";

type SkipLinkProps = {
  targetId?: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Accessible Skip Link
 * - Hidden by default (sr-only), becomes visible on keyboard focus
 * - Jumps to #main-content (or provided targetId) and moves focus there
 * - Uses design tokens (bg-primary, text-primary-foreground, ring-ring)
 */
export function SkipLink({
  targetId = "main-content",
  className,
  children,
}: SkipLinkProps) {
  const href = `#${targetId}`;
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-[4.5rem] z-[100] rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg outline-none focus:ring-2 focus:ring-ring transition-none",
        className,
      )}
      onClick={() => {
        // After the anchor jump, ensure focus is programmatically moved to the target region
        // Delay to allow the browser to complete default behavior
        setTimeout(() => {
          const el = document.getElementById(targetId) as HTMLElement | null;
          if (el) el.focus();
        }, 0);
      }}
    >
      {children ?? "Skip to main content"}
    </a>
  );
}
