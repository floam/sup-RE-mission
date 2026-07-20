"use client";

import { cloneElement, isValidElement, type ReactElement } from "react";

import { useLocker } from "../../contexts/LockerContext";
import { ComponentResetWhenAccountChanges } from "../ComponentResetWhenAccountChanges";

export function ConnectedHideGuard({ children }: { children: ReactElement }) {
  const { accountAddress } = useLocker();
  return accountAddress ? (
    <ComponentResetWhenAccountChanges>
      {children}
    </ComponentResetWhenAccountChanges>
  ) : isValidElement(children) ? (
    cloneElement(children, {
      className: `invisible ${(children.props as { className?: string }).className ?? ""}`,
    } as never)
  ) : null;
}
