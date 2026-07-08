import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
};

const PARTICLE_COUNT = 140;
const LINK_DIST = 150;
const ATTRACT_DIST = 200;
const SLING_DIST = 120;
const SLING_THRESHOLD = 12;

export function ParticleConstellation() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.max(1, window.devicePixelRatio || 1);
    const particles: Particle[] = [];

    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const vx = rand(-0.15, 0.15);
        const vy = rand(-0.15, 0.15);
        particles.push({
          x: rand(0, width),
          y: rand(0, height),
          vx,
          vy,
          baseVx: vx,
          baseVy: vy,
        });
      }
    };

    resize();
    init();

    const mouse = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, lastMove: 0, active: false };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = e.clientX - rect.left;
      const ny = e.clientY - rect.top;
      if (mouse.active) {
        mouse.vx = nx - mouse.x;
        mouse.vy = ny - mouse.y;
      } else {
        mouse.vx = 0;
        mouse.vy = 0;
      }
      mouse.x = nx;
      mouse.y = ny;
      mouse.lastMove = performance.now();
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
      mouse.vx = 0;
      mouse.vy = 0;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    window.addEventListener("resize", resize);

    let raf = 0;

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      const now = performance.now();
      const mouseIdle = now - mouse.lastMove > 120;
      const mouseSpeed = Math.hypot(mouse.vx, mouse.vy);
      const slinging = mouse.active && mouseSpeed > SLING_THRESHOLD;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d2 = dx * dx + dy * dy;
          const d = Math.sqrt(d2) || 0.0001;

          // Slingshot: strong directional impulse when cursor flicks past nearby particles
          if (slinging && d < SLING_DIST) {
            const k = 0.06 * (1 - d / SLING_DIST);
            p.vx += mouse.vx * k;
            p.vy += mouse.vy * k;
          }

          // Constant gravity toward cursor — inverse-distance falloff with a softening
          // radius so particles don't fly to infinity at the cursor itself.
          const softened = d2 + 400; // 20px softening
          const g = 900 / softened; // tune: feels like real attraction across the whole canvas
          p.vx += (dx / d) * g * 0.02;
          p.vy += (dy / d) * g * 0.02;
        }



        if (mouseIdle) {
          // gentle drag back toward natural drift, not a hard snap
          p.vx += (p.baseVx - p.vx) * 0.004;
          p.vy += (p.baseVy - p.vy) * 0.004;
        }

        // light air resistance — keeps motion lively but bleeds slingshot energy
        p.vx *= 0.995;
        p.vy *= 0.995;

        p.x += p.vx;
        p.y += p.vy;

        // wrap around edges (toroidal world) — exit one side, enter the other
        if (p.x < -2) p.x = width + 2;
        else if (p.x > width + 2) p.x = -2;
        if (p.y < -2) p.y = height + 2;
        else if (p.y > height + 2) p.y = -2;
      }

      // reset accumulated mouse velocity so slingshot is a single impulse per movement frame
      mouse.vx *= 0.7;
      mouse.vy *= 0.7;

      // lines
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const d = Math.sqrt(d2);
            const alpha = 0.2 * (1 - d / LINK_DIST);
            ctx.strokeStyle = `rgba(200, 220, 255, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // particles
      ctx.shadowColor = "rgba(180, 210, 255, 0.8)";
      ctx.shadowBlur = 6;
      ctx.fillStyle = "rgba(230, 240, 255, 0.6)";
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
