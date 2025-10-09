
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navigationLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" },
];

export function NavMenu() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex items-center gap-4">
      {navigationLinks.map(({ href, label }) => {
        const isActive = href === "/"
          ? pathname === "/"
          : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              isActive && "text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
