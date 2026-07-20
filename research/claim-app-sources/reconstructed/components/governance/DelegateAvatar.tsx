"use client";

import Jazzicon, { jsNumberForAddress } from "react-jazzicon";

import { useAddressProfile } from "../../hooks/useAddressProfile";
import type { DelegateProfile } from "../../types/governance";

export function DelegateAvatar({
  delegate,
  className = "",
}: {
  delegate: DelegateProfile;
  className?: string;
}) {
  const profile = useAddressProfile(delegate.address);
  const avatarUrl =
    delegate.avatarOverride ?? profile?.primaryAvatarUrl ?? undefined;
  return (
    <span
      className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-100">
          <Jazzicon
            diameter={32}
            seed={jsNumberForAddress(profile?.addressChecksummed)}
          />
        </span>
      )}
    </span>
  );
}
