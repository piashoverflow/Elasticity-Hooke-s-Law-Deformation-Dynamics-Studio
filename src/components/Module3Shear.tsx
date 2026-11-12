import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, ShearMaterial } from '../types/physics';
import { translations } from '../utils/translations';
import { ProgressiveSlider } from './ProgressiveSlider';
import { RotateCcw, AlertTriangle, ShieldCheck, Flame, MoveHorizontal, Box, Square } from 'lucide-react';

const SHEAR_MATERIALS: ShearMaterial[] = [
  {
    id: 'orange_alloy',
    nameBn: 'হালকা কমলা মেটাল (Light Orange Block)',
    nameEn: 'Light Orange Metal Block',
    shearModulus: 48e9, // 48 GPa
    ultimateShearStress: 180e6, // 180 MPa
    color: '#fb923c',
  },
  {
    id: 'structural_steel',
    nameBn: 'স্ট্রাকচারাল স্টিল (Structural Steel)',
    nameEn: 'Structural Steel Block',
    shearModulus: 78e9, // 78 GPa
    ultimateShearStress: 220e6, // 220 MPa
    color: '#64748b',
  },
  {
    id: 'oak_wood',
    nameBn: 'ওক কাঠ (Solid Hardwood Grain)',
    nameEn: 'Solid Hardwood Grain',
    shearModulus: 1.2e9, // 1.2 GPa
    ultimateShearStress: 14e6, // 14 MPa
    color: '#d97706',
  },
  {
    id: 'silicone_rubber',
    nameBn: 'নরম সিলিকন (Translucent Gel / Silicone)',
    nameEn: 'Soft Translucent Silicone',
    shearModulus: 0.005e9, // 5 MPa
    ultimateShearStress: 0.09e6, // 90 kPa
    color: '#06b6d4',
  },
];

interface Module3Props {
  lang: Language;
}

