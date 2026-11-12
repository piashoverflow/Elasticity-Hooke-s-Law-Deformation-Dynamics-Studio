import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, FluidType, SubmergedSphereMaterial } from '../types/physics';
import { translations } from '../utils/translations';
import { ProgressiveSlider } from './ProgressiveSlider';
import { RotateCcw, AlertOctagon, CheckCircle2, MoveVertical, Sparkles } from 'lucide-react';

const FLUID_TYPES: FluidType[] = [
  { id: 'water', nameBn: 'বিশুদ্ধ পানি (Fresh Water)', nameEn: 'Fresh Water', density: 1000, color: '#0284c7', viscosity: '1.0 mPa·s' },
  { id: 'seawater', nameBn: 'সমুদ্রের লোনা পানি (Deep Ocean)', nameEn: 'Deep Ocean Seawater', density: 1025, color: '#0369a1', viscosity: '1.08 mPa·s' },
  { id: 'mercury', nameBn: 'ঘন পারদ (Dense Mercury)', nameEn: 'Liquid Mercury', density: 13600, color: '#475569', viscosity: '1.53 mPa·s' },
  { id: 'oil', nameBn: 'খনিজ তেল (Mineral Oil)', nameEn: 'Mineral Oil', density: 850, color: '#d97706', viscosity: '30 mPa·s' },
];

const SPHERE_MATERIALS: SubmergedSphereMaterial[] = [
  {
    id: 'balloon',
    nameBn: 'চাপযুক্ত বেলুন (Gas-filled Balloon)',
    nameEn: 'Pressurized Gas Balloon',
    bulkModulus: 0.15e9, // 150 MPa
    crushPressure: 2.2e6, // ~2.2 MPa (implodes at ~220m in water)
    burstVacuum: -0.09e6, // bursts in deep vacuum
    initialRadius: 0.18, // m
    color: '#e11d48',
    surfacePattern: 'glossy',
  },
  {
    id: 'soft_rubber',
    nameBn: 'স্থিতিস্থাপক রাবার (Solid Rubber Sphere)',
    nameEn: 'Solid Rubber Sphere',
    bulkModulus: 1.5e9, // 1.5 GPa
    crushPressure: 4.8e6,
    burstVacuum: -0.25e6,
    initialRadius: 0.16,
    color: '#0891b2',
    surfacePattern: 'matte',
  },
  {
    id: 'aluminum_shell',
    nameBn: 'ধাতব ক্যাপসুল (Hollow Aluminum Shell)',
    nameEn: 'Hollow Aluminum Shell',
    bulkModulus: 5.5e9,
    crushPressure: 3.5e6,
    burstVacuum: -0.4e6,
    initialRadius: 0.15,
    color: '#94a3b8',
    surfacePattern: 'metallic',
  },
  {
    id: 'lead_sphere',
    nameBn: 'সীসার কঠিন গোলক (Solid Lead Sphere)',
    nameEn: 'Solid Heavy Lead Sphere',
    bulkModulus: 46e9,
    crushPressure: 22e6,
    burstVacuum: -1e6,
    initialRadius: 0.14,
    color: '#334155',
    surfacePattern: 'dense_metal',
  },
];

interface Module2Props {
  lang: Language;
}

