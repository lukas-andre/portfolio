import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

interface TypeWriterProps {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
  showCursor?: boolean;
}

export default function TypeWriter({
  text,
  delay = 0,
  speed = 50,
  className = '',
  showCursor = true,
}: TypeWriterProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!isInView) return;

    const startTyping = setTimeout(() => {
      setIsTyping(true);
      let i = 0;

      const typeInterval = setInterval(() => {
        if (i < text.length) {
          setDisplayedText(text.slice(0, i + 1));
          i++;
        } else {
          clearInterval(typeInterval);
          setIsTyping(false);
        }
      }, speed);

      return () => clearInterval(typeInterval);
    }, delay);

    return () => clearTimeout(startTyping);
  }, [isInView, text, delay, speed]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.3 }}
    >
      {displayedText}
      {showCursor && (
        <span
          style={{
            display: 'inline-block',
            width: '2px',
            height: '1em',
            background: isTyping ? '#00d4ff' : 'transparent',
            marginLeft: '2px',
            animation: isTyping ? 'none' : 'blink 1s step-end infinite',
            verticalAlign: 'middle',
          }}
        />
      )}
    </motion.span>
  );
}
