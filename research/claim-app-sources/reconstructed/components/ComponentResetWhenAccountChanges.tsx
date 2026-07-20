"use client";

import { Fragment, type PropsWithChildren } from "react";

import { useLocker } from "../contexts/LockerContext";

/** The bundle keyed this boundary by account to reset child hook state. */
export function ComponentResetWhenAccountChanges({
  children,
}: PropsWithChildren) {
  const { accountAddress } = useLocker();
  const accountKey = accountAddress?.toString() ?? "no-account";
  return <Fragment key={accountKey}>{children}</Fragment>;
}
