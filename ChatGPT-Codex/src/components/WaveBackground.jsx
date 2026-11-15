import { useEffect, useRef } from 'react';

// Slow ambient waves behind the whole app: two grayscale, one orange accent.
const WAVES = [
  { y: 0.72, length: 0.0022, amp: 45, speed: 0.015, fill: 'rgba(255,255,255,0.03)', stroke: 'rgba(255,255,255,0.08)' },
  { y: 0.8, length: 0.0035, amp: 35, speed: 0.022, fill: 'rgba(255,255,255,0.045)', stroke: 'rgba(255,255,255,0.12)' },
  { y: 0.88, length: 0.0018, amp: 55, speed: 0.01, fill: 'rgba(255,107,0,0.07)', stroke: 'rgba(255,107,0,0.45)' },
];

export default function WaveBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame;
    let step = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (still) draw();
    };

    function draw() {
      const { width, height } = canvas;
      const midnight = document.documentElement.dataset.theme === 'midnight';
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, midnight ? '#171923' : '#080808');
      bg.addColorStop(0.5, midnight ? '#1b1e2b' : '#0e0e0e');
      bg.addColorStop(1, midnight ? '#11131b' : '#040404');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      for (const w of WAVES) {
        const baseline = height * w.y;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width + 6; x += 6) {
          ctx.lineTo(
            x,
            baseline + Math.sin(x * w.length + step * w.speed) * w.amp + Math.cos(x * 0.001 + step * 0.008) * w.amp * 0.4
          );
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = w.fill;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = w.stroke;
        ctx.stroke();
      }
    }

    function loop() {
      draw();
      // Settings → Appearance → Animated background
      if (document.documentElement.dataset.motion !== 'off') step += 1;
      frame = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', resize);
    if (!still) loop();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="wave-bg" aria-hidden="true" />;
}
