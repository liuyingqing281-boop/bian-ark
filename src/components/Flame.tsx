"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  sat: number;
  light: number;
}

export default function Flame({
  width = 32,
  height = 48,
}: {
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = width * dpr;
    const h = height * dpr;
    canvas.width = w;
    canvas.height = h;
    ctx.scale(dpr, dpr);

    let particles: Particle[] = [];
    let raf = 0;
    let lastTime = 0;

    function emit() {
      const count = reducedMotion ? 0 : 1;
      for (let i = 0; i < count; i++) {
        const life = 30 + Math.random() * 40;
        particles.push({
          x: width / 2 + (Math.random() - 0.5) * 6,
          y: height - 4,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -(1.5 + Math.random() * 2.5),
          life,
          maxLife: life,
          size: 3 + Math.random() * 5,
          hue: 30 + Math.random() * 25,
          sat: 85 + Math.random() * 15,
          light: 50 + Math.random() * 30,
        });
      }
      if (particles.length > 18) particles.splice(0, particles.length - 18);
    }

    function animate(time: number) {
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;

      ctx!.clearRect(0, 0, width, height);

      // Emit
      emit();

      // Update & draw
      particles = particles.filter((p) => {
        p.life -= 1;
        if (p.life <= 0) return false;
        const progress = 1 - p.life / p.maxLife;
        p.x += p.vx + (Math.random() - 0.5) * 0.3;
        p.y += p.vy + (Math.random() - 0.5) * 0.2;
        p.vy -= 0.02;
        p.vx *= 0.99;
        p.size *= 0.98;
        const alpha = 1 - progress * progress;
        const size = Math.max(0.5, p.size * (1 - progress * 0.6));

        // Glow
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, size * 2, 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${alpha * 0.15})`;
        ctx!.fill();

        // Core
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${alpha})`;
        ctx!.fill();

        return true;
      });

      // Bottom glow
      const gradient = ctx!.createRadialGradient(width / 2, height - 2, 0, width / 2, height - 2, width * 0.5);
      gradient.addColorStop(0, "hsla(35, 90%, 55%, 0.25)");
      gradient.addColorStop(0.5, "hsla(20, 85%, 40%, 0.1)");
      gradient.addColorStop(1, "hsla(0, 0%, 0%, 0)");
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, height - 12, width, 12);

      if (reducedMotion) return;
      raf = requestAnimationFrame(animate);
    }

    if (reducedMotion) {
      const gradient = ctx.createRadialGradient(width / 2, height - 2, 0, width / 2, height - 2, width * 0.5);
      gradient.addColorStop(0, "rgba(245, 158, 11, 0.3)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      raf = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(raf);
      particles = [];
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block" }}
      aria-hidden="true"
    />
  );
}
