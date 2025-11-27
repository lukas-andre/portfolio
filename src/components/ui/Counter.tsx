import { motion, useInView, useSpring, useTransform } from 'framer-motion';
import { useRef, useEffect } from 'react';

interface CounterProps {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}

export default function Counter({
  value,
  suffix = '+',
  duration = 2,
  className = '',
}: CounterProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });

  const display = useTransform(spring, (current) =>
    Math.floor(current).toString()
  );

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  return (
    <motion.span ref={ref} className={className}>
      <motion.span>{display}</motion.span>
      {suffix}
    </motion.span>
  );
}
