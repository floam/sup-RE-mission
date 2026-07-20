"use client";

import { useEffect, useState, type ReactNode } from "react";

export function LoadingText({
  loading,
  start,
  children,
}: {
  loading: boolean;
  start?: boolean;
  children: ReactNode;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const interval = window.setInterval(
      () => setStep((value) => value + 1),
      250,
    );
    return () => window.clearInterval(interval);
  }, [loading]);
  if (!loading) return children;
  return (
    <span>
      {!start && children}
      <span className={(step + 2) % 6 >= 3 ? "opacity-100" : "opacity-0"}>
        .
      </span>
      <span className={(step + 1) % 6 >= 3 ? "opacity-100" : "opacity-0"}>
        .
      </span>
      <span className={step % 6 >= 3 ? "opacity-100" : "opacity-0"}>.</span>
      {start && children}
    </span>
  );
}