export const Module2Bulk: React.FC<Module2Props> = ({ lang }) => {
  const t = translations[lang];

  // Selected parameters
  const [fluid, setFluid] = useState<FluidType>(FLUID_TYPES[0]);
  const [sphereMat, setSphereMat] = useState<SubmergedSphereMaterial>(SPHERE_MATERIALS[0]);
  const [depth, setDepth] = useState<number>(65); // meters (0 to 300)
  const [chamberExtraPressureKPa, setChamberExtraPressureKPa] = useState<number>(0); // -100 to +500 kPa
  const [isImploded, setIsImploded] = useState<boolean>(false);
  const [isBurst, setIsBurst] = useState<boolean>(false);
  const [eventTime, setEventTime] = useState<number>(0);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartDepthRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  // Ambient bubbles and light caustics
  const bubblesRef = useRef<Array<{ x: number; y: number; speed: number; size: number; alpha: number }>>([]);
  const fragmentsRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }>>([]);

  const g = 9.80665; // m/s^2

  // Hydrostatic pressure: ΔP = ρ * g * h + P_ext
  const hydrostaticPressure = fluid.density * g * depth; // Pa
  const chamberPressure = chamberExtraPressureKPa * 1000; // Pa
  const deltaP = hydrostaticPressure + chamberPressure;

  // Volumetric strain: ε_v = ΔV / V₀ = ΔP / K
  const volumetricStrain = deltaP / sphereMat.bulkModulus;
  const clampedVolumetricStrain = Math.min(0.85, Math.max(-0.6, volumetricStrain));

  // Radii calculation: V ∝ R^3 => R = R0 * (1 - ε_v)^(1/3)
  const volumeRatio = Math.max(0.08, 1 - clampedVolumetricStrain);
  const radiusRatio = Math.cbrt(volumeRatio);

  const initialRadiusMeters = sphereMat.initialRadius;
  const currentRadiusMeters = initialRadiusMeters * radiusRatio;
  const initialVolumeM3 = (4 / 3) * Math.PI * Math.pow(initialRadiusMeters, 3);
  const currentVolumeM3 = initialVolumeM3 * volumeRatio;
  const deltaVolumeM3 = initialVolumeM3 - currentVolumeM3;
  const compressibility = 1 / sphereMat.bulkModulus;

  // Check critical limits with smooth multi-phase transition
  useEffect(() => {
    if (isImploded || isBurst) return;

    if (deltaP >= sphereMat.crushPressure) {
      setIsImploded(true);
      setEventTime(Date.now());
      // spawn smooth collapse cavitation bubbles
      const newFrags = [];
      for (let i = 0; i < 55; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 180;
        newFrags.push({
          x: 0,
          y: 0,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 30,
          life: 1.0,
          color: Math.random() > 0.3 ? '#ffffff' : sphereMat.color,
          size: 2.5 + Math.random() * 5.5,
        });
      }
      fragmentsRef.current = newFrags;
    } else if (deltaP <= sphereMat.burstVacuum) {
      setIsBurst(true);
      setEventTime(Date.now());
      // spawn smooth balloon rupture fragments & cavitation bubbles
      const newFrags = [];
      for (let i = 0; i < 65; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 240;
        newFrags.push({
          x: 0,
          y: 0,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 40,
          life: 1.0,
          color: Math.random() > 0.4 ? sphereMat.color : '#ffffff',
          size: 3 + Math.random() * 6,
        });
      }
      fragmentsRef.current = newFrags;
    }
  }, [deltaP, sphereMat, isImploded, isBurst]);

  // Init ambient bubbles
  useEffect(() => {
    const bubbles = [];
    for (let i = 0; i < 30; i++) {
      bubbles.push({
        x: Math.random() * 800,
        y: Math.random() * 500,
        speed: 0.6 + Math.random() * 1.8,
        size: 2.5 + Math.random() * 5.5,
        alpha: 0.3 + Math.random() * 0.4,
      });
    }
    bubblesRef.current = bubbles;
  }, []);

  const handleResetSphere = () => {
    setIsImploded(false);
    setIsBurst(false);
    setDepth(50);
    setChamberExtraPressureKPa(0);
    fragmentsRef.current = [];
  };

  // High-DPI realistic canvas rendering loop
  const drawChamber = useCallback(() => {
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

    // Layout coordinates
    const tankX = 85;
    const tankY = 22;
    const tankW = width - 130;
    const tankH = height - 44;
    const waterSurfaceY = tankY + 34;

    // Outside Lab Background (soft sky-slate)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // ==========================================
    // 1. REALISTIC FLUID CHAMBER INTERIOR
    // ==========================================
    // Deep Ocean Water Gradient
    const waterGrad = ctx.createLinearGradient(0, waterSurfaceY, 0, tankY + tankH);
    if (fluid.id === 'mercury') {
      waterGrad.addColorStop(0, '#64748b');
      waterGrad.addColorStop(0.3, '#475569');
      waterGrad.addColorStop(1, '#1e293b');
    } else if (fluid.id === 'oil') {
      waterGrad.addColorStop(0, '#fef3c7');
      waterGrad.addColorStop(0.2, '#f59e0b');
      waterGrad.addColorStop(1, '#92400e');
    } else if (fluid.id === 'seawater') {
      waterGrad.addColorStop(0, '#38bdf8');
      waterGrad.addColorStop(0.25, '#0284c7');
      waterGrad.addColorStop(0.65, '#0369a1');
      waterGrad.addColorStop(1, '#082f49');
    } else {
      // Pure water
      waterGrad.addColorStop(0, '#7dd3fc');
      waterGrad.addColorStop(0.3, '#0284c7');
      waterGrad.addColorStop(0.7, '#0369a1');
      waterGrad.addColorStop(1, '#0c4a6e');
    }

    ctx.fillStyle = waterGrad;
    ctx.fillRect(tankX, waterSurfaceY, tankW, tankH - 34);

    // Underwater Atmospheric Sunlight Caustics Rays
    const time = Date.now() * 0.0015;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tankX, waterSurfaceY, tankW, tankH - 34);
    ctx.clip();

    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      const rayX = tankX + 40 + i * (tankW / 6) + Math.sin(time + i * 1.3) * 25;
      const raySpread = 50 + Math.sin(time * 0.8 + i) * 15;
      ctx.beginPath();
      ctx.moveTo(rayX - 10, waterSurfaceY);
      ctx.lineTo(rayX + 10, waterSurfaceY);
      ctx.lineTo(rayX + raySpread, tankY + tankH);
      ctx.lineTo(rayX - raySpread, tankY + tankH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Upper Atmospheric Air Zone
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(tankX, tankY, tankW, 34);

    // Air chamber pressure readout
    ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = '#0369a1';
    ctx.fillText(`AIR CHAMBER: ${chamberExtraPressureKPa >= 0 ? '+' : ''}${chamberExtraPressureKPa} kPa`, tankX + 15, tankY + 22);

    // Water Surface Meniscus & Wave
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tankX, waterSurfaceY);
    for (let x = tankX; x <= tankX + tankW; x += 12) {
      const wave = Math.sin((x * 0.035) + time * 3) * 2.5;
      ctx.lineTo(x, waterSurfaceY + wave);
    }
    ctx.stroke();

    // Floating Ambient Bubbles with Highlights
    bubblesRef.current.forEach((b) => {
      b.y -= b.speed;
      if (b.y < waterSurfaceY + 8) {
        b.y = tankY + tankH - 10;
        b.x = tankX + 20 + Math.random() * (tankW - 40);
      }
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      // specular dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x - b.size * 0.3, b.y - b.size * 0.3, b.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // ==========================================
    // 2. DEPTH GAUGE SCALE (LEFT RAIL) - CRISP & BOLD
    // ==========================================
    const maxDepthM = 300;
    const depthScale = (tankH - 65) / maxDepthM; // px per meter

    // Stainless steel ruler bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tankX - 4, waterSurfaceY, 4, tankH - 34);

    for (let d = 0; d <= maxDepthM; d += 50) {
      const y = waterSurfaceY + d * depthScale;

      // Tick mark
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tankX - 16, y);
      ctx.lineTo(tankX, y);
      ctx.stroke();

      // Bold High-Contrast Depth Badge
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(tankX - 70, y - 11, 48, 22, 6);
      ctx.fill();

      ctx.font = 'bold 12px JetBrains Mono';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${d}m`, tankX - 46, y + 4);
    }
    ctx.textAlign = 'left'; // reset

    // ==========================================
    // 3. TANK HEAVY GLASS BORDER & FRAME
    // ==========================================
    // Glass refraction highlight
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 6;
    ctx.strokeRect(tankX - 2, tankY - 2, tankW + 4, tankH + 4);

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.strokeRect(tankX, tankY, tankW, tankH);

    // ==========================================
    // 4. SUBMERGED 3D SPHERE PHYSICS & RENDERING
    // ==========================================
    const sphereCenterX = tankX + tankW / 2;
    const sphereCenterY = waterSurfaceY + depth * depthScale;

    // Base visual radius in pixels
    const baseVisualRadiusPx = 56;
    const currentVisualRadiusPx = Math.max(12, baseVisualRadiusPx * radiusRatio);

    // Top Suspension Winch & Heavy Steel Cable
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(sphereCenterX - 18, tankY - 6, 36, 12);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sphereCenterX, tankY + 6);
    ctx.lineTo(sphereCenterX, sphereCenterY - currentVisualRadiusPx);
    ctx.stroke();

    // Winch hook clasp
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(sphereCenterX, sphereCenterY - currentVisualRadiusPx, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 1. Ghost reference outline of original initial volume (V0)
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sphereCenterX, sphereCenterY, baseVisualRadiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (!isImploded && !isBurst) {
      // 3D Ultra-Realistic Spherical Shading with Fresnel Rim & Metallic Sheen
      const r = currentVisualRadiusPx;
      const grad = ctx.createRadialGradient(
        sphereCenterX - r * 0.35,
        sphereCenterY - r * 0.38,
        r * 0.05,
        sphereCenterX,
        sphereCenterY,
        r
      );

      if (sphereMat.id === 'balloon') {
        grad.addColorStop(0, '#ffffff'); // bright specular highlight
        grad.addColorStop(0.2, '#fda4af');
        grad.addColorStop(0.55, '#e11d48');
        grad.addColorStop(0.85, '#881337');
        grad.addColorStop(1, '#4c0519'); // dark deep rim
      } else if (sphereMat.id === 'aluminum_shell') {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, '#e2e8f0');
        grad.addColorStop(0.6, '#94a3b8');
        grad.addColorStop(0.9, '#475569');
        grad.addColorStop(1, '#1e293b');
      } else if (sphereMat.id === 'lead_sphere') {
        grad.addColorStop(0, '#cbd5e1');
        grad.addColorStop(0.3, '#64748b');
        grad.addColorStop(0.7, '#334155');
        grad.addColorStop(1, '#0f172a');
      } else {
        // Rubber sphere
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, '#67e8f9');
        grad.addColorStop(0.65, '#0891b2');
        grad.addColorStop(1, '#164e63');
      }

      // Draw sphere body
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sphereCenterX, sphereCenterY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Outer rim edge definition
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sphereCenterX, sphereCenterY, r, 0, Math.PI * 2);
      ctx.stroke();

      // Primary Specular Reflection Oval (Light reflection)
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(
        sphereCenterX - r * 0.32,
        sphereCenterY - r * 0.35,
        r * 0.28,
        r * 0.18,
        -Math.PI / 4,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();

      // Secondary subtle bottom bounce reflection
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.ellipse(
        sphereCenterX + r * 0.25,
        sphereCenterY + r * 0.35,
        r * 0.35,
        r * 0.12,
        Math.PI / 4,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();

      // ==========================================
      // INWARD CONVERGENT PRESSURE VECTORS
      // ==========================================
      const numVectors = 12;
      const arrowLen = Math.min(42, 14 + (deltaP / 2.5e6) * 28);

      for (let i = 0; i < numVectors; i++) {
        const angle = (i / numVectors) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const startX = sphereCenterX + cos * (r + arrowLen);
        const startY = sphereCenterY + sin * (r + arrowLen);
        const endX = sphereCenterX + cos * (r + 2);
        const endY = sphereCenterY + sin * (r + 2);

        // Bold Green Vector with crisp dark stroke outline
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.strokeStyle = '#10b981';
        ctx.fillStyle = '#10b981';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Arrow Head
        const hLen = 8;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX + cos * hLen - sin * 5, endY + sin * hLen + cos * 5);
        ctx.lineTo(endX + cos * hLen + sin * 5, endY + sin * hLen - cos * 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // ==========================================
      // HIGH-CONTRAST BOLD VOLUME BADGE CARD
      // ==========================================
      const labelY = Math.min(tankY + tankH - 36, sphereCenterY + r + 22);
      const labelText = `V = ${(currentVolumeM3 * 1000).toFixed(2)} L (${(clampedVolumetricStrain >= 0 ? '-' : '+')}${(Math.abs(clampedVolumetricStrain) * 100).toFixed(1)}%)`;

      ctx.save();
      ctx.font = 'bold 13px JetBrains Mono';
      const textMetrics = ctx.measureText(labelText);
      const badgeW = textMetrics.width + 24;
      const badgeH = 26;
      const badgeX = sphereCenterX - badgeW / 2;

      // Dark solid glassmorphic card backdrop
      ctx.fillStyle = '#0f172a';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(badgeX, labelY, badgeW, badgeH, 8);
      ctx.fill();

      // Card border
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Card text
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(labelText, badgeX + 12, labelY + 17);
      ctx.restore();
    } else if (isImploded) {
      // Smooth Multi-Phase Implosion Sequence
      const elapsed = (Date.now() - eventTime) / 1000;
      const smoothProgress = Math.min(1.0, elapsed / 2.5);

      // Phase 1: Rapid inward collapse & shockwave
      const collapseR = Math.max(6, 28 * Math.exp(-elapsed * 4));
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(sphereCenterX, sphereCenterY, collapseR, 0, Math.PI * 2);
      ctx.fill();

      // Expanding concentric acoustic shockwaves in water
      for (let w = 0; w < 3; w++) {
        const waveElapsed = Math.max(0, elapsed - w * 0.15);
        if (waveElapsed > 0) {
          const shockR = Math.min(160, waveElapsed * 160);
          const alpha = Math.max(0, (1 - waveElapsed * 0.7) * 0.6);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sphereCenterX, sphereCenterY, shockR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Smooth cavitation bubble cloud rising upward with water drag
      fragmentsRef.current.forEach((frag) => {
        if (frag.x === 0 && frag.y === 0) {
          frag.x = sphereCenterX;
          frag.y = sphereCenterY;
        }
        // Quadratic water drag & buoyant upward drift
        frag.x += frag.vx * 0.016;
        frag.y += frag.vy * 0.016;
        frag.vx *= 0.95;
        frag.vy = frag.vy * 0.95 - 0.7; // float towards surface
        frag.life -= 0.009;

        if (frag.life > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${frag.life * 0.8})`;
          ctx.beginPath();
          ctx.arc(frag.x, frag.y, Math.max(1, frag.size * frag.life), 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Smoothly fading-in status card
      const bannerAlpha = Math.min(1.0, elapsed * 2);
      ctx.save();
      ctx.globalAlpha = bannerAlpha;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(sphereCenterX - 180, sphereCenterY - 48, 360, 36, 10);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#f87171';
      ctx.textAlign = 'center';
      ctx.fillText(
        lang === 'bn' ? '💥 অতিরিক্ত হাইড্রোস্ট্যাটিক চাপে গোলক চুপসে ফেটে গেছে!' : '💥 Sphere Imploded by Excessive Pressure!',
        sphereCenterX,
        sphereCenterY - 25
      );
      ctx.restore();
      ctx.textAlign = 'left';

    } else if (isBurst) {
      // Smooth Multi-Phase Balloon Burst Sequence
      const elapsed = (Date.now() - eventTime) / 1000;
      const smoothProgress = Math.min(1.0, elapsed / 2.5);

      // Phase 1: Rapid elastic tear and shredding petals (0 to 0.4s)
      if (elapsed < 0.45) {
        const tearExpansion = 1 + elapsed * 2.5;
        const tearAlpha = Math.max(0, 1 - elapsed * 2);
        ctx.save();
        ctx.globalAlpha = tearAlpha;
        // Torn rubber petals peeling outward
        for (let petal = 0; petal < 6; petal++) {
          const ang = (petal / 6) * Math.PI * 2 + elapsed * 3;
          const px = sphereCenterX + Math.cos(ang) * baseVisualRadiusPx * tearExpansion * 0.7;
          const py = sphereCenterY + Math.sin(ang) * baseVisualRadiusPx * tearExpansion * 0.7;
          ctx.fillStyle = sphereMat.color;
          ctx.beginPath();
          ctx.ellipse(px, py, 14 * (1 - elapsed * 1.5), 8, ang, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Smooth acoustic explosion shockwaves
      for (let w = 0; w < 3; w++) {
        const waveElapsed = Math.max(0, elapsed - w * 0.12);
        if (waveElapsed > 0) {
          const shockR = Math.min(180, waveElapsed * 190);
          const alpha = Math.max(0, (1 - waveElapsed * 0.6) * 0.7);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(sphereCenterX, sphereCenterY, shockR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Cavitation bubble plume and rubber fragments dispersing with water drag
      fragmentsRef.current.forEach((frag) => {
        if (frag.x === 0 && frag.y === 0) {
          frag.x = sphereCenterX;
          frag.y = sphereCenterY;
        }
        // Quadratic water resistance
        frag.x += frag.vx * 0.016;
        frag.y += frag.vy * 0.016;
        frag.vx *= 0.94;
        frag.vy = frag.vy * 0.94 - 0.8; // buoyancy float up
        frag.life -= 0.009;

        if (frag.life > 0) {
          ctx.fillStyle = frag.color;
          ctx.globalAlpha = Math.max(0.1, frag.life);
          ctx.beginPath();
          ctx.arc(frag.x, frag.y, Math.max(1, frag.size * frag.life), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });

      // Smoothly fading-in status card
      const bannerAlpha = Math.min(1.0, elapsed * 2);
      ctx.save();
      ctx.globalAlpha = bannerAlpha;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(sphereCenterX - 170, sphereCenterY - 48, 340, 36, 10);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.fillText(
        lang === 'bn' ? '💥 শূন্য চাপে প্রসারিত হয়ে বিস্ফোরিত!' : '💥 Sphere Burst violently under Vacuum!',
        sphereCenterX,
        sphereCenterY - 25
      );
      ctx.restore();
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }, [fluid, sphereMat, depth, deltaP, radiusRatio, currentVolumeM3, clampedVolumetricStrain, isImploded, isBurst, eventTime, lang, chamberExtraPressureKPa]);

  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      drawChamber();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      active = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawChamber]);

  // Pointer interaction: smoothly drag anywhere in canvas to move sphere up/down!
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isImploded || isBurst) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartDepthRef.current = depth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || isImploded || isBurst) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tankH = rect.height - 44;
    const depthScale = (tankH - 65) / 300;

    const dy = e.clientY - dragStartYRef.current;
    const deltaDepth = dy / depthScale;
    const newDepth = Math.max(0, Math.min(300, dragStartDepthRef.current + deltaDepth));
    setDepth(Math.round(newDepth));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full h-full">
      {/* LEFT SIDEBAR (Fixed 330px width) */}
      <aside className="w-full lg:w-[330px] shrink-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-4 flex flex-col gap-4 text-slate-950">
        <div>
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
            {t.common.controls}
          </h2>
          <p className="text-[11px] text-slate-700 font-medium mt-0.5">{t.m2.subtitle}</p>
        </div>

        {/* Fluid selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-900">{t.m2.fluidType}</label>
          <div className="grid grid-cols-2 gap-1.5">
            {FLUID_TYPES.map((fl) => {
              const isSelected = fluid.id === fl.id;
              return (
                <button
                  key={fl.id}
                  onClick={() => setFluid(fl)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                    isSelected
                      ? 'bg-sky-700 text-white shadow-xs'
                      : 'bg-sky-50 text-slate-900 hover:bg-sky-100 border border-sky-300'
                  }`}
                >
                  <span className="truncate">{lang === 'bn' ? fl.nameBn.split(' ')[0] : fl.nameEn.split(' ')[0]}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-sky-100' : 'text-slate-600'}`}>
                    ρ = {fl.density} kg/m³
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sphere Material Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-900">{t.m2.sphereType}</label>
          <div className="grid grid-cols-2 gap-1.5">
            {SPHERE_MATERIALS.map((sp) => {
              const isSelected = sphereMat.id === sp.id;
              return (
                <button
                  key={sp.id}
                  onClick={() => {
                    setSphereMat(sp);
                    handleResetSphere();
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-emerald-50 text-slate-900 hover:bg-emerald-100 border border-emerald-300'
                  }`}
                >
                  <span className="truncate">{lang === 'bn' ? sp.nameBn.split(' ')[0] : sp.nameEn.split(' ')[0]}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-emerald-100' : 'text-slate-600'}`}>
                    K = {(sp.bulkModulus / 1e9).toFixed(2)} GPa
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders with Progressive Green Fill */}
        <div className="flex flex-col gap-3 pt-2 border-t border-sky-100">
          <ProgressiveSlider
            label={t.m2.depth}
            value={depth}
            min={0}
            max={300}
            step={5}
            unit="m"
            disabled={isImploded || isBurst}
            valueFormatter={(v) => `${v} m`}
            onChange={setDepth}
          />

          <ProgressiveSlider
            label={t.m2.externalPressure}
            value={chamberExtraPressureKPa}
            min={-100}
            max={500}
            step={20}
            unit="kPa"
            disabled={isImploded || isBurst}
            valueFormatter={(v) => `${v > 0 ? '+' : ''}${v} kPa`}
            onChange={setChamberExtraPressureKPa}
          />
        </div>

        {/* Reset / Restore Button */}
        <div className="pt-2 border-t border-sky-100">
          <button
            onClick={handleResetSphere}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-100 hover:bg-sky-200 text-sky-950 border border-sky-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-4 h-4 text-sky-700" />
            <span>{t.m2.restoreSphere}</span>
          </button>
        </div>

        {/* Governing Formulas Box */}
        <div className="mt-auto bg-sky-50 rounded-xl p-3 border border-sky-200 text-xs">
          <div className="font-bold text-slate-950 mb-1.5 flex items-center justify-between">
            <span>{t.common.formulas}</span>
            <span className="text-[10px] text-sky-800 font-mono font-bold">Bulk Modulus</span>
          </div>
          <div className="font-mono text-[11px] text-slate-900 font-semibold space-y-1 leading-relaxed">
            <div>ΔP = ρ·g·h + P_ext</div>
            <div>εᵥ = ΔV / V₀ = ΔP / K</div>
            <div>K = - ΔP / (ΔV / V₀)</div>
            <div>C = 1 / K (সংকোচনশীলতা)</div>
          </div>
        </div>
      </aside>

      {/* CENTER WORKSPACE (Flexible Canvas) */}
      <main className="flex-1 min-w-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-3.5 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-950">{t.common.workspace}</span>
            <span className="text-[11px] text-sky-800 font-bold hidden sm:inline flex items-center gap-1">
              <MoveVertical className="w-3.5 h-3.5 text-sky-600" />
              {lang === 'bn' ? 'মাউস দিয়ে গোলক টেনে যেকোনো গভীরতায় নিয়ে যান' : 'Drag sphere up/down anywhere in chamber'}
            </span>
          </div>

          {/* Status Badge */}
          {isImploded ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 border border-red-300 rounded-full text-xs font-bold shadow-xs">
              <AlertOctagon className="w-4 h-4 text-red-600 animate-pulse" />
              <span>{t.m2.imploded}</span>
            </div>
          ) : isBurst ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{t.m2.burst}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-bold shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'bn' ? 'স্থিতিস্থাপক আয়তন সাম্যাবস্থা' : 'Stable Hydrostatic Equilibrium'}</span>
            </div>
          )}
        </div>

        {/* Canvas viewport container */}
        <div ref={containerRef} className="relative flex-1 w-full min-h-[420px] rounded-xl overflow-hidden border border-sky-200/90 bg-slate-50">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full block cursor-ns-resize touch-none"
          />
        </div>
      </main>

      {/* RIGHT TELEMETRY PANEL (320px width) */}
      <aside className="w-full lg:w-[320px] shrink-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-4 flex flex-col gap-3 text-slate-950">
        <div>
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
            {t.common.telemetry}
          </h2>
          <p className="text-[11px] text-slate-700 font-medium mt-0.5">{lang === 'bn' ? 'হাইড্রোস্ট্যাটিক চাপ ও আয়তন বিকৃতি' : 'Hydrostatic & Bulk Telemetry'}</p>
        </div>

        {/* Primary Gauges */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 flex flex-col">
            <span className="text-[11px] font-bold text-slate-800">{t.m2.hydrostaticStress}</span>
            <span className="font-mono text-lg font-extrabold text-slate-950 mt-1 tabular-nums">
              {(deltaP / 1e6).toFixed(3)}
            </span>
            <span className="text-[10px] text-sky-800 font-bold font-mono">MPa (10⁶ Pa)</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col">
            <span className="text-[11px] font-bold text-slate-800">{t.m2.volumetricStrain}</span>
            <span className="font-mono text-lg font-extrabold text-emerald-900 mt-1 tabular-nums">
              {(clampedVolumetricStrain * 100).toFixed(3)} %
            </span>
            <span className="text-[10px] text-emerald-800 font-bold font-mono">εᵥ = ΔV/V₀</span>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m2.bulkModulus} (K):</span>
            <span className="font-mono font-bold text-slate-950 tabular-nums">
              {(sphereMat.bulkModulus / 1e9).toFixed(2)} GPa
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m2.compressibility} (C):</span>
            <span className="font-mono font-bold text-sky-900 tabular-nums">
              {(compressibility * 1e9).toFixed(3)} × 10⁻⁹ Pa⁻¹
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m2.initialVolume} (V₀):</span>
            <span className="font-mono font-bold text-slate-950 tabular-nums">
              {(initialVolumeM3 * 1000).toFixed(2)} L
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m2.currentVolume} (V):</span>
            <span className="font-mono font-bold text-emerald-900 tabular-nums">
              {(currentVolumeM3 * 1000).toFixed(2)} L
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m2.deltaV}:</span>
            <span className="font-mono font-bold text-amber-800 tabular-nums">
              {(deltaVolumeM3 * 1000).toFixed(3)} L
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-800 font-semibold">Crushing Depth:</span>
            <span className="font-mono font-bold text-red-700 tabular-nums">
              {(sphereMat.crushPressure / (fluid.density * g)).toFixed(0)} m ({ (sphereMat.crushPressure / 1e6).toFixed(2) } MPa)
            </span>
          </div>
        </div>

        {/* Compression Pressure Meter */}
        <div className="flex flex-col gap-1.5 p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs">
          <div className="flex justify-between text-[11px] font-bold text-slate-900">
            <span>চাপ সহনশীলতা অনুপাত (Pressure Head)</span>
            <span className="font-mono font-bold">
              {((deltaP / sphereMat.crushPressure) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden relative">
            <div
              className={`h-full transition-all duration-150 ${
                deltaP > sphereMat.crushPressure * 0.8 ? 'bg-red-600' : 'bg-sky-600'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, (deltaP / sphereMat.crushPressure) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-700 font-bold font-mono">
            <span>০ kPa</span>
            <span>গভীরতা: {depth}m</span>
            <span>ইমপ্লোশন সীমা</span>
          </div>
        </div>
      </aside>
    </div>
  );
};
