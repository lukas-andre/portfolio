import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface BootScreenProps {
  duration?: number;
}

const bootMessages = [
  { text: ':: Synchronizing neural databases...', delay: 0 },
  { text: ':: Starting cognitive pathways...', delay: 400 },
  { text: ':: Loading synaptic modules...', delay: 800 },
  { text: ':: Establishing memory connections...', delay: 1200 },
  { text: ':: Initializing creative protocols...', delay: 1600 },
  { text: '[OK] System ready', delay: 2200, isSuccess: true },
];

const asciiLogo = `
    __    __  __
   / /   / / / /
  / /   / /_/ /
 / /___/ __  /
/_____/_/ /_/
`;

export default function BootScreen({ duration = 3500 }: BootScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    // Show ASCII logo first
    const logoTimer = setTimeout(() => setShowLogo(true), 200);

    // Show boot messages with delays
    bootMessages.forEach((msg, index) => {
      setTimeout(() => {
        setVisibleMessages(prev => [...prev, index]);
      }, msg.delay + 500);
    });

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    // Complete boot sequence
    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      // Show main content after fade out
      setTimeout(() => {
        const bootContainer = document.getElementById('boot-container');
        if (bootContainer) {
          bootContainer.style.display = 'none';
        }
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
          mainContent.classList.add('loaded');
        }
      }, 500);
    }, duration);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(completeTimer);
      clearInterval(progressInterval);
    };
  }, [duration]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'var(--bg-void)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-terminal)',
            color: 'var(--text-primary)',
            padding: '2rem',
          }}
        >
          {/* Scanlines overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
              pointerEvents: 'none',
            }}
          />

          {/* ASCII Logo */}
          <AnimatePresence>
            {showLogo && (
              <motion.pre
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  color: 'var(--accent-amber)',
                  fontSize: 'clamp(0.5rem, 2vw, 0.9rem)',
                  lineHeight: 1.2,
                  marginBottom: '2rem',
                  textShadow: '0 0 20px rgba(212, 165, 116, 0.5)',
                  fontWeight: 400,
                }}
              >
                {asciiLogo}
              </motion.pre>
            )}
          </AnimatePresence>

          {/* Boot messages container */}
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              marginBottom: '2rem',
            }}
          >
            {bootMessages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={visibleMessages.includes(index) ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.3 }}
                style={{
                  fontSize: '0.85rem',
                  marginBottom: '0.5rem',
                  color: msg.isSuccess ? 'var(--accent-sage)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {msg.isSuccess && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    style={{
                      color: 'var(--accent-sage)',
                      fontWeight: 600,
                    }}
                  >
                    [OK]
                  </motion.span>
                )}
                <span>{msg.isSuccess ? 'System ready' : msg.text}</span>
                {!msg.isSuccess && visibleMessages.includes(index) && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.5, repeat: 2 }}
                    style={{ color: 'var(--accent-amber)' }}
                  >
                    ...
                  </motion.span>
                )}
              </motion.div>
            ))}
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              height: '4px',
              background: 'var(--bg-tertiary)',
              borderRadius: '2px',
              overflow: 'hidden',
              marginBottom: '1rem',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent-amber), var(--accent-gold))',
                borderRadius: '2px',
              }}
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          {/* Progress percentage */}
          <motion.div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-terminal)',
            }}
          >
            {progress}%
          </motion.div>

          {/* Glitch effect on random intervals */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--accent-amber)',
              mixBlendMode: 'overlay',
              pointerEvents: 'none',
            }}
            animate={{
              opacity: [0, 0, 0, 0.05, 0, 0, 0, 0.03, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />

          {/* Data streams effect */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                top: 0,
                left: `${15 + i * 20}%`,
                width: '1px',
                height: '100%',
                background: 'linear-gradient(180deg, transparent, var(--accent-amber), transparent)',
                opacity: 0.1,
              }}
              animate={{
                y: ['-100%', '100%'],
              }}
              transition={{
                duration: 2 + i * 0.5,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 0.3,
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
