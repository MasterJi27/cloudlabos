"use client";

import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export function AnimatedCounter({ value }: { value: number }) {
  const [hasMounted, setHasMounted] = useState(false);
  
  const spring = useSpring(0, {
    stiffness: 100,
    damping: 30,
    mass: 1,
  });

  const display = useTransform(spring, (current) => Math.round(current).toString());

  useEffect(() => {
    setHasMounted(true);
    spring.set(value);
  }, [value, spring]);

  if (!hasMounted) {
    return <span>{value}</span>;
  }

  return (
    <motion.span style={{ fontVariantNumeric: "tabular-nums" }}>
      {display}
    </motion.span>
  );
}
