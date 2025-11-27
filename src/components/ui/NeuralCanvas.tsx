import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  layer: number; // 0-4 for 5 parallax layers
  color: string;
}

interface DataStream {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

// Color palette
const COLORS = {
  amber: { r: 212, g: 165, b: 116 },
  gold: { r: 201, g: 148, b: 58 },
  cream: { r: 232, g: 220, b: 200 },
  sage: { r: 138, g: 154, b: 124 },
};

export default function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const dataStreamsRef = useRef<DataStream[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize handler
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
      initDataStreams();
    };

    // Initialize particles - MORE particles (150+)
    const initParticles = () => {
      const particleCount = Math.max(150, Math.floor((canvas.width * canvas.height) / 12000));
      particlesRef.current = [];

      const colorKeys = Object.keys(COLORS) as (keyof typeof COLORS)[];

      for (let i = 0; i < particleCount; i++) {
        const colorKey = colorKeys[Math.floor(Math.random() * colorKeys.length)];
        const color = COLORS[colorKey];

        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.5 + 0.15,
          layer: Math.floor(Math.random() * 5), // 5 layers
          color: `${color.r}, ${color.g}, ${color.b}`,
        });
      }
    };

    // Initialize data streams (Matrix-style)
    const initDataStreams = () => {
      const streamCount = Math.floor(canvas.width / 100);
      dataStreamsRef.current = [];

      for (let i = 0; i < streamCount; i++) {
        dataStreamsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speed: Math.random() * 2 + 1,
          length: Math.random() * 100 + 50,
          opacity: Math.random() * 0.1 + 0.03,
        });
      }
    };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scrollY = window.scrollY;
      const particles = particlesRef.current;
      const dataStreams = dataStreamsRef.current;
      const mouse = mouseRef.current;

      // Draw data streams first (background)
      dataStreams.forEach((stream) => {
        const gradient = ctx.createLinearGradient(
          stream.x, stream.y,
          stream.x, stream.y + stream.length
        );
        gradient.addColorStop(0, `rgba(212, 165, 116, 0)`);
        gradient.addColorStop(0.5, `rgba(212, 165, 116, ${stream.opacity})`);
        gradient.addColorStop(1, `rgba(212, 165, 116, 0)`);

        ctx.beginPath();
        ctx.moveTo(stream.x, stream.y);
        ctx.lineTo(stream.x, stream.y + stream.length);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Update stream position
        stream.y += stream.speed;
        if (stream.y > canvas.height + stream.length) {
          stream.y = -stream.length;
          stream.x = Math.random() * canvas.width;
        }
      });

      // Update and draw particles
      particles.forEach((particle) => {
        // Parallax based on layer (5 layers: 0.02 to 0.1)
        const parallaxFactor = (particle.layer + 1) * 0.02;
        const parallaxY = scrollY * parallaxFactor;

        // Mouse interaction - repulsion close, attraction far
        const dx = mouse.x - particle.x;
        const dy = mouse.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150 && dist > 0) {
          // Repulsion zone (close)
          const force = (150 - dist) / 150 * 0.02;
          particle.vx -= dx * force * 0.01;
          particle.vy -= dy * force * 0.01;
        } else if (dist < 300 && dist > 150) {
          // Attraction zone (mid-range)
          const force = (dist - 150) / 150 * 0.005;
          particle.vx += dx * force * 0.002;
          particle.vy += dy * force * 0.002;
        }

        // Damping
        particle.vx *= 0.98;
        particle.vy *= 0.98;

        // Speed limit
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (speed > 2) {
          particle.vx = (particle.vx / speed) * 2;
          particle.vy = (particle.vy / speed) * 2;
        }

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounds (wrap around)
        if (particle.x < -10) particle.x = canvas.width + 10;
        if (particle.x > canvas.width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = canvas.height + 10;
        if (particle.y > canvas.height + 10) particle.y = -10;

        // Draw particle with parallax
        const drawY = (particle.y + parallaxY) % (canvas.height + 20);

        // Glow effect for larger particles
        if (particle.radius > 1.5) {
          ctx.beginPath();
          const glowGradient = ctx.createRadialGradient(
            particle.x, drawY, 0,
            particle.x, drawY, particle.radius * 4
          );
          glowGradient.addColorStop(0, `rgba(${particle.color}, ${particle.opacity * 0.5})`);
          glowGradient.addColorStop(1, `rgba(${particle.color}, 0)`);
          ctx.fillStyle = glowGradient;
          ctx.arc(particle.x, drawY, particle.radius * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Main particle
        ctx.beginPath();
        ctx.arc(particle.x, drawY, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particle.color}, ${particle.opacity})`;
        ctx.fill();
      });

      // Draw connections (only between nearby same-layer particles for performance)
      const maxDist = 120;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          // Skip if different layers (for performance)
          if (Math.abs(particles[i].layer - particles[j].layer) > 1) continue;

          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDist * maxDist) {
            const dist = Math.sqrt(distSq);
            const opacity = (1 - dist / maxDist) * 0.12;

            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);

            // Gradient line (amber to gold)
            const gradient = ctx.createLinearGradient(
              particles[i].x,
              particles[i].y,
              particles[j].x,
              particles[j].y
            );
            gradient.addColorStop(0, `rgba(212, 165, 116, ${opacity})`);
            gradient.addColorStop(1, `rgba(201, 148, 58, ${opacity})`);

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw mouse interaction circle (subtle)
      if (mouse.x > 0 && mouse.y > 0) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 150, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212, 165, 116, 0.03)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    // Mouse leave handler
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    // Initialize
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    resize();
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        opacity: 0.7,
        pointerEvents: 'none',
      }}
    />
  );
}
