"use client";

import { useLocker } from "../../contexts/LockerContext";
import { useAddressProfile } from "../../hooks/useAddressProfile";
import { useCurrentDelegate } from "../../hooks/useDelegation";

export function YourDelegate() {
  const { accountAddress } = useLocker();
  const { delegateAddress, delegate } = useCurrentDelegate({ accountAddress });
  const profile = useAddressProfile(delegateAddress);
  return (
    delegate?.name ||
    profile?.addressTruncated || <span className="invisible">N/A</span>
  );
}
