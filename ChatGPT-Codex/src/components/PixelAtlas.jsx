// Pixel Atlas — a pixelated world map where each supported language glows in
// orange around its example cities. The selected language burns hottest.

import { useEffect, useMemo, useRef } from 'react';
import { feature } from 'topojson-client';
import landTopo from 'world-atlas/land-110m.json';
import { LANGUAGES } from '../data/languages.js';
import { LANGUAGE_PLACES } from '../data/languagePlaces.js';

const LAT_TOP = 80;
const LAT_BOTTOM = -56;
const LAT_SPAN = LAT_TOP - LAT_BOTTOM;
const LAND = 'rgba(255,255,255,0.13)';
// Heat, coolest to hottest.
const PALETTE = ['#4a1f00', '#7a3200', '#b84a00', '#ff6b00', '#ff9433', '#ffd9a8'];
const SIGMA = 4.5; // glow radius in degrees

const xOf = (lon) => (lon + 180) / 360;
const yOf = (lat) => (LAT_TOP - lat) / LAT_SPAN;

/** Rasterise the land outline into a grid of cells, `res` degrees each. */
function buildLand(res) {
  const cols = Math.round(360 / res);
  const rows = Math.round(LAT_SPAN / res);
  const S = 4; // supersample so coastlines sample cleanly
  const canvas = document.createElement('canvas');
  canvas.width = cols * S;
  canvas.height = rows * S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const geo = feature(landTopo, landTopo.objects.land);
  const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
  ctx.beginPath();
  for (const f of features) {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of polygons) {
      for (const ring of polygon) {
        ring.forEach(([lon, lat], i) => {
          const x = xOf(lon) * canvas.width;
          const y = yOf(lat) * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
    }
  }
  ctx.fill('evenodd');

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = c * S + S / 2;
      const py = r * S + S / 2;
      if (data[(py * canvas.width + px) * 4 + 3] > 127) {
        cells.push({ c, r, lon: -180 + (c + 0.5) * res, lat: LAT_TOP - (r + 0.5) * res });
      }
    }
  }
  return { cols, rows, cells };
}

/** Per-language glow for every land cell, plus a combined base layer. */
function buildHeat(cells) {
  const perLang = LANGUAGES.map((lang) => {
    const heat = new Float32Array(cells.length);
    const places = LANGUAGE_PLACES[lang.code] ?? [];
    cells.forEach((cell, i) => {
      let best = 0;
      for (const p of places) {
        let dx = Math.abs(cell.lon - p.lon);
        if (dx > 180) dx = 360 - dx;
        const dy = cell.lat - p.lat;
        best = Math.max(best, Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA)));
      }
      heat[i] = best;
    });
    return heat;
  });

  const base = new Float32Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    let sum = 0;
    for (const heat of perLang) sum += heat[i];
    base[i] = Math.min(1, sum * 0.6);
  }
  return { perLang, base };
}

export default function PixelAtlas({ selected, onSelect, onHoverChange, resolution = 2.2 }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const land = useMemo(() => buildLand(resolution), [resolution]);
  const heat = useMemo(() => buildHeat(land.cells), [land]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { cols, rows, cells } = land;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const current = new Float32Array(cells.length);
    const phase = Float32Array.from(cells, () => Math.random() * Math.PI * 2);
    let width = 0;
    let height = 0;
    let cell = 0;
    let frame;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = wrap.clientWidth;
      cell = width / cols;
      height = rows * cell;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    function draw(ms) {
      const t = ms / 1000;
      const index = LANGUAGES.findIndex((l) => l.code === selectedRef.current);
      const hot = index >= 0 ? heat.perLang[index] : null;
      const size = cell * 0.76;
      const inset = (cell - size) / 2;

      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < cells.length; i++) {
        const target = heat.base[i] * 0.4 + (hot ? hot[i] : 0);
        current[i] += (target - current[i]) * 0.14;
        let v = current[i];
        if (!still) v *= 0.88 + 0.12 * Math.sin(t * 2.4 + phase[i]);
        ctx.fillStyle = v < 0.07 ? LAND : PALETTE[Math.min(5, (v * 6.5) | 0)];
        ctx.fillRect(cells[i].c * cell + inset, cells[i].r * cell + inset, size, size);
      }

      // Pulsing square rings on the selected language's cities.
      if (index >= 0) {
        for (const p of LANGUAGE_PLACES[LANGUAGES[index].code] ?? []) {
          const x = xOf(p.lon) * width;
          const y = yOf(p.lat) * height;
          const pulse = still ? 0.35 : (t * 0.7) % 1;
          const s = cell * (1.6 + pulse * 6);
          ctx.strokeStyle = `rgba(255,217,168,${(1 - pulse).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x - s / 2, y - s / 2, s, s);
          ctx.fillStyle = '#fff';
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [land, heat]);

  function handleMove(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const lon = ((e.clientX - rect.left) / rect.width) * 360 - 180;
    const lat = LAT_TOP - ((e.clientY - rect.top) / rect.height) * LAT_SPAN;
    let best = null;
    let bestDist = 8; // degrees
    for (const lang of LANGUAGES) {
      for (const p of LANGUAGE_PLACES[lang.code] ?? []) {
        const d = Math.hypot(p.lon - lon, p.lat - lat);
        if (d < bestDist) {
          bestDist = d;
          best = lang.code;
        }
      }
    }
    if (best && best !== selectedRef.current) onSelect(best);
  }

  const lang = LANGUAGES.find((l) => l.code === selected);
  const places = lang ? LANGUAGE_PLACES[lang.code] ?? [] : [];

  return (
    <div
      ref={wrapRef}
      className="atlas"
      onPointerMove={handleMove}
      onPointerEnter={() => onHoverChange?.(true)}
      onPointerLeave={() => onHoverChange?.(false)}
    >
      <canvas ref={canvasRef} role="img" aria-label="World map highlighting the 20 languages Polyglot supports" />
      {lang &&
        places.map((p, i) => {
          const left = xOf(p.lon) * 100;
          return (
            <div
              key={`${lang.code}-${p.city}`}
              className={`atlas-label${left > 72 ? ' flip' : ''}${i > 0 ? ' minor' : ''}`}
              style={{ left: `${left}%`, top: `${yOf(p.lat) * 100}%` }}
            >
              {i === 0 && <b lang={lang.code}>{lang.native}</b>}
              <span>{p.city}</span>
            </div>
          );
        })}
    </div>
  );
}
