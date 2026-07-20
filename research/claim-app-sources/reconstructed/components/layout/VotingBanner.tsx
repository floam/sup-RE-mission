import { ExternalLink } from "lucide-react";

import { OneTimeBanner } from "./OneTimeBanner";

export function VotingBanner({
  initialDismissed,
}: {
  initialDismissed?: boolean;
}) {
  return (
    <OneTimeBanner
      storageKey="voting-banner-dismissed"
      endTime={0x6a0edb60}
      initialDismissed={initialDismissed}
    >
      <span className="font-medium">Help decide Season 6 SUP campaigns</span>
      <a
        href="https://snapshot.box/#/s:superfluid.eth/proposal/0x9ec837de9a1093007e7ba2996502c922060f0b6bc368b3c877c7bbc1724204a8"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center rounded-full bg-violet-light px-5 text-violet-dark"
      >
        Vote now
        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
      </a>
    </OneTimeBanner>
  );
}
