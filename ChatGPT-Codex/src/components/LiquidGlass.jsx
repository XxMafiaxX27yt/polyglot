import { useEffect, useRef } from 'react';

// Glass panel that reacts like water: pressing or dragging on it sends out
// ripple rings and briefly wobbles the panel through an SVG displacement filter.
export default function LiquidGlass({ className = '', children }) {
  const panelRef = useRef(null);
  const canvasRef = useRef(null);
  const displacementRef = useRef(null);

  useEffect(() => {
    const panel = panelRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ripples = [];
    let intensity = 0;
    let target = 0;
    let frame;

    const resize = () => {
      canvas.width = panel.clientWidth;
      canvas.height = panel.clientHeight;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(panel);

    function loop() {
      intensity += (target - intensity) * 0.12;
      target *= 0.94;
      if (target < 0.05) target = 0;

      // Only filter while wobbling, so text and video stay crisp at rest.
      if (intensity > 0.1) {
        displacementRef.current.setAttribute('scale', intensity.toFixed(2));
        panel.style.filter = 'url(#liquidWaterFilter)';
      } else {
        panel.style.filter = 'none';
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += 3.5;
        r.opacity *= 0.96;

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${r.opacity.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (r.radius > 15) {
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius * 0.65, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,148,51,${(r.opacity * 0.6).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (r.opacity < 0.005 || r.radius > r.maxRadius) ripples.splice(i, 1);
      }
      frame = requestAnimationFrame(loop);
    }
    loop();

    function splash(e, strong) {
      const rect = panel.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      target = strong ? 20 : 12;
      ripples.push({
        x: point.clientX - rect.left,
        y: point.clientY - rect.top,
        radius: 4,
        maxRadius: Math.max(canvas.width, canvas.height) * 0.85,
        opacity: strong ? 0.6 : 0.35,
      });
    }
    const onDown = (e) => splash(e, true);
    const onMove = (e) => {
      if ('buttons' in e && e.buttons !== 1) return;
      if (Math.random() > 0.4) splash(e, false);
    };

    panel.addEventListener('mousedown', onDown);
    panel.addEventListener('mousemove', onMove);
    panel.addEventListener('touchstart', onDown, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      panel.removeEventListener('mousedown', onDown);
      panel.removeEventListener('mousemove', onMove);
      panel.removeEventListener('touchstart', onDown);
      panel.removeEventListener('touchmove', onMove);
    };
  }, []);

  return (
    <div ref={panelRef} className={`liquid-glass ${className}`}>
      <svg className="liquid-defs" aria-hidden="true">
        <defs>
          <filter id="liquidWaterFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.022" numOctaves="2" result="noise" />
            <feDisplacementMap
              ref={displacementRef}
              in="SourceGraphic"
              in2="noise"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <canvas ref={canvasRef} className="liquid-ripples" aria-hidden="true" />
      <div className="liquid-content">{children}</div>
    </div>
  );
}
