import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, WireMaterial } from '../types/physics';
import { translations } from '../utils/translations';
import { ProgressiveSlider } from './ProgressiveSlider';
import { RotateCcw, ArrowRightLeft, ShieldCheck, AlertTriangle, Flame, Sparkles, MoveHorizontal } from 'lucide-react';

const WIRE_MATERIALS: WireMaterial[] = [
  {
    id: 'steel',
    nameBn: 'ইস্পাত (Structural Steel)',
    nameEn: 'Structural Steel',
    youngModulus: 200e9, // 200 GPa
    yieldStress: 250e6, // 250 MPa
    breakingStress: 420e6, // 420 MPa
    poissonRatio: 0.30,
    density: 7850,
    color: '#64748b',
    specular: '#e2e8f0',
  },
  {
    id: 'copper',
    nameBn: 'তামা (Pure Copper)',
    nameEn: 'Pure Copper',
    youngModulus: 110e9, // 110 GPa
    yieldStress: 140e6, // 140 MPa
    breakingStress: 260e6, // 260 MPa
    poissonRatio: 0.34,
    density: 8960,
    color: '#ea580c',
    specular: '#fed7aa',
  },
  {
    id: 'aluminum',
    nameBn: 'অ্যালুমিনিয়াম (Aluminum Alloy)',
    nameEn: 'Aluminum Alloy',
    youngModulus: 70e9, // 70 GPa
    yieldStress: 95e6, // 95 MPa
    breakingStress: 190e6, // 190 MPa
    poissonRatio: 0.33,
    density: 2700,
    color: '#94a3b8',
    specular: '#f1f5f9',
  },
  {
    id: 'rubber',
    nameBn: 'প্রাকৃতিক রাবার (Elastic Rubber Rod)',
    nameEn: 'Elastic Rubber Rod',
    youngModulus: 0.05e9, // 50 MPa
    yieldStress: 8e6, // 8 MPa
    breakingStress: 18e6, // 18 MPa
    poissonRatio: 0.499,
    density: 1100,
    color: '#0284c7',
    specular: '#bae6fd',
  },
];

interface Module1Props {
  lang: Language;
}

