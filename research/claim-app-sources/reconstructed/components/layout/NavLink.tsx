"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
  onClick,
  target,
  additionalHref,
}: {
  href: string;
  children: ReactNode;
  onClick?(): void;
  target?: string;
  additionalHref?: string[];
}) {
  const pathname = usePathname();
  const active =
    pathname.startsWith(href) ||
    additionalHref?.some(
      (candidate) => pathname.toLowerCase() === candidate.toLowerCase(),
    );
  return (
    <Link
      href={href}
      target={target}
      onClick={onClick}
      data-active={active || undefined}
      className="text-muted-foreground decoration-2 decoration-green-sf underline-offset-8 hover:text-primary data-[active]:font-medium data-[active]:text-primary data-[active]:underline"
    >
      {children}
    </Link>
  );
}
