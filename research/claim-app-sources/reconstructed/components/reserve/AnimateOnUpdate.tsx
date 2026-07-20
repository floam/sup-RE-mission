"use client";

import { motion, useAnimate } from "framer-motion";
import { useEffect, type PropsWithChildren } from "react";

export function AnimateOnUpdate({
  value,
  children,
  className,
}: PropsWithChildren<{ value: unknown; className?: string }>) {
  const [scope, animate] = useAnimate();
  useEffect(() => {
    void animate(
      scope.current,
      { opacity: [1, 0.3] },
      { duration: 0.75, repeat: 5, repeatType: "reverse" },
    );
  }, [animate, scope, String(value)]);
  return (
    <motion.span ref={scope} className={className}>
      {children}
    </motion.span>
  );
}
