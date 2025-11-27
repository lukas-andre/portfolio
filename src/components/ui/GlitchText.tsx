import { motion } from 'framer-motion';
import { useState } from 'react';

interface GlitchTextProps {
  children: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'span' | 'p';
}

export default function GlitchText({
  children,
  className = '',
  as: Component = 'span',
}: GlitchTextProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.span
      className={`glitch-container ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      <Component style={{ position: 'relative', zIndex: 1 }}>{children}</Component>

      {/* Glitch layers - only on hover */}
      {isHovered && (
        <>
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 0.8,
              x: [0, -2, 2, -1, 1, 0],
              y: [0, 1, -1, 0],
            }}
            transition={{
              duration: 0.2,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              color: '#00d4ff',
              clipPath: 'polygon(0 0, 100% 0, 100% 35%, 0 35%)',
              zIndex: 0,
            }}
          >
            {children}
          </motion.span>

          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 0.8,
              x: [0, 2, -2, 1, -1, 0],
              y: [0, -1, 1, 0],
            }}
            transition={{
              duration: 0.2,
              repeat: Infinity,
              repeatType: 'reverse',
              delay: 0.05,
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              color: '#d946ef',
              clipPath: 'polygon(0 65%, 100% 65%, 100% 100%, 0 100%)',
              zIndex: 0,
            }}
          >
            {children}
          </motion.span>
        </>
      )}
    </motion.span>
  );
}
