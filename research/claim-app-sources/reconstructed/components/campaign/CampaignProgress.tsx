export function CampaignProgress({
  activePrograms,
  nextTierName,
  nextTierMin,
}: {
  activePrograms: number;
  nextTierName?: string;
  nextTierMin?: number | null;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="mb-1 text-center text-green text-sm">
        CAMPAIGNS YOU&apos;RE ACTIVE IN
      </p>
      <div className="mb-1 text-center font-bold text-[56px] leading-none">
        {activePrograms}
      </div>
      {nextTierMin && nextTierName && (
        <div>
          <div className="mb-2 flex justify-between text-gray-600 text-sm">
            <span>Next tier: {nextTierName}</span>
            <span>
              {activePrograms}/{nextTierMin}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-300">
            <div
              className="h-full bg-purple"
              style={{
                width: `${Math.min(100, (activePrograms / nextTierMin) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
