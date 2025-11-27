import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

interface VibratingLogoProps {
  className?: string;
}

export default function VibratingLogo({ className = '' }: VibratingLogoProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleId = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Spawn particles on hover
  useEffect(() => {
    if (!isHovered) return;

    const spawnInterval = setInterval(() => {
      const newParticle: Particle = {
        id: particleId.current++,
        x: 50 + (Math.random() - 0.5) * 20,
        y: 50 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 1,
        life: 1,
        size: Math.random() * 3 + 1,
      };
      setParticles(prev => [...prev.slice(-15), newParticle]);
    }, 80);

    return () => clearInterval(spawnInterval);
  }, [isHovered]);

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return;

    const animateInterval = setInterval(() => {
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life - 0.02,
          }))
          .filter(p => p.life > 0)
      );
    }, 16);

    return () => clearInterval(animateInterval);
  }, [particles.length]);

  // Micro-shake values
  const microShake = {
    x: [0, 0.5, -0.5, 0.3, -0.3, 0],
    y: [0, -0.3, 0.3, -0.5, 0.5, 0],
  };

  return (
    <motion.div
      ref={containerRef}
      className={`vibrating-logo ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.1rem',
        cursor: 'pointer',
      }}
    >
      {/* Particles */}
      <svg
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '200%',
          height: '200%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {particles.map(p => (
          <circle
            key={p.id}
            cx={`${p.x}%`}
            cy={`${p.y}%`}
            r={p.size}
            fill="var(--accent-amber)"
            opacity={p.life * 0.8}
          />
        ))}
      </svg>

      {/* Glow background */}
      <motion.div
        style={{
          position: 'absolute',
          inset: '-10px',
          borderRadius: '12px',
          background: 'radial-gradient(circle, rgba(212, 165, 116, 0.3) 0%, transparent 70%)',
          filter: 'blur(8px)',
          zIndex: -1,
        }}
        animate={{
          opacity: isHovered ? [0.5, 0.8, 0.5] : [0.2, 0.35, 0.2],
          scale: isHovered ? [1, 1.1, 1] : [1, 1.05, 1],
        }}
        transition={{
          duration: isHovered ? 0.3 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Left bracket */}
      <motion.span
        style={{
          fontFamily: 'var(--font-terminal)',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--accent-amber)',
          textShadow: isHovered ? '0 0 20px rgba(212, 165, 116, 0.8)' : 'none',
        }}
        animate={isHovered ? { x: [-2, 0, -2] } : microShake}
        transition={{
          duration: isHovered ? 0.1 : 0.15,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        [
      </motion.span>

      {/* Logo text with glitch */}
      <motion.span
        className="logo-text"
        data-text="LH"
        style={{
          fontFamily: 'var(--font-terminal)',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          position: 'relative',
          textShadow: isHovered ? '0 0 15px rgba(245, 242, 235, 0.5)' : 'none',
        }}
        animate={isHovered ? {
          x: [0, -2, 2, -1, 1, 0],
          y: [0, 1, -1, 2, -2, 0],
        } : microShake}
        transition={{
          duration: isHovered ? 0.15 : 0.15,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        LH
        {/* Glitch layers - only on hover */}
        {isHovered && (
          <>
            <motion.span
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                color: 'var(--accent-amber)',
                clipPath: 'polygon(0 0, 100% 0, 100% 33%, 0 33%)',
                opacity: 0.8,
              }}
              animate={{
                x: [-3, 3, -2, 2, 0],
                opacity: [0.8, 0.5, 0.8, 0.6, 0.8],
              }}
              transition={{
                duration: 0.2,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              LH
            </motion.span>
            <motion.span
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                color: 'var(--accent-sage)',
                clipPath: 'polygon(0 67%, 100% 67%, 100% 100%, 0 100%)',
                opacity: 0.8,
              }}
              animate={{
                x: [3, -3, 2, -2, 0],
                opacity: [0.6, 0.8, 0.5, 0.8, 0.6],
              }}
              transition={{
                duration: 0.15,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              LH
            </motion.span>
            {/* Scanline effect */}
            <motion.span
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(212, 165, 116, 0.1) 2px, rgba(212, 165, 116, 0.1) 4px)',
                pointerEvents: 'none',
              }}
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            />
          </>
        )}
      </motion.span>

      {/* Right bracket */}
      <motion.span
        style={{
          fontFamily: 'var(--font-terminal)',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--accent-amber)',
          textShadow: isHovered ? '0 0 20px rgba(212, 165, 116, 0.8)' : 'none',
        }}
        animate={isHovered ? { x: [2, 0, 2] } : microShake}
        transition={{
          duration: isHovered ? 0.1 : 0.15,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        ]
      </motion.span>
    </motion.div>
  );
}
