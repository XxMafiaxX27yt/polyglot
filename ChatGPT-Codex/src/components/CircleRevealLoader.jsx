// Circle Reveal Loader — adapted from Goodmotion (https://goodmotion.vercel.app/)
// Three colour layers sweep down from the top centre, then a circular hole
// opens to reveal the page underneath.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const circle = (r) => `circle(${r}px at 50% 0px)`;

export default function CircleRevealLoader({
  color1 = '#ff9433',
  color2 = '#ff6b00',
  color3 = '#000000',
  duration = 0.85,
  staggerOverlap = 0.58,
  ease = 'power3.inOut',
  children,
}) {
  const [isComplete, setIsComplete] = useState(false);
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const layer1Ref = useRef(null);
  const layer2Ref = useRef(null);
  const layer3Ref = useRef(null);

  useEffect(() => setMounted(true), []);

  useGSAP(
    () => {
      const panel = panelRef.current;
      const l1 = layer1Ref.current;
      const l2 = layer2Ref.current;
      const l3 = layer3Ref.current;
      if (!mounted || !panel || !l1 || !l2 || !l3) return;

      const maxRadius = Math.ceil(Math.hypot(window.innerWidth, window.innerHeight)) * 1.2;
      const setMask = (r) => {
        const mask = `radial-gradient(circle at 50% 0px, transparent ${r}px, #000 ${r + 1}px)`;
        panel.style.maskImage = mask;
        panel.style.webkitMaskImage = mask;
      };

      gsap.set(l1, { clipPath: circle(maxRadius), WebkitClipPath: circle(maxRadius) });
      gsap.set([l2, l3], { clipPath: circle(0), WebkitClipPath: circle(0) });
      setMask(0);

      const tl = gsap.timeline({ onComplete: () => setIsComplete(true) });
      const grow = { clipPath: circle(maxRadius), WebkitClipPath: circle(maxRadius), duration, ease };
      tl.to(l2, grow, 0.05);
      tl.to(l3, grow, `-=${staggerOverlap}`);

      const hole = { value: 0 };
      tl.to(
        hole,
        { value: maxRadius, duration, ease, onUpdate: () => setMask(hole.value) },
        `-=${staggerOverlap}`
      );
    },
    { scope: containerRef, dependencies: [mounted, duration, staggerOverlap, ease] }
  );

  if (isComplete || !mounted) return null;

  const layer = { position: 'absolute', inset: 0, willChange: 'clip-path' };

  return createPortal(
    <div ref={containerRef} className="loader" aria-hidden="true">
      <div ref={panelRef} className="loader-panel">
        <div ref={layer1Ref} style={{ ...layer, backgroundColor: color1 }} />
        <div ref={layer2Ref} style={{ ...layer, backgroundColor: color2, clipPath: circle(0) }} />
        <div ref={layer3Ref} style={{ ...layer, backgroundColor: color3, clipPath: circle(0) }} />
      </div>
      {children}
    </div>,
    document.body
  );
}
