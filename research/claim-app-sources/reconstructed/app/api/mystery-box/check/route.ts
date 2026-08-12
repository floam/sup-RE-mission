import { isAddress } from "viem";

const upstream = "https://claim.superfluid.org/api/mystery-box/check";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !isAddress(address))
    return Response.json(
      { error: "A valid address is required." },
      { status: 400 },
    );

  const response = await fetch(`${upstream}?address=${encodeURIComponent(address)}`, {
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