export const Module3Shear: React.FC<Module3Props> = ({ lang }) => {
  const t = translations[lang];

  // Parameters
  const [material, setMaterial] = useState<ShearMaterial>(SHEAR_MATERIALS[0]);
  const [tangentialForceKN, setTangentialForceKN] = useState<number>(380); // kN
  const [blockHeightCm, setBlockHeightCm] = useState<number>(20); // cm
  const [topAreaCm2, setTopAreaCm2] = useState<number>(100); // cm^2
  const [isFractured, setIsFractured] = useState<boolean>(false);
  const [fractureTime, setFractureTime] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartForceRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  // Physical calculations
  const forceN = tangentialForceKN * 1000; // N
  const areaM2 = (topAreaCm2 * 1e-4); // m^2
  const heightM = blockHeightCm * 0.01; // m
  const shearStress = forceN / areaM2; // Pa (N/m^2)
  const absShearStress = Math.abs(shearStress);

  // Shear strain θ = τ / η
  const shearStrain = shearStress / material.shearModulus; // radians
  const lateralShiftM = shearStrain * heightM; // x = θ * h (in meters)
  const lateralShiftMm = lateralShiftM * 1000; // mm
  const shearAngleDeg = (shearStrain * 180) / Math.PI;

  // Check fracture threshold
  useEffect(() => {
    if (isFractured) return;
    if (absShearStress >= material.ultimateShearStress) {
      setIsFractured(true);
      setFractureTime(Date.now());
    }
  }, [absShearStress, material, isFractured]);

  const handleResetBlock = () => {
    setIsFractured(false);
    setTangentialForceKN(0);
  };

  // High-DPI realistic canvas rendering
  const drawShear = useCallback(() => {
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

    // Canvas Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Laboratory grid
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

    // Geometry layout: Taller and more aesthetic proportions (height > width)
    const blockBaseW = 230; // Elegant, sleek width
    const blockH = Math.min(275, Math.max(170, blockHeightCm * 13.0)); // Taller block (lomba)
    const visualScale = material.id === 'silicone_rubber' ? 24 : 85;
    const visualShiftPx = isFractured ? 150 : Math.max(-125, Math.min(125, lateralShiftMm * visualScale));

    // =========================================================================
    // BRANCH: 3D ISOMETRIC VIEW
    // =========================================================================
    if (viewMode === '3d') {
      const baseY = height - 58;
      const blockBaseX = (width - blockBaseW) / 2 - 28;
      const depthDx = 68;
      const depthDy = -34;
      const topY = baseY - blockH;

      // 3D PLATFORM (Precision testing bed)
      const platPadLeft = 46;
      const platPadRight = 56;
      const platFrontY = 15;
      const platDepthDx = depthDx + 26; // 94
      const platDepthDy = depthDy - 12; // -46
      const platThickness = 18; // Height of the slab

      // Platform corners
      const surfFL = { x: blockBaseX - platPadLeft, y: baseY + platFrontY };
      const surfFR = { x: blockBaseX + blockBaseW + platPadRight, y: baseY + platFrontY };
      const surfBR = { x: surfFR.x + platDepthDx, y: surfFR.y + platDepthDy };
      const surfBL = { x: surfFL.x + platDepthDx, y: surfFL.y + platDepthDy };

      // Platform Drop Shadow
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
      ctx.beginPath();
      ctx.moveTo(surfFL.x + 8, surfFL.y + platThickness + 5);
      ctx.lineTo(surfFR.x + 12, surfFR.y + platThickness + 5);
      ctx.lineTo(surfBR.x + 12, surfBR.y + platThickness + 5);
      ctx.lineTo(surfBL.x + 8, surfBL.y + platThickness + 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Platform Top Face
      const platTopGrad = ctx.createLinearGradient(surfBL.x, surfBL.y, surfFR.x, surfFR.y);
      platTopGrad.addColorStop(0, '#e2e8f0');
      platTopGrad.addColorStop(0.35, '#cbd5e1');
      platTopGrad.addColorStop(0.85, '#94a3b8');
      platTopGrad.addColorStop(1, '#64748b');

      ctx.beginPath();
      ctx.moveTo(surfFL.x, surfFL.y);
      ctx.lineTo(surfFR.x, surfFR.y);
      ctx.lineTo(surfBR.x, surfBR.y);
      ctx.lineTo(surfBL.x, surfBL.y);
      ctx.closePath();
      ctx.fillStyle = platTopGrad;
      ctx.fill();

      // Perspective grid on top of platform
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(surfFL.x, surfFL.y);
      ctx.lineTo(surfFR.x, surfFR.y);
      ctx.lineTo(surfBR.x, surfBR.y);
      ctx.lineTo(surfBL.x, surfBL.y);
      ctx.closePath();
      ctx.clip();

      ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = 1;
      const numRays = 10;
      for (let g = 0; g <= numRays; g++) {
        const t = g / numRays;
        const sx = surfFL.x + t * (surfFR.x - surfFL.x);
        const sy = surfFL.y;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + platDepthDx, sy + platDepthDy);
        ctx.stroke();
      }
      const numTrans = 5;
      for (let h = 1; h < numTrans; h++) {
        const t = h / numTrans;
        const xL = surfFL.x + t * platDepthDx;
        const yL = surfFL.y + t * platDepthDy;
        const xR = surfFR.x + t * platDepthDx;
        const yR = surfFR.y + t * platDepthDy;
        ctx.beginPath();
        ctx.moveTo(xL, yL);
        ctx.lineTo(xR, yR);
        ctx.stroke();
      }

      // Contact shadow of the box on platform
      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.beginPath();
      ctx.moveTo(blockBaseX - 2, baseY + 2);
      ctx.lineTo(blockBaseX + blockBaseW + 4, baseY + 2);
      ctx.lineTo(blockBaseX + blockBaseW + depthDx + 4, baseY + depthDy + 2);
      ctx.lineTo(blockBaseX + depthDx - 2, baseY + depthDy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Platform Front Face
      const platFrontGrad = ctx.createLinearGradient(surfFL.x, surfFL.y, surfFL.x, surfFL.y + platThickness);
      platFrontGrad.addColorStop(0, '#475569');
      platFrontGrad.addColorStop(0.5, '#334155');
      platFrontGrad.addColorStop(1, '#1e293b');
      ctx.beginPath();
      ctx.moveTo(surfFL.x, surfFL.y);
      ctx.lineTo(surfFR.x, surfFR.y);
      ctx.lineTo(surfFR.x, surfFR.y + platThickness);
      ctx.lineTo(surfFL.x, surfFL.y + platThickness);
      ctx.closePath();
      ctx.fillStyle = platFrontGrad;
      ctx.fill();

      // Highlight line
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(surfFL.x, surfFL.y);
      ctx.lineTo(surfFR.x, surfFR.y);
      ctx.stroke();

      // Platform Right Side Face
      const platSideGrad = ctx.createLinearGradient(surfFR.x, surfFR.y, surfBR.x, surfBR.y);
      platSideGrad.addColorStop(0, '#334155');
      platSideGrad.addColorStop(1, '#0f172a');
      ctx.beginPath();
      ctx.moveTo(surfFR.x, surfFR.y);
      ctx.lineTo(surfBR.x, surfBR.y);
      ctx.lineTo(surfBR.x, surfBR.y + platThickness);
      ctx.lineTo(surfFR.x, surfFR.y + platThickness);
      ctx.closePath();
      ctx.fillStyle = platSideGrad;
      ctx.fill();

      // Clamping sockets
      const anchors = [
        { x: blockBaseX + 24, y: baseY + 4 },
        { x: blockBaseX + 90, y: baseY + 4 },
        { x: blockBaseX + 155, y: baseY + 4 },
        { x: blockBaseX + blockBaseW - 24, y: baseY + 4 },
        { x: blockBaseX + blockBaseW + depthDx * 0.45, y: baseY + depthDy * 0.45 + 4 },
      ];
      anchors.forEach(pt => {
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      });

      // Ghost original resting outline when sheared
      if (Math.abs(visualShiftPx) > 4) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(blockBaseX, topY, blockBaseW, blockH);
        ctx.restore();
      }

      if (!isFractured) {
        const p1 = { x: blockBaseX, y: baseY }; // Bottom-left
        const p2 = { x: blockBaseX + blockBaseW, y: baseY }; // Bottom-right
        const p3 = { x: blockBaseX + blockBaseW + visualShiftPx, y: topY }; // Top-right
        const p4 = { x: blockBaseX + visualShiftPx, y: topY }; // Top-left

        const p3Top = { x: p3.x + depthDx, y: p3.y + depthDy };
        const p4Top = { x: p4.x + depthDx, y: p4.y + depthDy };
        const p2Side = { x: p2.x + depthDx, y: p2.y + depthDy };

        // TOP FACE (Warm light orange highlight, NO black line)
        ctx.beginPath();
        ctx.moveTo(p4.x, p4.y);
        ctx.lineTo(p4Top.x, p4Top.y);
        ctx.lineTo(p3Top.x, p3Top.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();

        const topGrad = ctx.createLinearGradient(p4.x, p4.y, p3Top.x, p3Top.y);
        if (material.id === 'orange_alloy') {
          topGrad.addColorStop(0, '#fffbf5');
          topGrad.addColorStop(0.35, '#ffedd5');
          topGrad.addColorStop(0.75, '#fed7aa');
          topGrad.addColorStop(1, '#fdba74');
        } else if (material.id === 'oak_wood') {
          topGrad.addColorStop(0, '#fef3c7');
          topGrad.addColorStop(1, '#fde68a');
        } else if (material.id === 'silicone_rubber') {
          topGrad.addColorStop(0, '#cffafe');
          topGrad.addColorStop(1, '#a5f3fc');
        } else {
          topGrad.addColorStop(0, '#f1f5f9');
          topGrad.addColorStop(1, '#cbd5e1');
        }
        ctx.fillStyle = topGrad;
        ctx.fill();
        ctx.strokeStyle = material.id === 'orange_alloy' ? '#f97316' : '#64748b';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // RIGHT SIDE FACE
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p3Top.x, p3Top.y);
        ctx.lineTo(p2Side.x, p2Side.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();

        const sideGrad = ctx.createLinearGradient(p3.x, p3.y, p2Side.x, p2Side.y);
        if (material.id === 'orange_alloy') {
          sideGrad.addColorStop(0, '#fed7aa');
          sideGrad.addColorStop(0.45, '#fdba74');
          sideGrad.addColorStop(1, '#fb923c');
        } else if (material.id === 'oak_wood') {
          sideGrad.addColorStop(0, '#d97706');
          sideGrad.addColorStop(1, '#b45309');
        } else if (material.id === 'silicone_rubber') {
          sideGrad.addColorStop(0, '#06b6d4');
          sideGrad.addColorStop(1, '#0891b2');
        } else {
          sideGrad.addColorStop(0, '#64748b');
          sideGrad.addColorStop(1, '#475569');
        }
        ctx.fillStyle = sideGrad;
        ctx.fill();
        ctx.strokeStyle = material.id === 'orange_alloy' ? '#ea580c' : '#475569';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // FRONT PARALLELOGRAM FACE (Light Orange)
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();

        const frontGrad = ctx.createLinearGradient(p4.x, p4.y, p2.x, p2.y);
        if (material.id === 'orange_alloy') {
          frontGrad.addColorStop(0, '#fff7ed');
          frontGrad.addColorStop(0.25, '#ffedd5');
          frontGrad.addColorStop(0.65, '#fed7aa');
          frontGrad.addColorStop(1, '#fdba74');
        } else if (material.id === 'oak_wood') {
          frontGrad.addColorStop(0, '#fef08a');
          frontGrad.addColorStop(0.5, '#fcd34d');
          frontGrad.addColorStop(1, '#f59e0b');
        } else if (material.id === 'silicone_rubber') {
          frontGrad.addColorStop(0, '#e0f2fe');
          frontGrad.addColorStop(0.5, '#bae6fd');
          frontGrad.addColorStop(1, '#7dd3fc');
        } else {
          frontGrad.addColorStop(0, '#f8fafc');
          frontGrad.addColorStop(0.5, '#e2e8f0');
          frontGrad.addColorStop(1, '#cbd5e1');
        }
        ctx.fillStyle = frontGrad;
        ctx.fill();
        ctx.strokeStyle = material.id === 'orange_alloy' ? '#ea580c' : '#475569';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Subtle internal lattice grid
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.clip();

        ctx.strokeStyle = material.id === 'orange_alloy' ? 'rgba(234, 88, 12, 0.22)' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.2;
        const numLayers = 7;
        for (let i = 1; i < numLayers; i++) {
          const u = i / numLayers;
          const ly = baseY - u * blockH;
          const lx1 = blockBaseX + u * visualShiftPx;
          const lx2 = blockBaseX + blockBaseW + u * visualShiftPx;
          ctx.beginPath();
          ctx.moveTo(lx1, ly);
          ctx.lineTo(lx2, ly);
          ctx.stroke();
        }
        const numCols = 6;
        for (let j = 1; j < numCols; j++) {
          const v = j / numCols;
          const bx = blockBaseX + v * blockBaseW;
          const tx = blockBaseX + v * blockBaseW + visualShiftPx;
          ctx.beginPath();
          ctx.moveTo(bx, baseY);
          ctx.lineTo(tx, topY);
          ctx.stroke();
        }
        ctx.restore();

        // TANGENTIAL FORCE ARROW (Fs) - Floating emerald vector
        if (Math.abs(tangentialForceKN) > 1) {
          const dir = tangentialForceKN > 0 ? 1 : -1;
          const arrowLen = Math.min(150, 45 + (Math.abs(tangentialForceKN) / 700) * 105);
          const startX = p4.x + blockBaseW / 2;
          const endX = startX + dir * arrowLen;
          const arrowY = p4.y - 18;

          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(startX, arrowY);
          ctx.lineTo(endX, arrowY);
          ctx.stroke();

          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.moveTo(endX, arrowY);
          ctx.lineTo(endX - dir * 14, arrowY - 6.5);
          ctx.lineTo(endX - dir * 14, arrowY + 6.5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#047857';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          const forceBadgeText = `Fs = ${tangentialForceKN > 0 ? '+' : ''}${tangentialForceKN.toFixed(0)} kN`;
          ctx.font = 'bold 12px JetBrains Mono';
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(startX + (endX - startX) / 2 - 45, arrowY - 26, 90, 22, 6);
          ctx.fill();
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#10b981';
          ctx.textAlign = 'center';
          ctx.fillText(forceBadgeText, startX + (endX - startX) / 2, arrowY - 11);
          ctx.textAlign = 'left';
        }

        // SHEAR ANGLE ARC (θ)
        if (Math.abs(visualShiftPx) > 3) {
          const arcRadius = 46;
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          const baseAngle = -Math.PI / 2;
          const tiltAngle = Math.atan2(-blockH, visualShiftPx);
          ctx.arc(blockBaseX, baseY, arcRadius, baseAngle, tiltAngle, visualShiftPx < 0);
          ctx.stroke();

          const angleBadgeText = `θ = ${Math.abs(shearAngleDeg).toFixed(2)}° (${Math.abs(shearStrain).toFixed(4)} rad)`;
          ctx.font = 'bold 12px JetBrains Mono';
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(blockBaseX + 16, baseY - arcRadius - 26, 175, 24, 6);
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#f59e0b';
          ctx.fillText(angleBadgeText, blockBaseX + 24, baseY - arcRadius - 10);
        }

        // LATERAL SHIFT INDICATOR (x)
        if (Math.abs(visualShiftPx) > 3) {
          const dimY = topY - 32;
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(blockBaseX, dimY);
          ctx.lineTo(blockBaseX + visualShiftPx, dimY);
          ctx.stroke();

          const shiftText = `x = ${lateralShiftMm.toFixed(2)} mm`;
          ctx.font = 'bold 12px JetBrains Mono';
          ctx.fillStyle = '#0f172a';
          const shiftBadgeX = blockBaseX + visualShiftPx / 2 - 45;
          ctx.beginPath();
          ctx.roundRect(shiftBadgeX, dimY - 24, 90, 20, 5);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText(shiftText, shiftBadgeX + 45, dimY - 10);
          ctx.textAlign = 'left';
        }
      } else {
        // 3D Fracture Rupture
        const elapsed = (Date.now() - fractureTime) / 1000;
        const slide = Math.min(105, elapsed * 115);

        ctx.beginPath();
        ctx.moveTo(blockBaseX, baseY);
        ctx.lineTo(blockBaseX + blockBaseW, baseY);
        ctx.lineTo(blockBaseX + blockBaseW, baseY - blockH * 0.45);
        ctx.lineTo(blockBaseX, baseY - blockH * 0.15);
        ctx.closePath();
        ctx.fillStyle = material.color;
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        const topSlideX = blockBaseX + 50 + slide;
        const topSlideY = topY + slide * 0.35;
        ctx.beginPath();
        ctx.moveTo(topSlideX, topSlideY + blockH * 0.85);
        ctx.lineTo(topSlideX + blockBaseW, topSlideY + blockH * 0.55);
        ctx.lineTo(topSlideX + blockBaseW, topSlideY);
        ctx.lineTo(topSlideX, topSlideY);
        ctx.closePath();
        ctx.fillStyle = '#991b1b';
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(blockBaseX, baseY - blockH * 0.15);
        ctx.lineTo(blockBaseX + blockBaseW, baseY - blockH * 0.45);
        ctx.stroke();

        // Warning banner
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(width / 2 - 180, 22, 360, 36, 10);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = 'bold 15px Plus Jakarta Sans, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(
          lang === 'bn' ? '⚠️ ব্যবৰ্তন ফাটল ও খণ্ডন! (Shear Fracture)' : '⚠️ Mechanical Shear Fracture & Rupture!',
          width / 2,
          45
        );
        ctx.textAlign = 'left';
      }
    } else {
      // =========================================================================
      // BRANCH: 2D TEXTBOOK DIAGRAM (পাঠ্যবইয়ের ক্রস-সেকশন ডায়াগ্রাম)
      // =========================================================================
      const baseY = height - 68;
      const blockBaseX = (width - blockBaseW) / 2 + 10;
      const topY = baseY - blockH;

      // 1. Engineering Fixed Ground Base (দৃঢ় তল / No-Slip Baseline)
      const baseLineLeft = blockBaseX - 55;
      const baseLineRight = blockBaseX + blockBaseW + 55;

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(baseLineLeft, baseY);
      ctx.lineTo(baseLineRight, baseY);
      ctx.stroke();

      // Engineering 45-degree diagonal ground hatch marks (///)
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.6;
      for (let hx = baseLineLeft + 5; hx <= baseLineRight; hx += 14) {
        ctx.beginPath();
        ctx.moveTo(hx, baseY);
        ctx.lineTo(hx - 12, baseY + 14);
        ctx.stroke();
      }

      // Ground Label
      ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.fillText(
        lang === 'bn' ? 'দৃঢ়ভাবে আবদ্ধ তল (Fixed Base / No Slip)' : 'Rigid Fixed Base (No Slip Surface)',
        (baseLineLeft + baseLineRight) / 2,
        baseY + 32
      );
      ctx.textAlign = 'left';

      // 2. Resting Undeformed Rectangular Outline (ABCD) in dashed lines
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(blockBaseX, topY, blockBaseW, blockH);
      ctx.restore();

      // Labels for original corners A, B, C, D
      ctx.font = 'bold 13px JetBrains Mono, monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('A', blockBaseX - 16, baseY + 4);
      ctx.fillText('B', blockBaseX + blockBaseW + 6, baseY + 4);
      ctx.fillText('D', blockBaseX - 16, topY - 4);
      ctx.fillText('C', blockBaseX + blockBaseW + 6, topY - 4);

      if (!isFractured) {
        // 3. Deformed Sheared Parallelogram (ABC'D')
        const pA = { x: blockBaseX, y: baseY };
        const pB = { x: blockBaseX + blockBaseW, y: baseY };
        const pCPrime = { x: blockBaseX + blockBaseW + visualShiftPx, y: topY };
        const pDPrime = { x: blockBaseX + visualShiftPx, y: topY };

        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.lineTo(pCPrime.x, pCPrime.y);
        ctx.lineTo(pDPrime.x, pDPrime.y);
        ctx.closePath();

        const grad2D = ctx.createLinearGradient(pDPrime.x, pDPrime.y, pB.x, pB.y);
        if (material.id === 'orange_alloy') {
          grad2D.addColorStop(0, '#fff7ed');
          grad2D.addColorStop(0.3, '#ffedd5');
          grad2D.addColorStop(0.7, '#fed7aa');
          grad2D.addColorStop(1, '#fdba74');
        } else if (material.id === 'oak_wood') {
          grad2D.addColorStop(0, '#fef08a');
          grad2D.addColorStop(1, '#f59e0b');
        } else if (material.id === 'silicone_rubber') {
          grad2D.addColorStop(0, '#e0f2fe');
          grad2D.addColorStop(1, '#7dd3fc');
        } else {
          grad2D.addColorStop(0, '#f8fafc');
          grad2D.addColorStop(1, '#cbd5e1');
        }
        ctx.fillStyle = grad2D;
        ctx.fill();

        ctx.strokeStyle = material.id === 'orange_alloy' ? '#ea580c' : '#334155';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Corner labels D' and C'
        ctx.font = 'bold 14px JetBrains Mono, monospace';
        ctx.fillStyle = '#ea580c';
        ctx.fillText("D'", pDPrime.x - (visualShiftPx >= 0 ? 18 : -6), topY - 6);
        ctx.fillText("C'", pCPrime.x + 8, topY - 6);

        // 4. Laminar Shear Slip Lines (অনুভূমিক স্তরগুলোর আপেক্ষিক সরণ)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.lineTo(pCPrime.x, pCPrime.y);
        ctx.lineTo(pDPrime.x, pDPrime.y);
        ctx.closePath();
        ctx.clip();

        ctx.strokeStyle = material.id === 'orange_alloy' ? 'rgba(234, 88, 12, 0.28)' : 'rgba(100, 116, 139, 0.25)';
        ctx.lineWidth = 1.3;
        const numLayers2D = 8;
        for (let i = 1; i < numLayers2D; i++) {
          const u = i / numLayers2D;
          const ly = baseY - u * blockH;
          const lx1 = blockBaseX + u * visualShiftPx;
          const lx2 = blockBaseX + blockBaseW + u * visualShiftPx;
          ctx.beginPath();
          ctx.moveTo(lx1, ly);
          ctx.lineTo(lx2, ly);
          ctx.stroke();
        }
        ctx.restore();

        // 5. Vertical Height Dimension Bar (h) on the left
        const dimX = blockBaseX - 38;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.8;

        // Leader tick lines
        ctx.beginPath();
        ctx.moveTo(blockBaseX - 48, topY);
        ctx.lineTo(blockBaseX - 10, topY);
        ctx.moveTo(blockBaseX - 48, baseY);
        ctx.lineTo(blockBaseX - 10, baseY);
        ctx.stroke();

        // Vertical dimension line
        ctx.beginPath();
        ctx.moveTo(dimX, topY + 6);
        ctx.lineTo(dimX, baseY - 6);
        ctx.stroke();

        // Arrows for h
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(dimX, topY);
        ctx.lineTo(dimX - 4, topY + 8);
        ctx.lineTo(dimX + 4, topY + 8);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(dimX, baseY);
        ctx.lineTo(dimX - 4, baseY - 8);
        ctx.lineTo(dimX + 4, baseY - 8);
        ctx.closePath();
        ctx.fill();

        // Height badge
        const heightText = `h = ${blockHeightCm} cm`;
        ctx.font = 'bold 11px JetBrains Mono';
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(dimX - 42, (topY + baseY) / 2 - 12, 84, 22, 5);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(heightText, dimX, (topY + baseY) / 2 + 3);
        ctx.textAlign = 'left';

        // 6. Top Lateral Shift Dimension (x = DD')
        if (Math.abs(visualShiftPx) > 3) {
          const shiftDimY = topY - 26;
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;

          // Vertical tick markers from D and D'
          ctx.beginPath();
          ctx.moveTo(blockBaseX, topY - 8);
          ctx.lineTo(blockBaseX, shiftDimY - 6);
          ctx.moveTo(pDPrime.x, topY - 8);
          ctx.lineTo(pDPrime.x, shiftDimY - 6);
          ctx.stroke();

          // Horizontal dimension line with double arrows
          ctx.beginPath();
          ctx.moveTo(blockBaseX, shiftDimY);
          ctx.lineTo(pDPrime.x, shiftDimY);
          ctx.stroke();

          // Displacement Badge
          const shiftText2D = `x = ${lateralShiftMm.toFixed(2)} mm`;
          ctx.font = 'bold 12px JetBrains Mono';
          ctx.fillStyle = '#0f172a';
          const shiftMidX = (blockBaseX + pDPrime.x) / 2;
          ctx.beginPath();
          ctx.roundRect(shiftMidX - 46, shiftDimY - 26, 92, 22, 6);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText(shiftText2D, shiftMidX, shiftDimY - 11);
          ctx.textAlign = 'left';
        }

        // 7. Tangential Shear Force Vector (Fs) along top face
        if (Math.abs(tangentialForceKN) > 1) {
          const dir = tangentialForceKN > 0 ? 1 : -1;
          const arrowLen = Math.min(150, 50 + (Math.abs(tangentialForceKN) / 700) * 100);
          const fStartX = pDPrime.x + blockBaseW / 2;
          const fEndX = fStartX + dir * arrowLen;
          const fY = topY;

          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(fStartX, fY);
          ctx.lineTo(fEndX, fY);
          ctx.stroke();

          // Arrow head
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.moveTo(fEndX, fY);
          ctx.lineTo(fEndX - dir * 16, fY - 7);
          ctx.lineTo(fEndX - dir * 16, fY + 7);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#047857';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Force badge
          const forceBadgeText = `Fs = ${tangentialForceKN > 0 ? '+' : ''}${tangentialForceKN.toFixed(0)} kN`;
          ctx.font = 'bold 12px JetBrains Mono';
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(fStartX + (fEndX - fStartX) / 2 - 45, fY - 32, 90, 22, 6);
          ctx.fill();
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#10b981';
          ctx.textAlign = 'center';
          ctx.fillText(forceBadgeText, fStartX + (fEndX - fStartX) / 2, fY - 17);
          ctx.textAlign = 'left';
        }

        // 8. Shear Angle Arc (θ) at vertex A
        if (Math.abs(visualShiftPx) > 3) {
          const arcR = 52;
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          const baseAngle = -Math.PI / 2;
          const tiltAngle = Math.atan2(-blockH, visualShiftPx);
          ctx.arc(pA.x, pA.y, arcR, baseAngle, tiltAngle, visualShiftPx < 0);
          ctx.stroke();

          // Formula Badge: θ = x / h
          const angleBadgeText = `θ = ${Math.abs(shearAngleDeg).toFixed(2)}° (${Math.abs(shearStrain).toFixed(4)} rad)`;
          const formulaText = `tan θ ≈ θ = x / h`;
          ctx.font = 'bold 12px JetBrains Mono';
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(pA.x + 18, pA.y - arcR - 38, 185, 38, 6);
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#f59e0b';
          ctx.fillText(angleBadgeText, pA.x + 26, pA.y - arcR - 22);
          ctx.font = 'bold 11px JetBrains Mono';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(formulaText, pA.x + 26, pA.y - arcR - 6);
        }
      } else {
        // 2D Fracture Rupture
        const elapsed = (Date.now() - fractureTime) / 1000;
        const slide = Math.min(105, elapsed * 115);

        ctx.beginPath();
        ctx.moveTo(blockBaseX, baseY);
        ctx.lineTo(blockBaseX + blockBaseW, baseY);
        ctx.lineTo(blockBaseX + blockBaseW, baseY - blockH * 0.45);
        ctx.lineTo(blockBaseX, baseY - blockH * 0.15);
        ctx.closePath();
        ctx.fillStyle = material.color;
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        const topSlideX = blockBaseX + 50 + slide;
        const topSlideY = topY + slide * 0.35;
        ctx.beginPath();
        ctx.moveTo(topSlideX, topSlideY + blockH * 0.85);
        ctx.lineTo(topSlideX + blockBaseW, topSlideY + blockH * 0.55);
        ctx.lineTo(topSlideX + blockBaseW, topSlideY);
        ctx.lineTo(topSlideX, topSlideY);
        ctx.closePath();
        ctx.fillStyle = '#991b1b';
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(blockBaseX, baseY - blockH * 0.15);
        ctx.lineTo(blockBaseX + blockBaseW, baseY - blockH * 0.45);
        ctx.stroke();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(width / 2 - 180, 22, 360, 36, 10);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = 'bold 15px Plus Jakarta Sans, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(
          lang === 'bn' ? '⚠️ ব্যবৰ্তন ফাটল ও খণ্ডন! (Shear Fracture)' : '⚠️ Mechanical Shear Fracture & Rupture!',
          width / 2,
          45
        );
        ctx.textAlign = 'left';
      }
    }

    ctx.restore();
  }, [material, blockHeightCm, tangentialForceKN, lateralShiftMm, shearAngleDeg, shearStrain, isFractured, fractureTime, lang, viewMode]);

  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      drawShear();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      active = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawShear]);

  // Pointer drag on canvas to smoothly control tangential shear force!
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isFractured) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartForceRef.current = tangentialForceKN;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || isFractured) return;
    const dx = e.clientX - dragStartXRef.current;
    const newForce = Math.max(-200, Math.min(800, dragStartForceRef.current + dx * 2.5));
    setTangentialForceKN(Math.round(newForce));
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
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
            {t.common.controls}
          </h2>
          <p className="text-[11px] text-slate-700 font-medium mt-0.5">{t.m3.subtitle}</p>
        </div>

        {/* View Mode Selection (3D / 2D) */}
        <div className="flex flex-col gap-1.5 p-2 bg-sky-50/80 rounded-xl border border-sky-200">
          <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-amber-600" />
              {lang === 'bn' ? 'ভিউ অপশন (View Mode)' : 'View Mode Option'}
            </span>
            <span className="text-[10px] text-sky-800 font-mono font-bold">{viewMode.toUpperCase()}</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === '3d'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-800 hover:bg-amber-50 border border-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? '৩D ত্রিমাত্রিক' : '3D Isometric'}</span>
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === '2d'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'bg-white text-slate-800 hover:bg-sky-50 border border-slate-200'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? '২D পাঠ্যবই' : '2D Textbook'}</span>
            </button>
          </div>
        </div>

        {/* Material Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-900">{t.common.material}</label>
          <div className="grid grid-cols-2 gap-1.5">
            {SHEAR_MATERIALS.map((m) => {
              const isSelected = material.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setMaterial(m);
                    handleResetBlock();
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                    isSelected
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-slate-900 hover:bg-amber-100 border border-amber-300'
                  }`}
                >
                  <span className="truncate">{lang === 'bn' ? m.nameBn.split(' ')[0] : m.nameEn.split(' ')[0]}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-amber-100' : 'text-slate-600'}`}>
                    η = {(m.shearModulus / 1e9).toFixed(2)} GPa
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Progressive Green Sliders */}
        <div className="flex flex-col gap-3 pt-2 border-t border-sky-100">
          <ProgressiveSlider
            label={t.m3.tangentialForce}
            value={tangentialForceKN}
            min={-150}
            max={650}
            step={10}
            unit="kN"
            disabled={isFractured}
            valueFormatter={(v) => `${v > 0 ? '+' : ''}${v} kN`}
            onChange={setTangentialForceKN}
          />

          <ProgressiveSlider
            label={t.m3.blockHeight}
            value={blockHeightCm}
            min={10}
            max={30}
            step={1}
            unit="cm"
            valueFormatter={(v) => `${v} cm`}
            onChange={setBlockHeightCm}
          />

          <ProgressiveSlider
            label={t.m3.topFaceArea}
            value={topAreaCm2}
            min={50}
            max={250}
            step={10}
            unit="cm²"
            valueFormatter={(v) => `${v} cm²`}
            onChange={setTopAreaCm2}
          />
        </div>

        {/* Reset Button */}
        <div className="pt-2 border-t border-sky-100">
          <button
            onClick={handleResetBlock}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-100 hover:bg-sky-200 text-sky-950 border border-sky-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-4 h-4 text-sky-700" />
            <span>{isFractured ? t.m3.repairBlock : t.common.reset}</span>
          </button>
        </div>

        {/* Governing Formulas Box */}
        <div className="mt-auto bg-sky-50 rounded-xl p-3 border border-sky-200 text-xs">
          <div className="font-bold text-slate-950 mb-1.5 flex items-center justify-between">
            <span>{t.common.formulas}</span>
            <span className="text-[10px] text-amber-800 font-mono font-bold">Shear Modulus</span>
          </div>
          <div className="font-mono text-[11px] text-slate-900 font-semibold space-y-1 leading-relaxed">
            <div>τ = F_s / A (কৃন্তন পীড়ন)</div>
            <div>θ ≈ tan θ = x / h (ব্যবৰ্তন কোণ)</div>
            <div>η = τ / θ = (F_s · h) / (A · x)</div>
          </div>
        </div>
      </aside>

      {/* CENTER WORKSPACE */}
      <main className="flex-1 min-w-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-3.5 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-950">{t.common.workspace}</span>
            <span className="text-[11px] text-amber-900 font-bold hidden sm:inline flex items-center gap-1">
              <MoveHorizontal className="w-3.5 h-3.5 text-amber-600" />
              {lang === 'bn' ? 'মাউস দিয়ে ব্লক টেনে স্পর্শকীয় বল প্রয়োগ করুন' : 'Drag block left/right anywhere to shear'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle Pill */}
            <div className="flex items-center bg-sky-100/80 p-0.5 rounded-xl border border-sky-200">
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === '3d'
                    ? 'bg-white text-slate-950 shadow-xs border border-sky-200'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Box className="w-3.5 h-3.5 text-amber-600" />
                <span>{lang === 'bn' ? '৩D ভিউ' : '3D View'}</span>
              </button>
              <button
                onClick={() => setViewMode('2d')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === '2d'
                    ? 'bg-white text-slate-950 shadow-xs border border-sky-200'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Square className="w-3.5 h-3.5 text-sky-700" />
                <span>{lang === 'bn' ? '২D পাঠ্যবই' : '2D Textbook'}</span>
              </button>
            </div>

            {/* Status Badge */}
            {isFractured ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 border border-red-300 rounded-full text-xs font-bold shadow-xs">
                <Flame className="w-4 h-4 text-red-600 animate-pulse" />
                <span>{t.m3.shearFracture}</span>
              </div>
            ) : absShearStress > material.ultimateShearStress * 0.75 ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold shadow-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{lang === 'bn' ? 'তীব্র ব্যবৰ্তন চাপ (Near Shear Rupture)' : 'Elevated Shear Load'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-bold shadow-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{lang === 'bn' ? 'স্থিতিস্থাপক ব্যবৰ্তন সাম্যাবস্থা' : 'Stable Shear Modulus Range'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Canvas viewport container */}
        <div className="relative flex-1 w-full min-h-[420px] rounded-xl overflow-hidden border border-sky-200/90 bg-slate-50">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full block cursor-ew-resize touch-none"
          />
        </div>
      </main>

      {/* RIGHT TELEMETRY PANEL (320px width) */}
      <aside className="w-full lg:w-[320px] shrink-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-4 flex flex-col gap-3 text-slate-950">
        <div>
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
            {t.common.telemetry}
          </h2>
          <p className="text-[11px] text-slate-700 font-medium mt-0.5">{lang === 'bn' ? 'কৃন্তন পীড়ন ও কৌণিক বিকৃতি' : 'Shear Stress & Angular Slip'}</p>
        </div>

        {/* Primary Gauges */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex flex-col">
            <span className="text-[11px] font-bold text-slate-800">{t.m3.shearStress}</span>
            <span className="font-mono text-lg font-extrabold text-slate-950 mt-1 tabular-nums">
              {(shearStress / 1e6).toFixed(2)}
            </span>
            <span className="text-[10px] text-amber-800 font-bold font-mono">MPa (10⁶ N/m²)</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col">
            <span className="text-[11px] font-bold text-slate-800">{t.m3.shearAngle}</span>
            <span className="font-mono text-lg font-extrabold text-emerald-900 mt-1 tabular-nums">
              {(shearAngleDeg).toFixed(3)}°
            </span>
            <span className="text-[10px] text-emerald-800 font-bold font-mono">{(shearStrain).toFixed(4)} rad</span>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m3.shearModulus} (η):</span>
            <span className="font-mono font-bold text-slate-950 tabular-nums">
              {(material.shearModulus / 1e9).toFixed(2)} GPa
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m3.lateralShift} (x):</span>
            <span className="font-mono font-bold text-amber-800 tabular-nums">
              {(lateralShiftMm).toFixed(3)} mm
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m3.blockHeight} (h):</span>
            <span className="font-mono font-bold text-slate-950 tabular-nums">
              {blockHeightCm} cm
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">{t.m3.topFaceArea} (A):</span>
            <span className="font-mono font-bold text-slate-950 tabular-nums">
              {topAreaCm2} cm²
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-800 font-semibold">Ultimate Shear Limit:</span>
            <span className="font-mono font-bold text-red-700 tabular-nums">
              {(material.ultimateShearStress / 1e6).toFixed(1)} MPa
            </span>
          </div>
        </div>

        {/* Shear Stress Head */}
        <div className="flex flex-col gap-1.5 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
          <div className="flex justify-between text-[11px] font-bold text-slate-900">
            <span>কৃন্তন পীড়ন ভার অনুপাত (Shear Load Ratio)</span>
            <span className="font-mono font-bold">
              {((absShearStress / material.ultimateShearStress) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden relative">
            <div
              className={`h-full transition-all duration-150 ${
                absShearStress > material.ultimateShearStress * 0.85 ? 'bg-red-600' : 'bg-amber-600'
              }`}
              style={{ width: `${Math.min(100, (absShearStress / material.ultimateShearStress) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-700 font-bold font-mono">
            <span>০</span>
            <span>নমনীয় বিকৃতি</span>
            <span>ছেদন ফাটল (১০০%)</span>
          </div>
        </div>
      </aside>
    </div>
  );
};
