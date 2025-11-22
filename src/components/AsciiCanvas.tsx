import { useEffect, useRef, useState } from 'react';
import { SECTION_CHANGE_EVENT } from './SectionObserver';

type Ripple = {
  x: number;
  y: number;
  start: number;
  duration: number;
  speed: number;
  strength: number;
};

const STAR_CHARS = ' .:*%@';
const GRID_CHARS = '    .,:;ox%#@';
const CELL_SIZE = 18;
const MAX_RIPPLES = 6;
const STAR_DENSITY = 0.012;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const SECTION_TINT: Record<string, string> = {
  about: '186, 200, 222',
  tech: '168, 206, 255',
  events: '244, 196, 178'
};

const AsciiCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const starMaskRef = useRef<Uint8Array>(new Uint8Array(0));
  const gridMetaRef = useRef<{ cols: number; rows: number; cell: number }>({
    cols: 0,
    rows: 0,
    cell: CELL_SIZE
  });
  const [activeSection, setActiveSection] = useState<string>('about');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const regenerateStars = (cols: number, rows: number) => {
      const total = cols * rows;
      const starCount = Math.max(80, Math.floor(total * STAR_DENSITY));
      const mask = new Uint8Array(total);

      for (let i = 0; i < starCount; i += 1) {
        const idx = Math.floor(Math.random() * total);
        mask[idx] = 1;
      }

      starMaskRef.current = mask;
    };

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${Math.max(13, CELL_SIZE - 4)}px "VT323", "JetBrains Mono", monospace`;
      ctx.textBaseline = 'top';

      const cols = Math.ceil(width / CELL_SIZE);
      const rows = Math.ceil(height / CELL_SIZE);
      gridMetaRef.current = { cols, rows, cell: CELL_SIZE };
      regenerateStars(cols, rows);
    };

    const renderFrame = (timestamp: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const { cols, rows, cell } = gridMetaRef.current;
      const time = timestamp * 0.001;
      const ripples = ripplesRef.current;

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#01020b');
      gradient.addColorStop(0.6, '#020414');
      gradient.addColorStop(1, '#010208');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const tint = SECTION_TINT[activeSection] ?? SECTION_TINT.about;
      ctx.font = `${Math.max(13, CELL_SIZE - 4)}px "VT323", "JetBrains Mono", monospace`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      for (let row = 0; row < rows; row += 1) {
        const py = row * cell;
        const ny = py / height - 0.5;

        for (let col = 0; col < cols; col += 1) {
          const px = col * cell;
          const nx = px / width - 0.5;
          const idx = row * cols + col;
          const baseNoise =
            (Math.sin(row * 6.1 + col * 4.6 + time * 0.45) +
              Math.cos(row * 2.8 - col * 3.9 + time * 0.35) +
              2) *
            0.08;
          const isStar = starMaskRef.current[idx] === 1;

          let value =
            Math.sin((nx + time * 0.08) * 1.9) +
            Math.cos((ny - time * 0.07) * 2.4) * 0.55 +
            Math.sin((nx + ny + time * 0.04) * 2.6) * 0.25 +
            (baseNoise - 0.5) * 0.45;

          if (isStar) {
            value += Math.sin(time * 1.2 + nx * 9 + ny * 8) * 0.9;
          }

          for (let r = ripples.length - 1; r >= 0; r -= 1) {
            const ripple = ripples[r];
            const age = (timestamp - ripple.start) / 1000;
            const dx = px + cell * 0.5 - ripple.x;
            const dy = py + cell * 0.5 - ripple.y;
            const dist = Math.hypot(dx, dy);

            const wave = Math.sin(dist * 0.015 - age * ripple.speed * 0.6);
            const attenuation =
              Math.max(0, 1 - age / ripple.duration) * Math.exp(-dist * 0.001);
            value += wave * attenuation * ripple.strength * 0.2;
          }

          const normalized = clamp((Math.sin(value) + 1) * 0.5, 0, 1);
          const sourceChars = isStar ? STAR_CHARS : GRID_CHARS;
          let charIndex = Math.round(normalized * (sourceChars.length - 1));
          const minIndex = isStar ? Math.max(sourceChars.length - 3, 2) : 0;
          if (charIndex < minIndex) {
            charIndex = minIndex;
          }
          if (charIndex > sourceChars.length - 1) {
            charIndex = sourceChars.length - 1;
          }

          const char = sourceChars[charIndex]!;
          const fgBase = isStar ? 0.58 : 0.18;
          const fgScale = isStar ? 0.32 : 0.35;
          const fg = clamp(fgBase + normalized * fgScale, isStar ? 0.6 : 0.18, 0.85);

          const colorTint = isStar
            ? '220, 233, 255'
            : activeSection === 'tech'
            ? '172, 196, 232'
            : activeSection === 'events'
            ? '236, 206, 182'
            : '184, 198, 224';
          ctx.fillStyle = `rgba(${colorTint}, ${fg.toFixed(3)})`;
          ctx.fillText(char, px, py);
        }
      }

      animationRef.current = requestAnimationFrame(renderFrame);
    };

    const pushRipple = (originX: number, originY: number, strength = 1.4) => {
      ripplesRef.current.push({
        x: originX,
        y: originY,
        start: performance.now(),
        duration: 2.6,
        speed: 7.1,
        strength
      });

      if (ripplesRef.current.length > MAX_RIPPLES) {
        ripplesRef.current.shift();
      }
    };

    const handleSectionChange = (event: Event) => {
      const custom = event as CustomEvent<{ id: string; side: 'left' | 'right' }>;
      const id = custom.detail?.id;
      if (!id) return;

      setActiveSection(id);

      const contentSide = custom.detail?.side ?? 'left';
      const iconSide = contentSide === 'left' ? 'right' : 'left';

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const originX = iconSide === 'left' ? width * 0.18 : width * 0.82;
      pushRipple(originX, height * 0.45, 0.65);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener(
      SECTION_CHANGE_EVENT,
      handleSectionChange as EventListener
    );

    handleResize();
    animationRef.current = requestAnimationFrame(renderFrame);

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    pushRipple(width * 0.18, height * 0.45, 0.4);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener(
        SECTION_CHANGE_EVENT,
        handleSectionChange as EventListener
      );
    };
  }, []);

  return (
    <div className={`ascii-crt ascii-crt--${activeSection}`}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="ascii-crt__scanlines" aria-hidden="true" />
      <div className="ascii-crt__glow" aria-hidden="true" />
    </div>
  );
};

export default AsciiCanvas;

