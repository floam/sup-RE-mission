export interface ClaimNonceWindow {
  lastClaimNonce: number;
  currentNonce: number;
  startTime: string | null;
  endTime: string;
}

function safeNonce(value: bigint | number, label: string) {
  const nonce = Number(value);
  if (!Number.isSafeInteger(nonce) || nonce < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return nonce;
}

function nonceTimestamp(nonce: number) {
  return new Date(nonce * 1_000).toISOString();
}

export function getClaimNonceWindow(
  nextValidNonceValue: bigint | number,
  currentNonceValue: bigint | number,
): ClaimNonceWindow {
  const nextValidNonce = safeNonce(nextValidNonceValue, "Next valid nonce");
  const currentNonce = safeNonce(currentNonceValue, "Current signed-balance nonce");
  const lastClaimNonce = Math.max(0, nextValidNonce - 1);
  if (currentNonce <= lastClaimNonce) {
    throw new Error("Current signed-balance nonce must be newer than the last claimed nonce.");
  }

  return {
    lastClaimNonce,
    currentNonce,
    startTime: lastClaimNonce > 0 ? nonceTimestamp(lastClaimNonce) : null,
    endTime: nonceTimestamp(currentNonce),
  };
}
