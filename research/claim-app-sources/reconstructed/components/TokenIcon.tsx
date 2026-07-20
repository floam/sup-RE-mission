import Image from "next/image";

export function TokenIcon({
  token,
  size = 24,
}: {
  token: "eth" | "sup";
  size?: number;
}) {
  if (token === "eth") {
    const iconSize = size * 0.5;
    return (
      <div
        className="flex items-center justify-center rounded-full bg-gray-200"
        style={{ width: size, height: size }}
      >
        <Image src="/eth.svg" alt="ETH" width={iconSize} height={iconSize} />
      </div>
    );
  }
  return <Image src="/sup.svg" alt="SUP" width={size} height={size} />;
}
