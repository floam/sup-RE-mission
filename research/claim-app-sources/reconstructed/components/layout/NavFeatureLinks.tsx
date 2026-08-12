"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useWalletAccount } from "../../hooks/useWalletAccount";

export function NavFeatureLinks() {
  const pathname = usePathname();
  const { isConnected } = useWalletAccount();

  if (pathname === "/" && !isConnected) return null;

  return (
    <>
      <Link href="/claim">claim</Link>
      <Link href="/campaign">campaigns</Link>
    </>
  );
}
