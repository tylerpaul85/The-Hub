import React, { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getClosedTransactionCount } from "@/lib/transaction-stats.functions";

interface KeySprite {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  cx: number;
  cy: number;
  scale: number;
  length: number;
}

interface SimKey {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  va: number;
  spriteIdx: number;
  scale: number;
  length: number;
  r1: number; // Bow / Head collision radius
  r2: number; // Blade / Tip collision radius
  halfD: number; // Distance from center of mass to collision circles
  sleepFrames: number;
  isAsleep: boolean;
}

interface SettledRecord {
  x: number;
  y: number;
  angle: number;
  spriteIdx: number;
}

// Spatial hash grid for high-speed localized collision checking
class SpatialHash {
  private cellSize: number;
  private cells: Map<number, SimKey[]>;

  constructor(cellSize = 32) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  private hash(cx: number, cy: number): number {
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }

  insert(key: SimKey) {
    const cx = Math.floor(key.x / this.cellSize);
    const cy = Math.floor(key.y / this.cellSize);
    const h = this.hash(cx, cy);
    let cell = this.cells.get(h);
    if (!cell) {
      cell = [];
      this.cells.set(h, cell);
    }
    cell.push(key);
  }

  query(x: number, y: number, radius = 32): SimKey[] {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);

    const out: SimKey[] = [];
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cell = this.cells.get(this.hash(cx, cy));
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            out.push(cell[i]);
          }
        }
      }
    }
    return out;
  }
}

/**
 * Pre-renders realistic brass house key silhouette sprites onto small offscreen canvases.
 * Authentic details:
 * - Oval/chamfered brass bow with keyring hole and inner bevel
 * - Defined collar/stop shoulders where blade meets bow
 * - Real pin-tumbler bitting cuts (peaks & valleys) along the blade edge
 * - Beveled 45° guide tip
 * - Longitudinal warding groove
 * - Rich metallic brass/gold gradient lighting (#FCE496 highlight, #C9A24B base, #7A5314 shadow)
 */
