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
  r1: number;
  r2: number;
  halfD: number;
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

  constructor(cellSize = 30) {
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

  query(x: number, y: number, radius = 28): SimKey[] {
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
 * Pre-renders an assortment of brass/gold key silhouette sprites onto small offscreen canvases.
 * Key shape: rounded bow with circular hole, shaft, and 2-3 distinct teeth notches.
 * Warm brass tones (#C9A24B base, lighter highlight edge).
 */
function createKeySprites(dpr = 1): KeySprite[] {
  const sprites: KeySprite[] = [];
  const colorPalettes = [
    { base: "#C9A24B", highlight: "#E6C978", shadow: "#9C792E" },
    { base: "#D4AF37", highlight: "#F3DC8C", shadow: "#A68224" },
    { base: "#BFA04E", highlight: "#DFCA82", shadow: "#91742B" },
    { base: "#C29940", highlight: "#ECC66E", shadow: "#967026" },
  ];

  const scales = [0.82, 0.92, 1.0, 1.10, 1.18]; // +/-20% variation as requested

  for (let sIdx = 0; sIdx < scales.length; sIdx++) {
    const scale = scales[sIdx];
    for (let cIdx = 0; cIdx < colorPalettes.length; cIdx++) {
      const palette = colorPalettes[cIdx];
      const hasThreeTeeth = (sIdx + cIdx) % 2 === 0;

      const bowRadius = 4.8 * scale;
      const holeRadius = 2.1 * scale;
      const shaftLen = (hasThreeTeeth ? 14 : 12) * scale;
      const shaftWidth = 2.4 * scale;
      const totalLen = bowRadius * 2 + shaftLen;

      // Offscreen canvas padded for highlight strokes and rotation
      const pad = 4;
      const w = Math.ceil((totalLen + pad * 2) * dpr);
      const h = Math.ceil((bowRadius * 2 + 8 * scale + pad * 2) * dpr);

      const offCanvas = document.createElement("canvas");
      offCanvas.width = w;
      offCanvas.height = h;
      const ctx = offCanvas.getContext("2d");
      if (!ctx) continue;

      ctx.scale(dpr, dpr);
      ctx.translate(pad + bowRadius, pad + bowRadius + 2 * scale);

      // Draw Key Silhouette
      ctx.beginPath();
      // 1. Bow (outer circle)
      ctx.arc(0, 0, bowRadius, 0, Math.PI * 2, false);

      // 2. Shaft & Teeth
      const topY = -shaftWidth / 2;
      const botY = shaftWidth / 2;

      ctx.moveTo(bowRadius * 0.7, topY);
      ctx.lineTo(bowRadius + shaftLen, topY);
      // Tip rounded bevel
      ctx.arc(
        bowRadius + shaftLen,
        topY + shaftWidth / 2,
        shaftWidth / 2,
        -Math.PI / 2,
        Math.PI / 2,
        false
      );

      // Teeth notches extending down from bottom edge
      if (hasThreeTeeth) {
        // Tooth 3 (near tip)
        ctx.lineTo(bowRadius + shaftLen - 1.5 * scale, botY);
        ctx.lineTo(bowRadius + shaftLen - 1.5 * scale, botY + 2.2 * scale);
        ctx.lineTo(bowRadius + shaftLen - 3.2 * scale, botY + 2.2 * scale);
        ctx.lineTo(bowRadius + shaftLen - 3.2 * scale, botY);
        // Tooth 2 (middle)
        ctx.lineTo(bowRadius + shaftLen - 4.8 * scale, botY);
        ctx.lineTo(bowRadius + shaftLen - 4.8 * scale, botY + 2.8 * scale);
        ctx.lineTo(bowRadius + shaftLen - 6.8 * scale, botY + 2.8 * scale);
        ctx.lineTo(bowRadius + shaftLen - 6.8 * scale, botY);
        // Tooth 1 (inner)
        ctx.lineTo(bowRadius + shaftLen - 8.4 * scale, botY);
        ctx.lineTo(bowRadius + shaftLen - 8.4 * scale, botY + 1.8 * scale);
        ctx.lineTo(bowRadius + shaftLen - 10.2 * scale, botY + 1.8 * scale);
        ctx.lineTo(bowRadius + shaftLen - 10.2 * scale, botY);
      } else {
        // Two teeth variation
        ctx.lineTo(bowRadius + shaftLen - 2.0 * scale, botY);
        ctx.lineTo(bowRadius + shaftLen - 2.0 * scale, botY + 2.6 * scale);
        ctx.lineTo(bowRadius + shaftLen - 4.2 * scale, botY + 2.6 * scale);
        ctx.lineTo(bowRadius + shaftLen - 4.2 * scale, botY);

        ctx.lineTo(bowRadius + shaftLen - 6.0 * scale, botY);
        ctx.lineTo(bowRadius + shaftLen - 6.0 * scale, botY + 2.4 * scale);
        ctx.lineTo(bowRadius + shaftLen - 8.4 * scale, botY + 2.4 * scale);
        ctx.lineTo(bowRadius + shaftLen - 8.4 * scale, botY);
      }

      ctx.lineTo(bowRadius * 0.7, botY);
      ctx.closePath();

      // Cut out bow center hole (donut head)
      ctx.moveTo(holeRadius, 0);
      ctx.arc(0, 0, holeRadius, 0, Math.PI * 2, true);

      // Base fill
      ctx.fillStyle = palette.base;
      ctx.fill();

      // Subtle lighter highlight edge on top
      ctx.lineWidth = 0.75 * scale;
      ctx.strokeStyle = palette.highlight;
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

  // Fetch live closed transaction count on mount
  useEffect(() => {
    let active = true;
    fetchCount()
      .then((res) => {
        if (active && res && typeof res.count === "number" && res.count > 0) {
          setClosedCount(res.count);
        }
      })
      .catch(() => {
        // fallback kept at 4092
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

    // Defer initialization slightly after initial paint to avoid competing with LCP
    const initTimer = setTimeout(() => {
      if (isDisposed) return;
      startKeySimulation();
    }, 80);

    function startKeySimulation() {
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

      // Secondary offscreen canvas layer to permanently bake settled "asleep" keys
      const staticCanvas = document.createElement("canvas");
      staticCanvas.width = canvas.width;
      staticCanvas.height = canvas.height;
      const staticCtx = staticCanvas.getContext("2d");
      if (!staticCtx) return;

      // Scale total keys based on device capability:
      // Mobile / low concurrency: cap around 600-800
      // Tablet: ~1,500
      // Desktop: full closedCount (~4,000)
      const concurrency = navigator.hardwareConcurrency || 4;
      let targetCount = closedCount;
      if (width < 640 || concurrency <= 2) {
        targetCount = Math.min(650, closedCount);
      } else if (width < 1024 || concurrency <= 4) {
        targetCount = Math.min(1600, closedCount);
      } else {
        targetCount = Math.min(4200, closedCount);
      }

      // Check localStorage for previously simulated settled resting positions
      // Bucket width to nearest 100px so minor viewport variance reuses layout
      const widthBucket = Math.round(width / 100) * 100;
      const cacheKey = `msreg_keypile_v1_${widthBucket}_${targetCount}`;

      const sprites = createKeySprites(dpr);
      if (sprites.length === 0) return;

      // Try loading cached positions
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

      // Fast render function for settled keys
      const drawKeyToCtx = (
        targetContext: CanvasRenderingContext2D,
        x: number,
        y: number,
        angle: number,
        spriteIdx: number
      ) => {
        const sprite = sprites[spriteIdx % sprites.length];
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Hardware accelerated setTransform
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

      // If cached OR if user prefers reduced motion, render immediately without running physics!
      if (cachedSettled || prefersReducedMotion) {
        let keysToDraw: SettledRecord[] = cachedSettled || [];

        // If reduced motion with no cache yet, generate static pile distribution
        if (!cachedSettled && prefersReducedMotion) {
          keysToDraw = [];
          const floorY = height - 12;
          for (let i = 0; i < targetCount; i++) {
            const x = 20 + Math.random() * (width - 40);
            // Pile thickness distribution: thicker in center, tapering to edges
            const normX = (x / width) * 2 - 1;
            const pileHeight = Math.max(8, (1 - normX * normX * 0.7) * 75 * (i / targetCount));
            const y = floorY - Math.random() * pileHeight;
            const angle = (Math.random() - 0.5) * Math.PI * 0.45;
            const spriteIdx = Math.floor(Math.random() * sprites.length);
            keysToDraw.push({ x, y, angle, spriteIdx });
          }
          try {
            localStorage.setItem(cacheKey, JSON.stringify(keysToDraw));
          } catch {}
        }

        // Draw all settled keys directly to static canvas & composite once
        for (let i = 0; i < keysToDraw.length; i++) {
          const k = keysToDraw[i];
          drawKeyToCtx(staticCtx, k.x, k.y, k.angle, k.spriteIdx);
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(staticCanvas, 0, 0);
        return; // Zero further CPU usage!
      }

      // --- Live Staged Physics Simulation ---
      const activeKeys: SimKey[] = [];
      const settledRecords: SettledRecord[] = [];
      const activeGrid = new SpatialHash(30);
      const staticGrid = new SpatialHash(30);

      let spawnedTotal = 0;
      const floorY = height - 12;

      // Rate of spawn: 14 to 26 keys per frame so keys cascade across ~5-7 seconds
      const spawnRate = Math.max(12, Math.min(28, Math.ceil(targetCount / 220)));

      const spawnBatch = () => {
        const toSpawn = Math.min(spawnRate, targetCount - spawnedTotal);
        for (let i = 0; i < toSpawn; i++) {
          const spriteIdx = Math.floor(Math.random() * sprites.length);
          const sprite = sprites[spriteIdx];

          const scale = sprite.scale;
          const r1 = 4.8 * scale;
          const r2 = 3.2 * scale;
          const halfD = 6.0 * scale;

          activeKeys.push({
            x: 20 + Math.random() * (width - 40),
            y: -20 - Math.random() * 50,
            vx: (Math.random() - 0.5) * 0.7,
            vy: 1.2 + Math.random() * 2.6,
            angle: Math.random() * Math.PI * 2,
            va: (Math.random() - 0.5) * 0.05,
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

      const gravity = 0.36;
      const restitution = 0.40; // real bounce with energy loss on each impact
      const friction = 0.82; // surface grip
      const pileRegionY = height - 160;

      // Listen to tab visibility to pause simulation when user switches tabs
      let isVisible = document.visibilityState !== "hidden";
      const handleVisibilityChange = () => {
        isVisible = document.visibilityState !== "hidden";
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      const tick = () => {
        if (isDisposed) return;

        if (!isVisible) {
          animId = requestAnimationFrame(tick);
          return;
        }

        // 1. Stage new keys into the viewport
        if (spawnedTotal < targetCount) {
          spawnBatch();
        }

        // 2. Clear active spatial hash and rebuild for current frame
        activeGrid.clear();
        for (let i = 0; i < activeKeys.length; i++) {
          activeGrid.insert(activeKeys[i]);
        }

        // 3. Physics update & collision resolution for active keys
        for (let i = 0; i < activeKeys.length; i++) {
          const k = activeKeys[i];

          // Apply Gravity and Air Drag
          k.vy += gravity;
          k.vx *= 0.993;
          k.vy *= 0.995;
          k.va *= 0.96;

          k.x += k.vx;
          k.y += k.vy;
          k.angle += k.va;

          const cos = Math.cos(k.angle);
          const sin = Math.sin(k.angle);

          // Sphere 1 (Head) and Sphere 2 (Tip) centers
          const p1x = k.x - cos * k.halfD;
          const p1y = k.y - sin * k.halfD;
          const p2x = k.x + cos * k.halfD;
          const p2y = k.y + sin * k.halfD;

          // Floor boundary collision
          let touchedFloor = false;
          if (p1y + k.r1 >= floorY) {
            const pen = p1y + k.r1 - floorY;
            k.y -= pen;
            if (k.vy > 0) {
              k.vy = -k.vy * restitution;
              k.vx *= friction;
              k.va += (Math.random() - 0.5) * 0.04 - sin * 0.05;
            }
            touchedFloor = true;
          }
          if (p2y + k.r2 >= floorY) {
            const pen = p2y + k.r2 - floorY;
            k.y -= pen;
            if (k.vy > 0) {
              k.vy = -k.vy * restitution;
              k.vx *= friction;
              k.va += (Math.random() - 0.5) * 0.04 + sin * 0.05;
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

          // Key-to-Key Collisions (Active vs Active + Active vs Static)
          // Spatial hash query: only check nearby neighboring cells!
          const neighbors = activeGrid.query(k.x, k.y, 32);
          const staticNeighbors = staticGrid.query(k.x, k.y, 32);

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

            // Check 4 sphere pair combinations:
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

              if (d2 < minD * minD && d2 > 0.001) {
                const d = Math.sqrt(d2);
                const nx = cdx / d;
                const ny = cdy / d;
                const pen = minD - d;

                // Position correction
                if (isOtherStatic) {
                  k.x += nx * pen;
                  k.y += ny * pen;
                } else {
                  k.x += nx * pen * 0.5;
                  k.y += ny * pen * 0.5;
                  other.x -= nx * pen * 0.5;
                  other.y -= ny * pen * 0.5;
                }

                // Impulse bounce
                const relVx = k.vx - (isOtherStatic ? 0 : other.vx);
                const relVy = k.vy - (isOtherStatic ? 0 : other.vy);
                const vNorm = relVx * nx + relVy * ny;

                if (vNorm < 0) {
                  const j = -(1 + restitution) * vNorm * (isOtherStatic ? 0.75 : 0.45);
                  k.vx += nx * j;
                  k.vy += ny * j;
                  // Natural rotational tumble imparted on impact
                  const torqueArm = pair.isHead1 ? -k.halfD : k.halfD;
                  k.va += (nx * sin - ny * cos) * torqueArm * 0.02;

                  if (!isOtherStatic) {
                    other.vx -= nx * j;
                    other.vy -= ny * j;
                  }
                }
                break;
              }
            }
          };

          // Compare against neighboring active keys
          for (let n = 0; n < neighbors.length; n++) {
            const other = neighbors[n];
            if (other !== k) {
              checkCollisionWith(other, false);
            }
          }

          // Compare against neighboring settled static keys
          for (let n = 0; n < staticNeighbors.length; n++) {
            checkCollisionWith(staticNeighbors[n], true);
          }

          // Sleep check: freeze key once velocity drops below threshold for consecutive frames
          const speed = Math.sqrt(k.vx * k.vx + k.vy * k.vy);
          if (
            (touchedFloor || k.y >= pileRegionY) &&
            speed < 0.16 &&
            Math.abs(k.va) < 0.035
          ) {
            k.sleepFrames++;
            if (k.sleepFrames >= 14) {
              k.isAsleep = true;
              // Permanently bake into static offscreen canvas
              drawKeyToCtx(staticCtx, k.x, k.y, k.angle, k.spriteIdx);
              // Register in static spatial grid so subsequent falling keys can stack on it
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

        // 4. Filter out asleep keys from the active simulation array
        // (Iterating only over active keys ensures ultra-fast rendering)
        for (let i = activeKeys.length - 1; i >= 0; i--) {
          if (activeKeys[i].isAsleep) {
            activeKeys.splice(i, 1);
          }
        }

        // 5. Render frame: composite the baked static pile underneath, then draw moving keys
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(staticCanvas, 0, 0);

        // Draw only active keys in motion
        for (let i = 0; i < activeKeys.length; i++) {
          const k = activeKeys[i];
          drawKeyToCtx(ctx, k.x, k.y, k.angle, k.spriteIdx);
        }

        // 6. Halt condition: once all keys have finished falling and settling
        if (spawnedTotal >= targetCount && activeKeys.length === 0) {
          // Cache resting layout to localStorage so repeat visits skip physics
          try {
            localStorage.setItem(cacheKey, JSON.stringify(settledRecords));
          } catch {}

          document.removeEventListener("visibilitychange", handleVisibilityChange);
          // Render loop terminates! Zero ongoing CPU / GPU usage.
          return;
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
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none"
      style={{ opacity: 0.22 }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
