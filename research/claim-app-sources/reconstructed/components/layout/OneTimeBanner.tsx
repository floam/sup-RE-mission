"use client";

import { Cross2Icon } from "@radix-ui/react-icons";
import { useState, type ReactNode } from "react";

export function OneTimeBanner({
  storageKey,
  children,
  startTime,
  endTime,
  initialDismissed = false,
}: {
  storageKey: string;
  children: ReactNode;
  startTime?: number;
  endTime?: number;
  initialDismissed?: boolean;
}) {
  const [dismissed, setDismissed] = useState(initialDismissed);
  const now = Math.floor(Date.now() / 1_000);
  if (dismissed || (startTime && now < startTime) || (endTime && now > endTime))
    return null;
  const dismiss = () => {
    const maxAge = endTime
      ? endTime - Math.floor(Date.now() / 1_000) + 172_800
      : 31_536_000;
    document.cookie = `${storageKey}=true; path=/; max-age=${maxAge}; SameSite=Lax`;
    setDismissed(true);
  };
  return (
    <div className="relative mb-4 w-full rounded-lg bg-purple p-3 text-white">
      <button
        onClick={dismiss}
        className="absolute top-1/2 right-3 -translate-y-1/2"
        aria-label="Close banner"
      >
        <Cross2Icon className="h-5 w-5" />
      </button>
      <div className="flex flex-col items-center gap-3 pr-8 text-center sm:flex-row sm:justify-center sm:gap-4">
        {children}
      </div>
    </div>
  );
}