function createRealisticKeySprites(dpr = 1): KeySprite[] {
  const sprites: KeySprite[] = [];

  const palettes = [
    {
      highlight: "#FCE496",
      base: "#C9A24B",
      mid: "#AF8632",
      shadow: "#735012",
      groove: "#5A3C0A",
    },
    {
      highlight: "#FFF0B3",
      base: "#D4AF37",
      mid: "#B8912A",
      shadow: "#7A5816",
      groove: "#60420E",
    },
    {
      highlight: "#F7DA88",
      base: "#C0973E",
      mid: "#A67D2B",
      shadow: "#6E490F",
      groove: "#523408",
    },
    {
      highlight: "#FEE28F",
      base: "#CCA146",
      mid: "#B38734",
      shadow: "#785315",
      groove: "#5C3E0C",
    },
  ];

  // Variations in bitting (key teeth cuts)
  const bittings = [
    [1.0, 2.5, 1.4, 2.2],
    [2.2, 1.2, 2.6, 1.5],
    [1.4, 2.2, 1.8, 2.7],
    [2.0, 1.6, 2.4, 1.2],
  ];

  const scales = [0.85, 0.95, 1.05, 1.15]; // Natural size variance

  for (let sIdx = 0; sIdx < scales.length; sIdx++) {
    const scale = scales[sIdx];

    for (let pIdx = 0; pIdx < palettes.length; pIdx++) {
      const pal = palettes[pIdx];
      const cuts = bittings[(sIdx + pIdx) % bittings.length];

      const bowRadius = 6.2 * scale;
      const holeRadius = 2.4 * scale;
      const bladeLength = 16.0 * scale;
      const bladeHalfWidth = 2.0 * scale;
      const shoulderWidth = 3.6 * scale;
      const totalLen = bowRadius * 2 + bladeLength;

      const pad = 4;
      const w = Math.ceil((totalLen + pad * 2) * dpr);
      const h = Math.ceil((bowRadius * 2 + 10 * scale + pad * 2) * dpr);

      const offCanvas = document.createElement("canvas");
      offCanvas.width = w;
      offCanvas.height = h;
      const ctx = offCanvas.getContext("2d");
      if (!ctx) continue;

      ctx.scale(dpr, dpr);
      ctx.translate(pad + bowRadius, pad + bowRadius + 2 * scale);

      // --- 1. Main Key Silhouette Path ---
      ctx.beginPath();

      // Bow (rounded head with subtle chamfers)
      ctx.arc(0, 0, bowRadius, Math.PI * 0.28, Math.PI * 1.72, false);

      // Top shoulder step
      ctx.lineTo(bowRadius * 0.9, -shoulderWidth);
      ctx.lineTo(bowRadius + 1.2 * scale, -shoulderWidth);
      ctx.lineTo(bowRadius + 1.8 * scale, -bladeHalfWidth);

      // Top blade straight edge
      const tipX = bowRadius + bladeLength;
      ctx.lineTo(tipX - 1.2 * scale, -bladeHalfWidth);

      // Beveled guide tip
      ctx.lineTo(tipX, -bladeHalfWidth * 0.4);
      ctx.lineTo(tipX, bladeHalfWidth * 0.4);
      ctx.lineTo(tipX - 1.2 * scale, bladeHalfWidth);

      // Bottom blade edge with realistic bitting (teeth cuts)
      let curX = tipX - 2.0 * scale;
      for (let c = cuts.length - 1; c >= 0; c--) {
        const cutDepth = cuts[c] * scale;
        const toothW = 2.2 * scale;

        // Angled entry
        ctx.lineTo(curX, bladeHalfWidth);
        ctx.lineTo(curX - 0.7 * scale, bladeHalfWidth + cutDepth);
        // Flat valley
        ctx.lineTo(curX - toothW + 0.7 * scale, bladeHalfWidth + cutDepth);
        // Angled exit
        ctx.lineTo(curX - toothW, bladeHalfWidth);

        curX -= toothW + 1.0 * scale;
      }

      // Bottom shoulder step
      ctx.lineTo(bowRadius + 1.8 * scale, bladeHalfWidth);
      ctx.lineTo(bowRadius + 1.2 * scale, shoulderWidth);
      ctx.lineTo(bowRadius * 0.9, shoulderWidth);

      ctx.closePath();

      // Subtract keyring hole in center of bow
      ctx.moveTo(holeRadius, 0);
      ctx.arc(0, 0, holeRadius, 0, Math.PI * 2, true);

      // --- 2. Metallic Brass Gradient Fill ---
      const grad = ctx.createLinearGradient(0, -bowRadius, 0, bowRadius + 4 * scale);
      grad.addColorStop(0, pal.highlight);
      grad.addColorStop(0.35, pal.base);
      grad.addColorStop(0.75, pal.mid);
      grad.addColorStop(1, pal.shadow);

      ctx.fillStyle = grad;
      ctx.fill();

      // --- 3. Warding Groove (longitudinal milled slot) ---
      ctx.beginPath();
      const grooveY = 0;
      ctx.moveTo(bowRadius + 2.5 * scale, grooveY);
      ctx.lineTo(tipX - 2.5 * scale, grooveY);
      ctx.lineWidth = 0.9 * scale;
      ctx.strokeStyle = pal.groove;
      ctx.stroke();

      // Groove highlight line
      ctx.beginPath();
      ctx.moveTo(bowRadius + 2.5 * scale, grooveY - 0.7 * scale);
      ctx.lineTo(tipX - 2.5 * scale, grooveY - 0.7 * scale);
      ctx.lineWidth = 0.5 * scale;
      ctx.strokeStyle = pal.highlight;
      ctx.stroke();

      // --- 4. Outer Rim Highlight Stroke ---
      ctx.lineWidth = 0.7 * scale;
      ctx.strokeStyle = pal.highlight;
      ctx.stroke();

      // --- 5. Hole Bevel Rim ---
      ctx.beginPath();
      ctx.arc(0, 0, holeRadius + 0.4 * scale, 0, Math.PI * 2);
      ctx.lineWidth = 0.5 * scale;
      ctx.strokeStyle = pal.shadow;
      ctx.stroke();

      sprites.push({
        canvas: offCanvas,
        width: w / dpr,
        height: h / dpr,
        cx: bowRadius + pad,
        cy: bowRadius + 2 * scale + pad,
        scale,
        length: totalLen,
      });
    }
  }

  return sprites;
}

