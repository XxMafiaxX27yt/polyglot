import { useEffect, useRef } from 'react';

// Slow-moving grey marble with orange veins, drawn by a small WebGL shader
// (domain-warped noise, lightly posterised).

const VERTEX = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `
precision highp float;
uniform vec2 res;
uniform float time;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / min(res.x, res.y) * 2.4;
  float t = time * 0.05;
  vec2 q = vec2(fbm(uv + t), fbm(uv + vec2(5.2, 1.3) - t));
  vec2 w = vec2(fbm(uv + 4.0 * q + vec2(1.7, 9.2) + t * 1.5), fbm(uv + 4.0 * q + vec2(8.3, 2.8) - t));
  float f = fbm(uv + 4.0 * w);

  float banded = floor(f * 10.0) / 10.0;
  float g = mix(f, banded, 0.8);
  vec3 col = vec3(0.05 + g * 0.72);

  float vein = smoothstep(0.66, 0.84, length(w)) * smoothstep(0.36, 0.54, q.x);
  vec3 orange = mix(vec3(0.75, 0.25, 0.0), vec3(1.0, 0.58, 0.2), g);
  col = mix(col, orange, vein);

  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

export default function FluidCanvas({ className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl', { antialias: false });
    if (!gl) return; // CSS fallback background shows instead

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'res');
    const uTime = gl.getUniformLocation(program, 'time');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (still) draw(0);
    };

    function draw(ms) {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, 20 + ms / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!still) frame = requestAnimationFrame(draw);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!still) frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={`fluid ${className}`} aria-hidden="true" />;
}