export const Module1Young: React.FC<Module1Props> = ({ lang }) => {
  const t = translations[lang];

  // Parameters
  const [material, setMaterial] = useState<WireMaterial>(WIRE_MATERIALS[0]);
  const [appliedForce, setAppliedForce] = useState<number>(850); // N (-1000 to +3000)
  const [length0, setLength0] = useState<number>(2.0); // meters
  const [diameter0, setDiameter0] = useState<number>(1.8); // mm
  const [permanentStrain, setPermanentStrain] = useState<number>(0);
  const [isBroken, setIsBroken] = useState<boolean>(false);
  const [snapTime, setSnapTime] = useState<number>(0);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartForceRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  // Particles for break effect
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }>>([]);

  // Physical calculations
  const radiusMeters = (diameter0 * 1e-3) / 2;
  const area = Math.PI * radiusMeters * radiusMeters; // m^2
  const stress = appliedForce / area; // Pa (N/m^2)
  const absStress = Math.abs(stress);

  // Elastic strain
  const elasticStrain = stress / material.youngModulus;

  // Plastic check & permanent strain calculation
  useEffect(() => {
    if (isBroken) return;

    if (absStress >= material.breakingStress) {
      setIsBroken(true);
      setSnapTime(Date.now());
      // spawn snap particles
      const newParticles = [];
      for (let i = 0; i < 50; i++) {
        newParticles.push({
          x: 0,
          y: 0,
          vx: (Math.random() - 0.5) * 450,
          vy: (Math.random() - 0.5) * 350,
          life: 1.0,
          color: Math.random() > 0.4 ? '#f59e0b' : '#ef4444',
          size: 2 + Math.random() * 4,
        });
      }
      particlesRef.current = newParticles;
    } else if (absStress > material.yieldStress) {
      const excess = (absStress - material.yieldStress) / (material.breakingStress - material.yieldStress);
      const plasticIncrement = Math.sign(stress) * excess * 0.04;
      setPermanentStrain((prev) => Math.sign(stress) * Math.max(Math.abs(prev), Math.abs(plasticIncrement)));
    }
  }, [absStress, stress, material, isBroken]);

  // Total strain & length change
  const currentTotalStrain = isBroken ? permanentStrain : permanentStrain + elasticStrain;
  const deltaL = currentTotalStrain * length0; // meters

  // Poisson effect: diameter change
  const lateralStrain = -material.poissonRatio * currentTotalStrain;
  const deltaD = lateralStrain * diameter0; // mm
  const currentDiameter = Math.max(0.2, diameter0 + deltaD);

  // Necking factor
  const neckingRatio = absStress > material.yieldStress
    ? Math.min(1.0, (absStress - material.yieldStress) / (material.breakingStress - material.yieldStress))
    : 0;

  // Unload handler: smoothly release applied force to 0 N
  const handleUnload = () => {
    const startForce = appliedForce;
    const startTime = performance.now();
    const duration = 400;

    const animateUnload = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      const nextF = startForce * (1 - ease);
      setAppliedForce(nextF);

      if (progress < 1) {
        requestAnimationFrame(animateUnload);
      } else {
        setAppliedForce(0);
      }
    };
    requestAnimationFrame(animateUnload);
  };

  const handleReset = () => {
    setAppliedForce(0);
    setPermanentStrain(0);
    setIsBroken(false);
    particlesRef.current = [];
  };

  // High-DPI realistic canvas drawing loop
  const drawSimulation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina / HiDPI setup
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background & lab grid
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const centerY = height / 2;
    const leftAnchorX = 90;
    const restLengthPx = width * 0.52;

    const visualScaleFactor = material.id === 'rubber' ? 85 : 360;
    const elongationPx = deltaL * visualScaleFactor;
    const currentWireLengthPx = Math.max(70, restLengthPx + elongationPx);
    const rightClampX = leftAnchorX + currentWireLengthPx;

    // ==========================================
    // 1. FIXED HEAVY ANCHOR WALL
    // ==========================================
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(14, centerY - 96, leftAnchorX - 10, 192);

    // Wall face
    const wallGrad = ctx.createLinearGradient(10, 0, leftAnchorX, 0);
    wallGrad.addColorStop(0, '#1e293b');
    wallGrad.addColorStop(1, '#334155');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(10, centerY - 100, leftAnchorX - 10, 200);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(10, centerY - 100, leftAnchorX - 10, 200);

    // Industrial Anchor Mounting Bolts
    for (const by of [centerY - 65, centerY - 25, centerY + 25, centerY + 65]) {
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(leftAnchorX - 30, by, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(leftAnchorX - 30, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Heavy steel gripping jaws
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(leftAnchorX - 12, centerY - 40, 12, 80);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(leftAnchorX - 12, centerY - 40, 12, 80);

    // Base wire thickness
    const baseRadiusPx = diameter0 * 9;

    // Ghost original rest wire outline (dashed)
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(leftAnchorX, centerY - baseRadiusPx, restLengthPx, baseRadiusPx * 2);
    ctx.restore();

    // Rest length label card
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(leftAnchorX + restLengthPx / 2 - 60, centerY - baseRadiusPx - 34, 120, 22, 6);
    ctx.fill();
    ctx.font = 'bold 11px JetBrains Mono';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`L₀ = ${length0.toFixed(2)} m (Rest)`, leftAnchorX + restLengthPx / 2, centerY - baseRadiusPx - 19);
    ctx.textAlign = 'left';

    if (!isBroken) {
      // Intact Wire Rendering
      const numSegments = 60;
      const topPoints: { x: number; y: number }[] = [];
      const bottomPoints: { x: number; y: number }[] = [];

      for (let i = 0; i <= numSegments; i++) {
        const u = i / numSegments;
        const x = leftAnchorX + u * currentWireLengthPx;
        const distFromCenter = Math.abs(u - 0.5) * 2;

        let currentR = baseRadiusPx * (currentDiameter / diameter0);

        // Hourglass necking near UTS
        if (neckingRatio > 0 && appliedForce > 0) {
          const neckFactor = (1 - Math.cos(distFromCenter * Math.PI)) / 2;
          const minNeckR = currentR * (1 - neckingRatio * 0.45);
          currentR = minNeckR + (currentR - minNeckR) * neckFactor;
        }

        // Barrel bulge under compression
        if (appliedForce < 0) {
          const barrelFactor = (1 + Math.cos(distFromCenter * Math.PI)) / 2;
          const maxBulgeR = currentR * (1 + Math.abs(elasticStrain) * 3);
          currentR = currentR + (maxBulgeR - currentR) * barrelFactor;
        }

        topPoints.push({ x, y: centerY - currentR });
        bottomPoints.push({ x, y: centerY + currentR });
      }

      // Draw wire body
      ctx.beginPath();
      ctx.moveTo(topPoints[0].x, topPoints[0].y);
      for (let i = 1; i < topPoints.length; i++) {
        ctx.lineTo(topPoints[i].x, topPoints[i].y);
      }
      for (let i = bottomPoints.length - 1; i >= 0; i--) {
        ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
      }
      ctx.closePath();

      // Metallic Cylindrical Gradient Fill
      const grad = ctx.createLinearGradient(0, centerY - baseRadiusPx, 0, centerY + baseRadiusPx);
      grad.addColorStop(0, material.color);
      grad.addColorStop(0.3, material.specular);
      grad.addColorStop(0.7, material.color);
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Longitudinal specular reflection line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.moveTo(leftAnchorX, centerY - 3);
      ctx.lineTo(rightClampX, centerY - 3);
      ctx.stroke();

      // ==========================================
      // RIGHT SLIDING TENSILE GRIP CLAMP
      // ==========================================
      const clampW = 36;
      const clampH = 100;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(rightClampX, centerY - clampH / 2, clampW, clampH, 6);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pull ring handle
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(rightClampX + clampW + 6, centerY, 18, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(rightClampX + clampW + 6, centerY - 18);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(rightClampX + clampW + 6, centerY, 7, 0, Math.PI * 2);
      ctx.fill();

      // ==========================================
      // FORCE VECTOR ARROW WITH BOLD BADGE
      // ==========================================
      if (Math.abs(appliedForce) > 5) {
        const arrowDir = appliedForce > 0 ? 1 : -1;
        const arrowLen = Math.min(150, 40 + (Math.abs(appliedForce) / 3000) * 110);
        const startX = rightClampX + clampW + 12;
        const endX = startX + arrowDir * arrowLen;

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(startX, centerY);
        ctx.lineTo(endX, centerY);
        ctx.stroke();

        ctx.strokeStyle = appliedForce > 0 ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(startX, centerY);
        ctx.lineTo(endX, centerY);
        ctx.stroke();

        // Arrow head
        ctx.fillStyle = appliedForce > 0 ? '#10b981' : '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(endX, centerY);
        ctx.lineTo(endX - arrowDir * 14, centerY - 7);
        ctx.lineTo(endX - arrowDir * 14, centerY + 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Force badge card
        const forceText = `F = ${appliedForce > 0 ? '+' : ''}${appliedForce.toFixed(0)} N`;
        ctx.font = 'bold 13px JetBrains Mono';
        const fWidth = ctx.measureText(forceText).width + 20;
        const fBadgeX = startX + (endX - startX) / 2 - fWidth / 2;

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(fBadgeX, centerY + 20, fWidth, 24, 6);
        ctx.fill();
        ctx.strokeStyle = appliedForce > 0 ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = appliedForce > 0 ? '#10b981' : '#f59e0b';
        ctx.fillText(forceText, fBadgeX + 10, centerY + 36);
      }

      // Drag hint
      ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText(
        lang === 'bn' ? '↔ তার বা ডানদিকের ক্ল্যাম্প মাউস দিয়ে টেনে বল প্রয়োগ করুন' : '↔ Drag clamp/wire left or right directly with mouse',
        leftAnchorX + currentWireLengthPx / 2,
        centerY + baseRadiusPx + 38
      );
      ctx.textAlign = 'left';

    } else {
      // Wire is SNAPPED: clean break with dynamic dangling severed ends & vibration wave
      const elapsedSinceSnap = (Date.now() - snapTime) / 1000;
      const decay = Math.exp(-elapsedSinceSnap * 3);
      const vibLeft = Math.sin(elapsedSinceSnap * 28) * 22 * decay;
      const vibRight = -Math.sin(elapsedSinceSnap * 24) * 20 * decay;

      const breakX = leftAnchorX + restLengthPx * 0.52;
      const gap = Math.min(75, elapsedSinceSnap * 140);

      // Left segment
      ctx.beginPath();
      ctx.moveTo(leftAnchorX, centerY - baseRadiusPx * 0.85);
      ctx.lineTo(breakX - gap / 2 - 5, centerY - baseRadiusPx * 0.6 + vibLeft);
      ctx.lineTo(breakX - gap / 2, centerY + vibLeft);
      ctx.lineTo(breakX - gap / 2 - 8, centerY + baseRadiusPx * 0.6 + vibLeft);
      ctx.lineTo(leftAnchorX, centerY + baseRadiusPx * 0.85);
      ctx.closePath();
      ctx.fillStyle = material.color;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Right segment
      ctx.beginPath();
      ctx.moveTo(rightClampX, centerY - baseRadiusPx * 0.85);
      ctx.lineTo(breakX + gap / 2 + 5, centerY - baseRadiusPx * 0.6 + vibRight);
      ctx.lineTo(breakX + gap / 2, centerY + vibRight);
      ctx.lineTo(breakX + gap / 2 + 8, centerY + baseRadiusPx * 0.6 + vibRight);
      ctx.lineTo(rightClampX, centerY + baseRadiusPx * 0.85);
      ctx.closePath();
      ctx.fillStyle = material.color;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Clamp hanging
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(rightClampX, centerY - 50, 36, 100);

      // Fracture particles
      particlesRef.current.forEach((p) => {
        if (p.x === 0 && p.y === 0) {
          p.x = breakX;
          p.y = centerY;
        }
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.vy += 5;
        p.life -= 0.018;

        if (p.life > 0) {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, p.life * p.size), 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Snapped banner
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(width / 2 - 180, 25, 360, 36, 10);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 15px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(
        lang === 'bn' ? '⚠️ তার ভেঙে গেছে! (অসহ পীড়ন অতিক্রান্ত)' : '⚠️ Wire Snapped! (Breaking Stress Exceeded)',
        width / 2,
        48
      );
      ctx.textAlign = 'left';
    }

    // Ruler measurement markings along bottom
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    const rulerY = centerY + 85;
    ctx.beginPath();
    ctx.moveTo(leftAnchorX, rulerY);
    ctx.lineTo(leftAnchorX + restLengthPx + 160, rulerY);
    ctx.stroke();

    for (let r = 0; r <= 20; r++) {
      const rx = leftAnchorX + r * (restLengthPx / 10);
      const tickH = r % 2 === 0 ? 14 : 7;
      ctx.beginPath();
      ctx.moveTo(rx, rulerY - tickH);
      ctx.lineTo(rx, rulerY);
      ctx.stroke();

      if (r % 2 === 0) {
        ctx.font = 'bold 11px JetBrains Mono';
        ctx.fillStyle = '#0f172a';
        const fraction = (r / 10).toFixed(1);
        ctx.fillText(`${fraction} L₀`, rx - 16, rulerY + 18);
      }
    }

    // Elongation ΔL label card
    if (!isBroken && Math.abs(deltaL) > 0.0001) {
      const dlText = `ΔL = ${(deltaL * 1000).toFixed(2)} mm (${(currentTotalStrain * 100).toFixed(3)}%)`;
      ctx.font = 'bold 12px JetBrains Mono';
      const dlW = ctx.measureText(dlText).width + 20;
      const dlX = rightClampX - dlW / 2;

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(dlX, centerY + 50, dlW, 24, 6);
      ctx.fill();
      ctx.strokeStyle = deltaL > 0 ? '#10b981' : '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = deltaL > 0 ? '#10b981' : '#f59e0b';
      ctx.fillText(dlText, dlX + 10, centerY + 66);
    }

    ctx.restore();
  }, [material, deltaL, currentDiameter, diameter0, length0, appliedForce, isBroken, snapTime, lang, neckingRatio, currentTotalStrain, elasticStrain]);

  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      drawSimulation();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      active = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawSimulation]);

  // Pointer drag anywhere on canvas to smoothly pull/push wire!
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isBroken) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartForceRef.current = appliedForce;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || isBroken) return;
    const dx = e.clientX - dragStartXRef.current;
    const newForce = Math.max(-1000, Math.min(3000, dragStartForceRef.current + dx * 10));
    setAppliedForce(Math.round(newForce));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const isHookeValid = absStress <= material.yieldStress && !isBroken;
  const isPlastic = absStress > material.yieldStress && absStress < material.breakingStress && !isBroken;

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full h-full">
      {/* LEFT SIDEBAR (Fixed 330px width) */}
      <aside className="w-full lg:w-[330px] shrink-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-4 flex flex-col gap-4 text-slate-950">
        <div>
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            {t.common.controls}
          </h2>
          <p className="text-[11px] text-slate-700 font-medium mt-0.5">{t.m1.subtitle}</p>
        </div>

        {/* Material Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-900">{t.common.material}</label>
          <div className="grid grid-cols-2 gap-1.5">
            {WIRE_MATERIALS.map((m) => {
              const isSelected = material.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setMaterial(m);
                    handleReset();
                  }}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-sky-50 text-slate-900 hover:bg-sky-100 border border-sky-300'
                  }`}
                >
                  <span className="truncate">{lang === 'bn' ? m.nameBn.split(' ')[0] : m.nameEn}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-emerald-100' : 'text-slate-600'}`}>
                    Y = {(m.youngModulus / 1e9).toFixed(0)} GPa
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders with Progressive Green Fill */}
        <div className="flex flex-col gap-3 pt-2 border-t border-sky-100">
          <ProgressiveSlider
            label={t.m1.loadForce}
            value={appliedForce}
            min={-1000}
            max={3000}
            step={25}
            unit="N"
            disabled={isBroken}
            valueFormatter={(v) => `${v > 0 ? '+' : ''}${v} N`}
            onChange={setAppliedForce}
          />

          <ProgressiveSlider
            label={t.m1.wireLength}
            value={length0}
            min={1.0}
            max={4.0}
            step={0.1}
            unit="m"
            valueFormatter={(v) => `${v.toFixed(1)} m`}
            onChange={setLength0}
          />

          <ProgressiveSlider
            label={t.m1.wireDiameter}
            value={diameter0}
            min={0.8}
            max={3.5}
            step={0.1}
            unit="mm"
            valueFormatter={(v) => `${v.toFixed(1)} mm`}
            onChange={setDiameter0}
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-sky-100">
          <button
            onClick={handleUnload}
            disabled={isBroken || appliedForce === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-100 hover:bg-sky-200 text-sky-950 border border-sky-300 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-xs"
            title={t.m1.unloadSmoothly}
          >
            <ArrowRightLeft className="w-4 h-4 text-sky-700" />
            <span>{t.common.unload}</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            title={t.common.reset}
          >
            <RotateCcw className="w-4 h-4 text-slate-700" />
            <span>{isBroken ? t.m1.reconnectWire : t.common.reset}</span>
          </button>
        </div>

        {/* Governing Formulas Box */}
        <div className="mt-auto bg-sky-50 rounded-xl p-3 border border-sky-200 text-xs">
          <div className="font-bold text-slate-950 mb-1.5 flex items-center justify-between">
            <span>{t.common.formulas}</span>
            <span className="text-[10px] text-emerald-800 font-mono font-bold">Hooke's Law</span>
          </div>
          <div className="font-mono text-[11px] text-slate-900 font-semibold space-y-1 leading-relaxed">
            <div>σ = F / A = F / (π r²)</div>
            <div>ε = ΔL / L₀</div>
            <div>Y = σ / ε = (F · L₀) / (A · ΔL)</div>
            <div>Δd = -σ_p · ε · d₀ (পয়সন প্রভাব)</div>
          </div>
        </div>
      </aside>

      {/* CENTER WORKSPACE */}
      <main className="flex-1 min-w-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-3.5 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-950">{t.common.workspace}</span>
            <span className="text-[11px] text-emerald-900 font-bold hidden sm:inline flex items-center gap-1">
              <MoveHorizontal className="w-3.5 h-3.5 text-emerald-600" />
              {lang === 'bn' ? 'মাউস দিয়ে তার বা ক্ল্যাম্প টেনে বল প্রয়োগ করুন' : 'Drag clamp or wire left/right directly with mouse'}
            </span>
          </div>

          {/* Status badge */}
          {isBroken ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 border border-red-300 rounded-full text-xs font-bold shadow-xs">
              <Flame className="w-4 h-4 text-red-600 animate-pulse" />
              <span>{t.m1.wireSnapped}</span>
            </div>
          ) : isPlastic ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold shadow-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>{t.m1.plasticDeform}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-bold shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{t.m1.hookeValid}</span>
            </div>
          )}
        </div>

        {/* Canvas container */}
        <div className="relative flex-1 w-full min-h-[420px] rounded-xl overflow-hidden border border-sky-200/90 bg-slate-50">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full block cursor-ew-resize touch-none"
          />

          {neckingRatio > 0.1 && !isBroken && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-2 border border-white">
              <Sparkles className="w-4 h-4" />
              <span>{t.m1.neckingDetected}</span>
            </div>
          )}
        </div>
      </main>

      {/* RIGHT TELEMETRY PANEL (320px width) */}
      <aside className="w-full lg:w-[320px] shrink-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-4 flex flex-col gap-3 text-slate-950">
        <div>
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
            {t.common.telemetry}
          </h2>
          <p className="text-[11px] text-slate-700 font-medium mt-0.5">{lang === 'bn' ? 'লাইভ পীড়ন-বিকৃতি পরিমাপক' : 'Real-Time Tensile Gauges'}</p>
        </div>

        {/* Big Stress-Strain Meter Card */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 flex flex-col">
            <span className="text-[11px] font-bold text-slate-800">{t.m1.stress}</span>
            <span className="font-mono text-lg font-extrabold text-slate-950 mt-1 tabular-nums">
              {(stress / 1e6).toFixed(2)}
            </span>
            <span className="text-[10px] text-sky-800 font-bold font-mono">MPa (10⁶ N/m²)</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col">
            <span className="text-[11px] font-bold text-slate-800">{t.m1.strain}</span>
            <span className="font-mono text-lg font-extrabold text-emerald-900 mt-1 tabular-nums">
              {(currentTotalStrain * 100).toFixed(4)} %
            </span>
            <span className="text-[10px] text-emerald-800 font-bold font-mono">ε = ΔL/L₀</span>
          </div>
        </div>

        {/* Detailed Physical Metrics List */}
        <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m1.youngModulus} (Y):</span>
            <span className="font-mono font-bold text-slate-950 tabular-nums">
              {(material.youngModulus / 1e9).toFixed(1)} GPa
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m1.deltaL}:</span>
            <span className="font-mono font-bold text-emerald-800 tabular-nums">
              {(deltaL * 1000).toFixed(3)} mm
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m1.deltaD}:</span>
            <span className="font-mono font-bold text-sky-900 tabular-nums">
              {(deltaD).toFixed(4)} mm
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m1.crossArea} (A):</span>
            <span className="font-mono font-bold text-slate-950 tabular-nums">
              {(area * 1e6).toFixed(3)} mm²
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m1.permanentSet}:</span>
            <span className="font-mono font-bold text-amber-800 tabular-nums">
              {(permanentStrain * 100).toFixed(4)} %
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-800 font-semibold">Yield Stress:</span>
            <span className="font-mono font-bold text-slate-950 tabular-nums">
              {(material.yieldStress / 1e6).toFixed(0)} MPa
            </span>
          </div>
        </div>

        {/* Yield & Breaking Visual Threshold Bar */}
        <div className="flex flex-col gap-1.5 p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs">
          <div className="flex justify-between text-[11px] font-bold text-slate-900">
            <span>পীড়ন ভার অনুপাত (Stress Load Ratio)</span>
            <span className="font-mono font-bold">
              {((absStress / material.breakingStress) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden relative">
            <div
              className={`h-full transition-all duration-150 ${
                absStress > material.yieldStress ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.min(100, (absStress / material.breakingStress) * 100)}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-950"
              style={{ left: `${(material.yieldStress / material.breakingStress) * 100}%` }}
              title="Yield Stress"
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-700 font-bold font-mono">
            <span>০</span>
            <span>নমনীয় সীমা ({((material.yieldStress / material.breakingStress) * 100).toFixed(0)}%)</span>
            <span>অসহ ভাঙন (১০০%)</span>
          </div>
        </div>
      </aside>
    </div>
  );
};