export function KeyWallBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fetchCount = useServerFn(getClosedTransactionCount);
  const [closedCount, setClosedCount] = useState<number>(4092);

  // Fetch live closed transaction count
  useEffect(() => {
    let active = true;
    fetchCount()
      .then((res) => {
        if (active && res && typeof res.count === "number" && res.count > 0) {
          setClosedCount(res.count);
        }
      })
      .catch(() => {
        // Fallback milestone count preserved
      });
    return () => {
      active = false;
    };
  }, [fetchCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number | null = null;
    let isDisposed = false;

    // Respect prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Initialize after first paint
    const initTimer = setTimeout(() => {
      if (isDisposed) return;
      startSimulation();
    }, 60);

    function startSimulation() {
      if (!canvas || isDisposed) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Static offscreen canvas layer to permanently bake settled keys
      const staticCanvas = document.createElement("canvas");
      staticCanvas.width = canvas.width;
      staticCanvas.height = canvas.height;
      const staticCtx = staticCanvas.getContext("2d");
      if (!staticCtx) return;

      // Device capacity scaling:
      // Mobile / low cores: ~600-800
      // Tablet: ~1,500
      // Desktop: full transaction count (~4,000)
      const concurrency = navigator.hardwareConcurrency || 4;
      let targetCount = closedCount;
      if (width < 640 || concurrency <= 2) {
        targetCount = Math.min(650, closedCount);
      } else if (width < 1024 || concurrency <= 4) {
        targetCount = Math.min(1600, closedCount);
      } else {
        targetCount = Math.min(4200, closedCount);
      }

      // Width-bucketed cache key (v2 for updated realistic physics & visuals)
      const widthBucket = Math.round(width / 120) * 120;
      const cacheKey = `msreg_keypile_v2_${widthBucket}_${targetCount}`;

      const sprites = createRealisticKeySprites(dpr);
      if (sprites.length === 0) return;

      // Check localStorage for previously simulated resting layout
      let cachedSettled: SettledRecord[] | null = null;
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 50) {
            cachedSettled = parsed;
          }
        }
      } catch {}

      // Fast key renderer onto any 2D canvas context
      const drawKey = (
        targetContext: CanvasRenderingContext2D,
        x: number,
        y: number,
        angle: number,
        spriteIdx: number
      ) => {
        const sprite = sprites[spriteIdx % sprites.length];
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        targetContext.setTransform(
          cos * dpr,
          sin * dpr,
          -sin * dpr,
          cos * dpr,
          x * dpr,
          y * dpr
        );
        targetContext.drawImage(sprite.canvas, -sprite.cx * dpr, -sprite.cy * dpr);
      };

      // If cached OR reduced-motion: render immediately with zero animation loop
      if (cachedSettled || prefersReducedMotion) {
        let keysToDraw: SettledRecord[] = cachedSettled || [];

        if (!cachedSettled && prefersReducedMotion) {
          keysToDraw = [];
          const floorY = height - 12;
          for (let i = 0; i < targetCount; i++) {
            const x = 20 + Math.random() * (width - 40);
            const normX = (x / width) * 2 - 1;
            const pileHeight = Math.max(8, (1 - normX * normX * 0.65) * 80 * (i / targetCount));
            const y = floorY - Math.random() * pileHeight;
            const angle = (Math.random() - 0.5) * Math.PI * 0.4;
            const spriteIdx = Math.floor(Math.random() * sprites.length);
            keysToDraw.push({ x, y, angle, spriteIdx });
          }
          try {
            localStorage.setItem(cacheKey, JSON.stringify(keysToDraw));
          } catch {}
        }

        // Bake all keys once onto staticCanvas
        for (let i = 0; i < keysToDraw.length; i++) {
          const k = keysToDraw[i];
          drawKey(staticCtx, k.x, k.y, k.angle, k.spriteIdx);
        }

        // Composite onto main canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(staticCanvas, 0, 0);
        return; // Complete! Zero ongoing CPU.
      }

      // --- Live Staged Physics Simulation ---
      const activeKeys: SimKey[] = [];
      const settledRecords: SettledRecord[] = [];
      const activeGrid = new SpatialHash(32);
      const staticGrid = new SpatialHash(32);

      let spawnedTotal = 0;
      const floorY = height - 12;

      // Staged spawn rate: smooth cascade over ~5-7 seconds
      const spawnRate = Math.max(12, Math.min(26, Math.ceil(targetCount / 220)));

      const spawnBatch = () => {
        const toSpawn = Math.min(spawnRate, targetCount - spawnedTotal);
        for (let i = 0; i < toSpawn; i++) {
          const spriteIdx = Math.floor(Math.random() * sprites.length);
          const sprite = sprites[spriteIdx];

          const scale = sprite.scale;
          const r1 = 6.0 * scale; // Bow radius
          const r2 = 3.6 * scale; // Blade tip radius
          const halfD = 7.2 * scale; // Half length to collision circles

          activeKeys.push({
            x: 20 + Math.random() * (width - 40),
            y: -25 - Math.random() * 50,
            vx: (Math.random() - 0.5) * 0.5,
            vy: 0.8 + Math.random() * 1.8, // Slow ambient falling speed
            angle: Math.random() * Math.PI * 2,
            va: (Math.random() - 0.5) * 0.03, // Gentle tumble
            spriteIdx,
            scale,
            length: sprite.length,
            r1,
            r2,
            halfD,
            sleepFrames: 0,
            isAsleep: false,
          });
          spawnedTotal++;
        }
      };

      // Physics parameters tuned for realistic metal clatter & natural stacking:
      // Minimal bounce (restitution ~0.08), high surface grip (friction ~0.92)
      const gravity = 0.18; // Slow ambient gravity
      const restitution = 0.08; // Almost zero bounce as requested
      const friction = 0.92; // Surface friction to prevent endless skidding
      const pileRegionY = height - 180;

      let isVisible = document.visibilityState !== "hidden";
      const handleVisibility = () => {
        isVisible = document.visibilityState !== "hidden";
      };
      document.addEventListener("visibilitychange", handleVisibility);

      const tick = () => {
        if (isDisposed) return;

        if (!isVisible) {
          animId = requestAnimationFrame(tick);
          return;
        }

        // 1. Spawn batch of keys from the top
        if (spawnedTotal < targetCount) {
          spawnBatch();
        }

        // 2. Rebuild active spatial hash for current frame
        activeGrid.clear();
        for (let i = 0; i < activeKeys.length; i++) {
          activeGrid.insert(activeKeys[i]);
        }

        // 3. Update physics and handle stacking & tumbling
        for (let i = 0; i < activeKeys.length; i++) {
          const k = activeKeys[i];

          // Slow ambient air drag & gravity
          k.vy += gravity;
          if (k.vy > 2.4) k.vy = 2.4; // Terminal velocity cap for slow ambient drift
          k.vx *= 0.988;
          k.va *= 0.95;

          k.x += k.vx;
          k.y += k.vy;
          k.angle += k.va;

          const cos = Math.cos(k.angle);
          const sin = Math.sin(k.angle);

          // Head & tip center coordinates
          const p1x = k.x - cos * k.halfD;
          const p1y = k.y - sin * k.halfD;
          const p2x = k.x + cos * k.halfD;
          const p2y = k.y + sin * k.halfD;

          // Floor boundary impact (no bounce, realistic clatter/tumble)
          let touchedFloor = false;
          if (p1y + k.r1 >= floorY) {
            k.y -= p1y + k.r1 - floorY;
            if (k.vy > 0) {
              k.vy = -k.vy * restitution;
              k.vx *= friction;
              // Torque rotates the key flat onto the floor
              k.va += (Math.random() - 0.5) * 0.02 - sin * 0.06;
            }
            touchedFloor = true;
          }
          if (p2y + k.r2 >= floorY) {
            k.y -= p2y + k.r2 - floorY;
            if (k.vy > 0) {
              k.vy = -k.vy * restitution;
              k.vx *= friction;
              // Torque rotates the key flat onto the floor
              k.va += (Math.random() - 0.5) * 0.02 + sin * 0.06;
            }
            touchedFloor = true;
          }

          // Wall boundaries
          if (k.x - k.r1 < 10) {
            k.x = 10 + k.r1;
            k.vx = Math.abs(k.vx) * restitution;
          } else if (k.x + k.r1 > width - 10) {
            k.x = width - 10 - k.r1;
            k.vx = -Math.abs(k.vx) * restitution;
          }

          // Key-to-Key Stacking Collisions (query local 3x3 cells only)
          const neighbors = activeGrid.query(k.x, k.y, 34);
          const staticNeighbors = staticGrid.query(k.x, k.y, 34);

          const checkCollisionWith = (other: SimKey, isOtherStatic: boolean) => {
            const dx = k.x - other.x;
            const dy = k.y - other.y;
            const distSq = dx * dx + dy * dy;
            const maxRad = k.halfD + k.r1 + other.halfD + other.r1;
            if (distSq > maxRad * maxRad) return;

            const oCos = Math.cos(other.angle);
            const oSin = Math.sin(other.angle);
            const op1x = other.x - oCos * other.halfD;
            const op1y = other.y - oSin * other.halfD;
            const op2x = other.x + oCos * other.halfD;
            const op2y = other.y + oSin * other.halfD;

            const pairs = [
              { x1: p1x, y1: p1y, r1: k.r1, x2: op1x, y2: op1y, r2: other.r1, isHead1: true },
              { x1: p1x, y1: p1y, r1: k.r1, x2: op2x, y2: op2y, r2: other.r2, isHead1: true },
              { x1: p2x, y1: p2y, r1: k.r2, x2: op1x, y2: op1y, r2: other.r1, isHead1: false },
              { x1: p2x, y1: p2y, r1: k.r2, x2: op2x, y2: op2y, r2: other.r2, isHead1: false },
            ];

            for (let p = 0; p < pairs.length; p++) {
              const pair = pairs[p];
              const cdx = pair.x1 - pair.x2;
              const cdy = pair.y1 - pair.y2;
              const d2 = cdx * cdx + cdy * cdy;
              const minD = pair.r1 + pair.r2;

              if (d2 < minD * minD && d2 > 0.0001) {
                const d = Math.sqrt(d2);
                const nx = cdx / d;
                const ny = cdy / d;
                const pen = minD - d;

                // Stack separation: keys sit on top of each other
                if (isOtherStatic) {
                  k.x += nx * pen;
                  k.y += ny * pen;
                } else {
                  k.x += nx * pen * 0.5;
                  k.y += ny * pen * 0.5;
                  other.x -= nx * pen * 0.5;
                  other.y -= ny * pen * 0.5;
                }

                // Inelastic collision with tumble torque
                const relVx = k.vx - (isOtherStatic ? 0 : other.vx);
                const relVy = k.vy - (isOtherStatic ? 0 : other.vy);
                const vNorm = relVx * nx + relVy * ny;

                if (vNorm < 0) {
                  // Inelastic contact: minimal bounce, energy dissipated
                  const j = -(1 + restitution) * vNorm * (isOtherStatic ? 0.8 : 0.45);
                  k.vx += nx * j;
                  k.vy += ny * j;

                  // Tumble torque: hitting on one side induces rotation so key rolls/slips flat
                  const torqueArm = pair.isHead1 ? -k.halfD : k.halfD;
                  k.va += (nx * sin - ny * cos) * torqueArm * 0.025;

                  // Slope slip: if resting on a slope, slide sideways into valleys
                  if (Math.abs(nx) > 0.3) {
                    k.vx += Math.sign(nx) * 0.08;
                  }

                  if (!isOtherStatic) {
                    other.vx -= nx * j;
                    other.vy -= ny * j;
                  }
                }
                break;
              }
            }
          };

          for (let n = 0; n < neighbors.length; n++) {
            if (neighbors[n] !== k) checkCollisionWith(neighbors[n], false);
          }
          for (let n = 0; n < staticNeighbors.length; n++) {
            checkCollisionWith(staticNeighbors[n], true);
          }

          // Sleep condition: freeze settled keys in place once at rest in the pile
          const speed = Math.sqrt(k.vx * k.vx + k.vy * k.vy);
          if (
            (touchedFloor || k.y >= pileRegionY) &&
            speed < 0.14 &&
            Math.abs(k.va) < 0.03
          ) {
            k.sleepFrames++;
            if (k.sleepFrames >= 10) {
              k.isAsleep = true;
              // Permanently bake key onto static offscreen canvas
              drawKey(staticCtx, k.x, k.y, k.angle, k.spriteIdx);
              // Add to static grid so subsequent keys stack on it
              staticGrid.insert(k);
              settledRecords.push({
                x: Math.round(k.x * 10) / 10,
                y: Math.round(k.y * 10) / 10,
                angle: Math.round(k.angle * 100) / 100,
                spriteIdx: k.spriteIdx,
              });
            }
          } else {
            k.sleepFrames = Math.max(0, k.sleepFrames - 1);
          }
        }

        // 4. Remove asleep keys from active simulation array
        for (let i = activeKeys.length - 1; i >= 0; i--) {
          if (activeKeys[i].isAsleep) {
            activeKeys.splice(i, 1);
          }
        }

        // 5. Composite frame: draw baked static pile, then draw currently moving active keys
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(staticCanvas, 0, 0);

        for (let i = 0; i < activeKeys.length; i++) {
          const k = activeKeys[i];
          drawKey(ctx, k.x, k.y, k.angle, k.spriteIdx);
        }

        // 6. Halt condition: once all keys have settled into the pile
        if (spawnedTotal >= targetCount && activeKeys.length === 0) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(settledRecords));
          } catch {}

          document.removeEventListener("visibilitychange", handleVisibility);
          return; // Simulation complete! 0 CPU / 0 GPU from this point onwards.
        }

        animId = requestAnimationFrame(tick);
      };

      animId = requestAnimationFrame(tick);
    }

    return () => {
      isDisposed = true;
      clearTimeout(initTimer);
      if (animId !== null) cancelAnimationFrame(animId);
    };
  }, [closedCount]);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      style={{ opacity: 0.42 }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
