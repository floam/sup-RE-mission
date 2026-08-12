"use client";

import { useEffect, useRef, useState } from "react";

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
}

export function Countdown({
  targetDate,
  onComplete,
}: {
  targetDate: Date;
  onComplete?: () => void;
}) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [remaining, setRemaining] = useState<TimeRemaining>({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    let completed = false;
    const update = () => {
      const milliseconds = targetDate.getTime() - Date.now();
      if (milliseconds <= 0) {
        setRemaining({ hours: 0, minutes: 0, seconds: 0 });
        if (!completed) {
          completed = true;
          onCompleteRef.current?.();
        }
        return;
      }
      setRemaining({
        hours: Math.floor(milliseconds / 3_600_000),
        minutes: Math.floor((milliseconds / 60_000) % 60),
        seconds: Math.floor((milliseconds / 1_000) % 60),
      });
    };
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [targetDate]);

  return (
    <span className="tabular-nums">
      {String(remaining.hours).padStart(2, "0")}:
      {String(remaining.minutes).padStart(2, "0")}:
      {String(remaining.seconds).padStart(2, "0")}
    </span>
  );
}
