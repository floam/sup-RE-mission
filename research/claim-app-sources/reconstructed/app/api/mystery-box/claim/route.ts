import { isAddress, isHash } from "viem";

const upstream = "https://claim.superfluid.org/api/mystery-box/claim";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    address?: string;
    transactionHash?: string;
  };
  if (
    !body.address ||
    !isAddress(body.address) ||
    !body.transactionHash ||
    !isHash(body.transactionHash)
  )
    return Response.json(
      { error: "A valid address and transaction hash are required." },
      { status: 400 },
    );

  const response = await fetch(upstream, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
}
