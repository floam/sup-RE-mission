import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function GenesisNftCard() {
  return (
    <div className="relative flex h-full min-h-[240px] flex-col overflow-hidden border-0 bg-black md:min-h-0">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/genesis-hero.png"
          alt=""
          fill
          className="object-contain object-right"
          unoptimized
        />
      </div>
      <div className="relative z-10 flex flex-1 flex-col p-6">
        <div className="mt-auto mb-10 ml-6 max-w-[260px]">
          <p className="mb-4 hidden text-white text-xs uppercase md:block">
            Mint the NFT to get 2x bonus on daily Mystery Box rewards
          </p>
        </div>
        <Link
          className="button border-green-sf bg-green-sf font-bold text-black"
          href="https://campaigns.superfluid.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          MINT SUPERFLUID GENESIS NFT
        </Link>
      </div>
    </div>
  );
}
