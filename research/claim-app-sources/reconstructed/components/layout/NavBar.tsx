"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { NavConnectAndBalance } from "./NavConnectAndBalance";
import { NavLink } from "./NavLink";

export interface NavigationItem {
  title: string;
  href: string;
  additionalHref: string[];
  isNew: boolean;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { title: "My Reserve", href: "/reserve", additionalHref: [], isNew: true },
  { title: "Claim", href: "/claim", additionalHref: ["/"], isNew: false },
  { title: "Campaigns", href: "/campaign", additionalHref: ["/apps"], isNew: false },
  {
    title: "Leaderboard",
    href: "/leaderboard",
    additionalHref: [],
    isNew: false,
  },
  {
    title: "Governance",
    href: "/governance",
    additionalHref: [],
    isNew: false,
  },
  { title: "Staking", href: "/staking", additionalHref: [], isNew: false },
  { title: "Liquidity", href: "/liquidity", additionalHref: [], isNew: false },
] as const;

function NavigationItemLink({
  item,
  onClick,
}: {
  item: NavigationItem;
  onClick?(): void;
}) {
  return (
    <div className="flex items-center gap-1">
      <NavLink
        href={item.href}
        additionalHref={item.additionalHref}
        onClick={onClick}
      >
        {item.title}
      </NavLink>
      {item.isNew && (
        <span className="bg-violet-light px-1 text-[11px] text-violet-dark">
          New
        </span>
      )}
    </div>
  );
}

export function NavBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <header className="w-full rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <Link className="mr-2 lg:mr-16" href="/">
            <Image
              src="/sf-logo-full.svg"
              alt="Superfluid Logo"
              width={200}
              height={50}
              className="hidden max-h-[47.9px] lg:block"
            />
            <Image
              src="/sf-logo-small.svg"
              alt="Superfluid Logo"
              width={50}
              height={50}
              className="max-h-[47.9px] lg:hidden"
            />
          </Link>
          <nav className="hidden space-x-8 lg:flex">
            {NAVIGATION_ITEMS.map((item) => (
              <NavigationItemLink key={item.href} item={item} />
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-5">
          <NavConnectAndBalance />
          <button
            className="lg:hidden"
            aria-label="Open navigation menu"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu />
          </button>
        </div>
      </div>
      {isMenuOpen && (
        <div
          role="dialog"
          aria-label="Navigation menu"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-[540px] bg-white px-8 py-4"
        >
          <div className="flex items-center justify-between border-b pb-3">
            <Image
              src="/sf-logo-small.svg"
              alt="Superfluid Logo"
              width={40}
              height={40}
            />
            <button
              aria-label="Close navigation menu"
              onClick={() => setIsMenuOpen(false)}
            >
              <X />
            </button>
          </div>
          <nav className="mt-10 flex flex-col items-start space-y-6">
            {NAVIGATION_ITEMS.map((item) => (
              <NavigationItemLink
                key={item.href}
                item={item}
                onClick={() => setIsMenuOpen(false)}
              />
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
