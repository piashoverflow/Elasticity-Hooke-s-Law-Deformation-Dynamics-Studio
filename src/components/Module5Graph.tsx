import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, StressStrainMaterial } from '../types/physics';
import { translations } from '../utils/translations';
import { ProgressiveSlider } from './ProgressiveSlider';
import { ZoomIn, ZoomOut, Layers, MoveHorizontal, RotateCcw, ChevronLeft, ChevronRight, Hand, Crosshair } from 'lucide-react';

const GRAPH_MATERIALS: StressStrainMaterial[] = [
  {
    id: 'mild_steel',
    nameBn: 'মাইল্ড স্টিল (Mild Steel)',
    nameEn: 'Mild Steel (Ductile)',
    categoryBn: 'নমনীয় ধাতু (Ductile Metal)',
    categoryEn: 'Ductile Metal',
    youngModulus: 200, // GPa
    proportionalStrain: 0.0012,
    proportionalStress: 240, // MPa
    yieldStrain: 0.0025,
    yieldStress: 280,
    ultimateStrain: 0.15,
    ultimateStress: 450,
    fractureStrain: 0.25,
    fractureStress: 360,
    curveColor: '#0284c7',
    descriptionBn: 'সুস্পষ্ট সমানুপাতিক সীমা, তীক্ষ্ণ ইয়েল্ড ড্রপ, দীর্ঘ প্লাস্টিক মালভূমি এবং নেকিং সহ ভাঙন।',
    descriptionEn: 'Distinct linear elastic zone, sharp yield drop, plastic plateau, strain hardening & necking.',
  },
  {
    id: 'structural_glass',
    nameBn: 'স্ট্রাকচারাল গ্লাস (Structural Glass)',
    nameEn: 'Structural Glass (Brittle)',
    categoryBn: 'ভঙ্গুর পদার্থ (Brittle Material)',
    categoryEn: 'Brittle Material',
    youngModulus: 70, // GPa
    proportionalStrain: 0.0010,
    proportionalStress: 70, // MPa
    yieldStrain: 0.0010,
    yieldStress: 70,
    ultimateStrain: 0.0010,
    ultimateStress: 70,
    fractureStrain: 0.0010,
    fractureStress: 70,
    curveColor: '#dc2626',
    isBrittle: true,
    descriptionBn: 'খাড়া সরলরৈখিক স্থিতিস্থাপক রেখা, কোনো প্লাস্টিক বিকৃতি ছাড়াই অকস্মাৎ অসহ ভাঙন!',
    descriptionEn: 'Steep linear elastic line with ZERO plastic deformation before abrupt brittle fracture!',
  },
  {
    id: 'vulcanized_rubber',
    nameBn: 'ভালকানাইজড রাবার (Rubber)',
    nameEn: 'Vulcanized Rubber (Elastomer)',
    categoryBn: 'ইলাস্টোমার (Elastomer)',
    categoryEn: 'Elastomer',
    youngModulus: 0.05, // GPa
    proportionalStrain: 0.05,
    proportionalStress: 2.5,
    yieldStrain: 2.0,
    yieldStress: 8.0,
    ultimateStrain: 4.5,
    ultimateStress: 22.0,
    fractureStrain: 5.5,
    fractureStress: 25.0,
    curveColor: '#059669',
    isElastomer: true,
    descriptionBn: 'অ-রৈখিক S-আকৃতির বক্ররেখা, স্থায়ী পরিবর্তন ছাড়া বিশাল বিকৃতি ধারণ ক্ষমতা।',
    descriptionEn: 'Non-linear S-shaped curve, huge reversible strain capacity without permanent set.',
  },
  {
    id: 'lead_polymer',
    nameBn: 'লেড / পলিমার (Lead / Plastic)',
    nameEn: 'Lead / Polymer (High Plasticity)',
    categoryBn: 'উচ্চ নমনীয়তা (High Plasticity)',
    categoryEn: 'High Plasticity',
    youngModulus: 16, // GPa
    proportionalStrain: 0.0006,
    proportionalStress: 9.6,
    yieldStrain: 0.0015,
    yieldStress: 14.0,
    ultimateStrain: 0.20,
    ultimateStress: 22.0,
    fractureStrain: 0.45,
    fractureStress: 18.0,
    curveColor: '#7c3aed',
    isHighPlastic: true,
    descriptionBn: 'অতি ক্ষুদ্র স্থিতিস্থাপক অঞ্চল, দ্রুত প্লাস্টিক প্রবাহ এবং প্রলম্বিত স্থায়ী বিকৃতি।',
    descriptionEn: 'Extremely narrow elastic zone, very early yielding and extensive plastic flow.',
  },
];

type RegionZoomPreset = 'all' | 'elastic' | 'yield' | 'hardening' | 'fracture';

interface Module5Props {
  lang: Language;
}

export const Module5Graph: React.FC<Module5Props> = ({ lang }) => {
  const t = translations[lang];

  const [activeMaterial, setActiveMaterial] = useState<StressStrainMaterial>(GRAPH_MATERIALS[0]);
  const [selectedStrain, setSelectedStrain] = useState<number>(0.08);
  const [showAllCurves, setShowAllCurves] = useState<boolean>(false);

  // Advanced Region Zoom & Pan System
  const [zoomPreset, setZoomPreset] = useState<RegionZoomPreset>('all');
  const [zoomMultiplier, setZoomMultiplier] = useState<number>(1.0); // 1.0x to 30.0x
  const [viewCenterStrain, setViewCenterStrain] = useState<number>(0.125);
  const [toolMode, setToolMode] = useState<'probe' | 'pan'>('probe');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingProbeRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const panStartXRef = useRef<number>(0);
  const panStartCenterRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  const maxStrain = activeMaterial.fractureStrain;

  // Set preset zoom into regions
  const applyZoomPreset = useCallback((preset: RegionZoomPreset) => {
    setZoomPreset(preset);
    const mat = activeMaterial;
    if (preset === 'all') {
      setZoomMultiplier(1.0);
      setViewCenterStrain((mat.fractureStrain * 1.1) / 2);
    } else if (preset === 'elastic') {
      // Zoom deeply into linear elastic zone OA
      setZoomMultiplier(mat.isElastomer ? 8.0 : 22.0);
      setViewCenterStrain(mat.proportionalStrain * 0.65);
      setSelectedStrain(mat.proportionalStrain * 0.7);
    } else if (preset === 'yield') {
      // Zoom into yield point & plastic onset
      setZoomMultiplier(mat.isElastomer ? 6.0 : 16.0);
      const midYield = (mat.proportionalStrain + mat.yieldStrain) / 2;
      setViewCenterStrain(midYield);
      setSelectedStrain(mat.yieldStrain);
    } else if (preset === 'hardening') {
      // Zoom into plastic strain hardening plateau & UTS
      setZoomMultiplier(mat.isElastomer ? 3.0 : 5.0);
      const midHardening = (mat.yieldStrain + mat.ultimateStrain) / 2;
      setViewCenterStrain(midHardening);
      setSelectedStrain(mat.ultimateStrain);
    } else if (preset === 'fracture') {
      // Zoom into necking and fracture drop
      setZoomMultiplier(mat.isElastomer ? 3.0 : 6.0);
      const midFracture = (mat.ultimateStrain + mat.fractureStrain) / 2;
      setViewCenterStrain(midFracture);
      setSelectedStrain(mat.fractureStrain * 0.96);
    }
  }, [activeMaterial]);

  // When changing material, clamp selected strain and re-adjust
  useEffect(() => {
    if (selectedStrain > activeMaterial.fractureStrain) {
      setSelectedStrain(activeMaterial.fractureStrain * 0.6);
    }
    applyZoomPreset('all');
  }, [activeMaterial]);

  // Curve stress evaluator
  const evaluateStress = useCallback((mat: StressStrainMaterial, strain: number): number => {
    if (strain <= 0) return 0;
    if (strain > mat.fractureStrain) return 0;

    if (mat.isBrittle) {
      return (strain / mat.fractureStrain) * mat.fractureStress;
    }

    if (mat.isElastomer) {
      const s = strain / mat.fractureStrain;
      return mat.fractureStress * (0.35 * Math.tanh(s * 3) + 0.65 * Math.pow(s, 3));
    }

    if (mat.isHighPlastic) {
      if (strain <= mat.proportionalStrain) {
        return (strain / mat.proportionalStrain) * mat.proportionalStress;
      }
      const pRatio = (strain - mat.proportionalStrain) / (mat.fractureStrain - mat.proportionalStrain);
      return mat.proportionalStress + (mat.ultimateStress - mat.proportionalStress) * Math.pow(pRatio, 0.28);
    }

    // Mild steel
    if (strain <= mat.proportionalStrain) {
      return (strain / mat.proportionalStrain) * mat.proportionalStress;
    }
    if (strain <= mat.yieldStrain) {
      const u = (strain - mat.proportionalStrain) / (mat.yieldStrain - mat.proportionalStrain);
      return mat.proportionalStress + u * (mat.yieldStress - mat.proportionalStress);
    }
    if (strain <= mat.ultimateStrain) {
      const u = (strain - mat.yieldStrain) / (mat.ultimateStrain - mat.yieldStrain);
      return mat.yieldStress + (mat.ultimateStress - mat.yieldStress) * Math.sin((u * Math.PI) / 2);
    }
    const u = (strain - mat.ultimateStrain) / (mat.fractureStrain - mat.ultimateStrain);
    return mat.ultimateStress - (mat.ultimateStress - mat.fractureStress) * u;
  }, []);

  const calculateEnergyDensity = useCallback((mat: StressStrainMaterial, targetStrain: number) => {
    const steps = 100;
    const dEps = targetStrain / steps;
    let totalArea = 0;

    for (let i = 0; i < steps; i++) {
      const e1 = i * dEps;
      const e2 = (i + 1) * dEps;
      const s1 = evaluateStress(mat, e1);
      const s2 = evaluateStress(mat, e2);
      totalArea += 0.5 * (s1 + s2) * dEps;
    }

    const elasticLimitStrain = Math.min(targetStrain, mat.proportionalStrain);
    const elasticStressAtLimit = evaluateStress(mat, elasticLimitStrain);
    const resilience = 0.5 * elasticLimitStrain * elasticStressAtLimit;
    const plasticWork = Math.max(0, totalArea - resilience);

    return {
      totalAreaMJm3: totalArea,
      resilienceMJm3: resilience,
      plasticWorkMJm3: plasticWork,
    };
  }, [evaluateStress]);

  const energyStats = calculateEnergyDensity(activeMaterial, selectedStrain);
  const currentStressAtProbe = evaluateStress(activeMaterial, selectedStrain);

  // Compute Viewport Dynamic Domain based on Zoom Level & Center
  const fullMaxStrain = activeMaterial.fractureStrain * 1.08;
  const strainSpan = fullMaxStrain / zoomMultiplier;
  const halfSpan = strainSpan / 2;

  // Clamped Viewport Center for seamless panning
  const minCenter = halfSpan;
  const maxCenter = Math.max(halfSpan, fullMaxStrain - halfSpan);
  const clampedCenter = Math.max(minCenter, Math.min(maxCenter, viewCenterStrain));

  // Viewport bounds
  const minDisplayStrain = Math.max(0, clampedCenter - halfSpan);
  const maxDisplayStrain = minDisplayStrain + strainSpan;

  // Pan helper
  const panByFraction = useCallback((fraction: number) => {
    setViewCenterStrain((prev) => {
      const shift = fraction * strainSpan;
      const next = prev + shift;
      return Math.max(minCenter, Math.min(maxCenter, next));
    });
  }, [strainSpan, minCenter, maxCenter]);

  // Stress vertical scale based on visible max
  const maxVisibleStress = zoomMultiplier > 6 && zoomPreset === 'elastic'
    ? activeMaterial.proportionalStress * 1.3
    : activeMaterial.ultimateStress * 1.15;

  // High-DPI realistic canvas drawing loop
  const drawStressStrainGraph = useCallback(() => {
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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Graph viewport coordinates
    const padLeft = 85;
    const padRight = 35;
    const padTop = 45;
    const padBottom = 65;

    const graphW = width - padLeft - padRight;
    const graphH = height - padTop - padBottom;
    const originX = padLeft;
    const originY = height - padBottom;

    // Map helpers
    const mapX = (eps: number) => originX + ((eps - minDisplayStrain) / (maxDisplayStrain - minDisplayStrain)) * graphW;
    const mapY = (sigma: number) => originY - (sigma / maxVisibleStress) * graphH;

    // ==========================================
    // 1. DISTINCT COLOR-CODED REGION BANDS (SEPARATE REGIONS)
    // ==========================================
    ctx.save();
    ctx.beginPath();
    ctx.rect(originX, padTop, graphW, graphH);
    ctx.clip();

    // Define the 4 distinct mechanical regions
    const pLim = activeMaterial.proportionalStrain;
    const yLim = activeMaterial.yieldStrain;
    const uLim = activeMaterial.ultimateStrain;
    const fLim = activeMaterial.fractureStrain;

    const regions = [
      {
        start: 0,
        end: pLim,
        color: 'rgba(16, 185, 129, 0.08)',
        borderColor: '#10b981',
        titleBn: 'OA: রৈখিক স্থিতিস্থাপক (Hooke)',
        titleEn: 'OA: Linear Elastic',
      },
      {
        start: pLim,
        end: yLim,
        color: 'rgba(2, 132, 199, 0.08)',
        borderColor: '#0284c7',
        titleBn: 'AB: নমনীয় রূপান্তর (Yield)',
        titleEn: 'AB: Yield Transition',
      },
      {
        start: yLim,
        end: uLim,
        color: 'rgba(217, 119, 6, 0.07)',
        borderColor: '#d97706',
        titleBn: 'BC: স্ট্রেন হার্ডেনিং (Plastic)',
        titleEn: 'BC: Strain Hardening',
      },
      {
        start: uLim,
        end: fLim,
        color: 'rgba(225, 29, 72, 0.07)',
        borderColor: '#e11d48',
        titleBn: 'CD: নেকিং ও ভাঙন (Rupture)',
        titleEn: 'CD: Necking & Fracture',
      },
    ];

    regions.forEach((reg) => {
      const rx1 = mapX(reg.start);
      const rx2 = mapX(reg.end);
      const rw = Math.max(0, rx2 - rx1);

      if (rx2 > originX && rx1 < originX + graphW && rw > 1) {
        // Shaded region background
        ctx.fillStyle = reg.color;
        ctx.fillRect(Math.max(originX, rx1), padTop, Math.min(graphW, rw), graphH);

        // Region boundary vertical line
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = reg.borderColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx2, padTop);
        ctx.lineTo(rx2, originY);
        ctx.stroke();

        // Top Region Header Label
        if (rw > 65) {
          ctx.fillStyle = reg.borderColor;
          ctx.font = 'bold 10px Plus Jakarta Sans, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(lang === 'bn' ? reg.titleBn : reg.titleEn, rx1 + rw / 2, padTop + 14);
          ctx.textAlign = 'left';
        }
      }
    });
    ctx.restore();

    // ==========================================
    // 2. COORDINATE GRID (Crisp high-contrast lines)
    // ==========================================
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    const numGridX = 10;
    const numGridY = 8;

    for (let i = 0; i <= numGridX; i++) {
      const gx = originX + (i / numGridX) * graphW;
      ctx.beginPath();
      ctx.moveTo(gx, padTop);
      ctx.lineTo(gx, originY);
      ctx.stroke();

      const epsVal = minDisplayStrain + (i / numGridX) * (maxDisplayStrain - minDisplayStrain);
      ctx.font = 'bold 11px JetBrains Mono';
      ctx.fillStyle = '#0f172a';
      const label = epsVal < 0.005 ? (epsVal * 1000).toFixed(2) + 'm' : epsVal.toFixed(3);
      ctx.fillText(label, gx - 16, originY + 20);
    }

    for (let j = 0; j <= numGridY; j++) {
      const gy = originY - (j / numGridY) * graphH;
      ctx.beginPath();
      ctx.moveTo(originX, gy);
      ctx.lineTo(originX + graphW, gy);
      ctx.stroke();

      const stressVal = (j / numGridY) * maxVisibleStress;
      ctx.font = 'bold 11px JetBrains Mono';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'right';
      ctx.fillText(stressVal.toFixed(0), originX - 12, gy + 4);
    }
    ctx.textAlign = 'left';

    // Primary Axes (High-contrast slate-950)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(originX, padTop - 15);
    ctx.lineTo(originX, originY);
    ctx.lineTo(originX + graphW + 20, originY);
    ctx.stroke();

    // Axis Arrows
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(originX, padTop - 20);
    ctx.lineTo(originX - 6, padTop - 8);
    ctx.lineTo(originX + 6, padTop - 8);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(originX + graphW + 25, originY);
    ctx.lineTo(originX + graphW + 12, originY - 6);
    ctx.lineTo(originX + graphW + 12, originY + 6);
    ctx.closePath();
    ctx.fill();

    // Axis Labels
    ctx.font = 'bold 13px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(lang === 'bn' ? 'পীড়ন σ (Tensile Stress, MPa)' : 'Tensile Stress σ (MPa)', originX - 45, padTop - 26);
    ctx.fillText(lang === 'bn' ? 'বিকৃতি ε (Strain)' : 'Strain ε', originX + graphW - 75, originY + 44);

    // ==========================================
    // 3. INTEGRATED ENERGY SHADING
    // ==========================================
    if (selectedStrain > minDisplayStrain) {
      const probeLimitStrain = Math.min(selectedStrain, activeMaterial.fractureStrain);
      const steps = 80;

      ctx.save();
      ctx.beginPath();
      ctx.rect(originX, padTop, graphW, graphH);
      ctx.clip();

      ctx.beginPath();
      const startPlotStrain = Math.max(minDisplayStrain, 0);
      ctx.moveTo(mapX(startPlotStrain), originY);

      for (let i = 0; i <= steps; i++) {
        const curEps = startPlotStrain + (i / steps) * (probeLimitStrain - startPlotStrain);
        const curStress = evaluateStress(activeMaterial, curEps);
        ctx.lineTo(mapX(curEps), mapY(curStress));
      }
      ctx.lineTo(mapX(probeLimitStrain), originY);
      ctx.closePath();

      const fillGrad = ctx.createLinearGradient(originX, padTop, mapX(probeLimitStrain), originY);
      if (selectedStrain <= activeMaterial.proportionalStrain) {
        fillGrad.addColorStop(0, 'rgba(16, 185, 129, 0.55)');
        fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0.2)');
      } else {
        fillGrad.addColorStop(0, 'rgba(6, 182, 212, 0.55)');
        fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0.25)');
      }
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.restore();
    }

    // ==========================================
    // 4. MULTI-MATERIAL OVERLAY (if active)
    // ==========================================
    if (showAllCurves && zoomMultiplier <= 2.0) {
      GRAPH_MATERIALS.forEach((mat) => {
        if (mat.id === activeMaterial.id) return;
        ctx.save();
        ctx.strokeStyle = mat.curveColor;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const steps = 60;
        for (let i = 0; i <= steps; i++) {
          const curEps = (i / steps) * mat.fractureStrain;
          const curStress = evaluateStress(mat, curEps);
          const px = mapX(curEps);
          const py = mapY(curStress);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      });
    }

    // ==========================================
    // 5. ACTIVE STRESS-STRAIN CURVE
    // ==========================================
    ctx.save();
    ctx.beginPath();
    ctx.rect(originX, padTop, graphW, graphH);
    ctx.clip();

    ctx.strokeStyle = activeMaterial.curveColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    const curveSteps = 220;

    for (let i = 0; i <= curveSteps; i++) {
      const curEps = minDisplayStrain + (i / curveSteps) * (maxDisplayStrain - minDisplayStrain);
      if (curEps <= activeMaterial.fractureStrain) {
        const curStress = evaluateStress(activeMaterial, curEps);
        const px = mapX(curEps);
        const py = mapY(curStress);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();

    // ==========================================
    // 6. BENCHMARK NODES (A, B, C, D, E)
    // ==========================================
    const pointsToMark = [
      { tag: 'A', strain: activeMaterial.proportionalStrain, stress: activeMaterial.proportionalStress, color: '#059669', name: 'সমানুপাতিক সীমা' },
      { tag: 'B', strain: activeMaterial.yieldStrain * 0.92, stress: activeMaterial.yieldStress * 0.96, color: '#0284c7', name: 'স্থিতিস্থাপক সীমা' },
      { tag: 'C', strain: activeMaterial.yieldStrain, stress: activeMaterial.yieldStress, color: '#d97706', name: 'ইয়েল্ড পয়েন্ট' },
      { tag: 'D', strain: activeMaterial.ultimateStrain, stress: activeMaterial.ultimateStress, color: '#7c3aed', name: 'UTS' },
      { tag: 'E', strain: activeMaterial.fractureStrain, stress: activeMaterial.fractureStress, color: '#dc2626', name: 'ভাঙন বিন্দু' },
    ];

    pointsToMark.forEach((pt) => {
      if (pt.strain >= minDisplayStrain && pt.strain <= maxDisplayStrain && pt.stress <= maxVisibleStress) {
        const px = mapX(pt.strain);
        const py = mapY(pt.stress);

        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(px + 8, py - 20, 26, 22, 5);
        ctx.fill();
        ctx.font = 'bold 12px JetBrains Mono';
        ctx.fillStyle = pt.color;
        ctx.fillText(pt.tag, px + 15, py - 5);
      }
    });

    // ==========================================
    // 7. INTERACTIVE PROBE DOT & DYNAMIC ACTIVE POINT TOOLTIP
    // ==========================================
    if (selectedStrain >= minDisplayStrain && selectedStrain <= maxDisplayStrain) {
      const probeX = mapX(selectedStrain);
      const probeY = mapY(currentStressAtProbe);

      // Droplines to axes
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(probeX, probeY);
      ctx.lineTo(probeX, originY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(probeX, probeY);
      ctx.lineTo(originX, probeY);
      ctx.stroke();
      ctx.restore();

      // Determine exact point / region name
      const eps = selectedStrain;
      let pointName = '';
      let pointColor = '#10b981';

      if (eps <= pLim * 0.85) {
        pointName = lang === 'bn' ? 'অঞ্চল OA: সরলরৈখিক সমানুপাতিক অঞ্চল (হুকের সূত্র কার্যকর)' : 'Zone OA: Linear Elastic Zone (Hooke\'s Law Active)';
        pointColor = '#10b981';
      } else if (Math.abs(eps - pLim) <= Math.max(0.0004, pLim * 0.28) || (eps > pLim * 0.85 && eps <= pLim * 1.15)) {
        pointName = lang === 'bn' ? 'বিন্দু A: সমানুপাতিক সীমা (Proportional Limit)' : 'Point A: Proportional Limit (Peak Linear Stress)';
        pointColor = '#059669';
      } else if (eps > pLim * 1.15 && eps <= yLim * 0.92) {
        pointName = lang === 'bn' ? 'বিন্দু B: স্থিতিস্থাপক সীমা (Elastic Recovery Limit)' : 'Point B: Elastic Limit (Full Reversible Recovery)';
        pointColor = '#0284c7';
      } else if (Math.abs(eps - yLim) <= Math.max(0.0006, yLim * 0.18) || (eps > yLim * 0.92 && eps <= yLim * 1.25)) {
        pointName = lang === 'bn' ? 'বিন্দু C: নমনীয় বিন্দু (Yield Point - প্লাস্টিক সূচনা)' : 'Point C: Yield Point (Onset of Permanent Set)';
        pointColor = '#d97706';
      } else if (eps > yLim * 1.25 && eps < uLim * 0.88) {
        pointName = lang === 'bn' ? 'প্লাস্টিক মালভূমি ও স্ট্রেন হার্ডেনিং (Strain Hardening)' : 'Plastic Plateau & Strain Hardening (Ductile Flow)';
        pointColor = '#0891b2';
      } else if (Math.abs(eps - uLim) <= Math.max(0.01, uLim * 0.16) || (eps >= uLim * 0.88 && eps <= uLim * 1.08)) {
        pointName = lang === 'bn' ? 'বিন্দু D: সর্বোচ্চ সহনশীল পীড়ন (UTS - Peak Load)' : 'Point D: Ultimate Tensile Strength (UTS - Peak Load)';
        pointColor = '#7c3aed';
      } else {
        pointName = lang === 'bn' ? 'বিন্দু E: নেকিং ও অসহ ভাঙন বিন্দু (Fracture Point)' : 'Point E: Breaking / Fracture Point (Rupture)';
        pointColor = '#dc2626';
      }

      // Glowing Probe Ring
      ctx.fillStyle = pointColor;
      ctx.beginPath();
      ctx.arc(probeX, probeY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Tooltip Card
      ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
      const textWidthName = ctx.measureText(pointName).width;
      const numText = `ε = ${selectedStrain.toFixed(4)} (${(selectedStrain * 100).toFixed(2)}%)  |  σ = ${currentStressAtProbe.toFixed(1)} MPa`;
      ctx.font = 'bold 11px JetBrains Mono';
      const textWidthNum = ctx.measureText(numText).width;

      const badgeW = Math.max(textWidthName, textWidthNum) + 28;
      const badgeH = 46;

      let badgeX = probeX + 16;
      if (badgeX + badgeW > width - 15) {
        badgeX = probeX - badgeW - 16;
      }
      let badgeY = Math.max(padTop - 5, Math.min(originY - badgeH - 10, probeY - 24));

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = pointColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
      ctx.stroke();

      ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = pointColor;
      ctx.fillText(pointName, badgeX + 12, badgeY + 18);

      ctx.font = 'bold 11px JetBrains Mono';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(numText, badgeX + 12, badgeY + 36);
    }

    ctx.restore();
  }, [activeMaterial, zoomMultiplier, viewCenterStrain, selectedStrain, showAllCurves, evaluateStress, currentStressAtProbe, lang, minDisplayStrain, maxDisplayStrain, maxVisibleStress]);

  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      drawStressStrainGraph();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      active = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawStressStrainGraph]);

  // Pointer drag along the graph: Supports both Probe Measurement and Drag Panning
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const isPan = toolMode === 'pan' || e.shiftKey || e.button === 1;
    if (isPan) {
      isPanningRef.current = true;
      panStartXRef.current = e.clientX;
      panStartCenterRef.current = clampedCenter;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      isDraggingProbeRef.current = true;
      updateProbeFromPointer(e);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const padLeft = 85;
      const padRight = 35;
      const graphW = rect.width - padLeft - padRight;
      const dx = e.clientX - panStartXRef.current;
      const strainDelta = -(dx / graphW) * strainSpan;
      const nextCenter = Math.max(minCenter, Math.min(maxCenter, panStartCenterRef.current + strainDelta));
      setViewCenterStrain(nextCenter);
    } else if (isDraggingProbeRef.current) {
      updateProbeFromPointer(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isPanningRef.current = false;
    isDraggingProbeRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const updateProbeFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const padLeft = 85;
    const padRight = 35;
    const graphW = rect.width - padLeft - padRight;
    const clampedX = Math.max(padLeft, Math.min(padLeft + graphW, x));

    const ratio = (clampedX - padLeft) / graphW;
    const newStrain = Math.max(0.0001, Math.min(activeMaterial.fractureStrain, minDisplayStrain + ratio * (maxDisplayStrain - minDisplayStrain)));
    setSelectedStrain(newStrain);
  };

  // Mouse wheel zoom in/out directly on canvas
  const handleWheelZoom = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 1.25 : 0.8;
    const nextZoom = Math.max(1.0, Math.min(30.0, zoomMultiplier * zoomDelta));
    setZoomMultiplier(nextZoom);
    if (nextZoom === 1.0) {
      setZoomPreset('all');
    } else {
      setZoomPreset('all'); // custom mode
    }
    setViewCenterStrain(selectedStrain);
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
          <p className="text-[11px] text-slate-700 font-medium mt-0.5">{t.m5.subtitle}</p>
        </div>

        {/* 4 Archetypal Material Selectors */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-900">{t.common.material}</label>
          <div className="flex flex-col gap-1.5">
            {GRAPH_MATERIALS.map((m) => {
              const isSelected = activeMaterial.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMaterial(m)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                    isSelected
                      ? 'bg-sky-700 text-white shadow-xs'
                      : 'bg-sky-50 text-slate-900 hover:bg-sky-100 border border-sky-300'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-extrabold">{lang === 'bn' ? m.nameBn.split(' ')[0] : m.nameEn.split(' ')[0]}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isSelected ? 'bg-sky-500 text-white' : 'bg-sky-100 text-sky-950'}`}>
                      {lang === 'bn' ? m.categoryBn.split(' ')[0] : m.categoryEn.split(' ')[0]}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-sky-100' : 'text-slate-600'}`}>
                    Y = {m.youngModulus} GPa • UTS = {m.ultimateStress} MPa
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Region Specific Quick Zoom Switcher */}
        <div className="flex flex-col gap-2 pt-2 border-t border-sky-100">
          <div className="flex justify-between items-center text-xs font-bold text-slate-900">
            <span>{lang === 'bn' ? 'অঞ্চলভিত্তিক জুম (Region Zoom)' : 'Region Zoom Focus'}</span>
            <span className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {zoomMultiplier.toFixed(1)}x
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              onClick={() => applyZoomPreset('all')}
              className={`px-2.5 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
                zoomPreset === 'all' && zoomMultiplier === 1.0
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border-slate-300'
              }`}
            >
              🔍 {lang === 'bn' ? 'সম্পূর্ণ গ্রাফ (1x)' : 'Full View (1x)'}
            </button>

            <button
              onClick={() => applyZoomPreset('elastic')}
              className={`px-2.5 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
                zoomPreset === 'elastic'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border-emerald-300'
              }`}
            >
              🔍 {lang === 'bn' ? 'OA: স্থিতিস্থাপক' : 'OA: Elastic'}
            </button>

            <button
              onClick={() => applyZoomPreset('yield')}
              className={`px-2.5 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
                zoomPreset === 'yield'
                  ? 'bg-sky-700 text-white border-sky-700'
                  : 'bg-sky-50 text-sky-950 hover:bg-sky-100 border-sky-300'
              }`}
            >
              🔍 {lang === 'bn' ? 'AB: ইয়েল্ড ড্রপ' : 'AB: Yield Point'}
            </button>

            <button
              onClick={() => applyZoomPreset('hardening')}
              className={`px-2.5 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
                zoomPreset === 'hardening'
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'bg-amber-50 text-amber-950 hover:bg-amber-100 border-amber-300'
              }`}
            >
              🔍 {lang === 'bn' ? 'BC: UTS মালভূমি' : 'BC: UTS Plateau'}
            </button>

            <button
              onClick={() => applyZoomPreset('fracture')}
              className={`col-span-2 px-2.5 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
                zoomPreset === 'fracture'
                  ? 'bg-rose-700 text-white border-rose-700'
                  : 'bg-rose-50 text-rose-950 hover:bg-rose-100 border-rose-300'
              }`}
            >
              🔍 {lang === 'bn' ? 'CD: নেকিং ও অসহ ভাঙন (Fracture Zoom)' : 'CD: Fracture & Rupture'}
            </button>
          </div>

          {/* Continuous Zoom Slider */}
          <div className="pt-1">
            <ProgressiveSlider
              label={lang === 'bn' ? 'জুম স্তর (Zoom Scale)' : 'Zoom Level'}
              value={zoomMultiplier}
              min={1.0}
              max={25.0}
              step={0.5}
              unit="x"
              valueFormatter={(v) => `${v.toFixed(1)}x`}
              onChange={(val) => {
                setZoomMultiplier(val);
                setViewCenterStrain(selectedStrain);
              }}
            />
          </div>
        </div>

        {/* Multi-Material Comparison Overlay */}
        <div className="pt-2 border-t border-sky-100">
          <button
            onClick={() => setShowAllCurves(!showAllCurves)}
            disabled={zoomMultiplier > 2.0}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all border disabled:opacity-40 cursor-pointer shadow-xs ${
              showAllCurves
                ? 'bg-sky-100 text-sky-950 border-sky-300'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-700" />
              <span>{lang === 'bn' ? '৪টি পদার্থের তুলনামূলক গ্রাফ' : 'Compare 4 Curves Overlay'}</span>
            </div>
            <span className="text-[10px] font-mono">{showAllCurves ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Strain probe slider */}
        <div className="pt-2 border-t border-sky-100">
          <ProgressiveSlider
            label={t.m5.strainSelector}
            value={selectedStrain}
            min={0.0001}
            max={maxStrain}
            step={maxStrain / 200}
            unit=""
            valueFormatter={(v) => `ε = ${v.toFixed(4)} (${(v * 100).toFixed(2)}%)`}
            onChange={(st) => {
              setSelectedStrain(st);
              if (zoomMultiplier > 2.0) {
                setViewCenterStrain(st);
              }
            }}
          />
        </div>

        {/* Material pedagogical description note */}
        <div className="mt-auto bg-sky-50 rounded-xl p-3 border border-sky-200 text-xs">
          <div className="font-bold text-slate-950 mb-1">{lang === 'bn' ? activeMaterial.nameBn : activeMaterial.nameEn}</div>
          <p className="text-[11px] text-slate-800 font-medium leading-relaxed">
            {lang === 'bn' ? activeMaterial.descriptionBn : activeMaterial.descriptionEn}
          </p>
        </div>
      </aside>

      {/* CENTER WORKSPACE (Canvas) */}
      <main className="flex-1 min-w-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-3.5 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-950">{t.common.workspace}</span>
            <span className="text-[11px] text-sky-900 font-bold hidden sm:inline flex items-center gap-1">
              <MoveHorizontal className="w-3.5 h-3.5 text-sky-600" />
              {lang === 'bn' ? 'মাউস স্ক্রোল বা বাটন দিয়ে জুম ও গ্রাফ ডানে/বামে সরান' : 'Zoom & pan graph left or right'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tool Mode: Probe vs Pan */}
            <div className="flex items-center p-0.5 bg-sky-100/90 rounded-xl border border-sky-300 text-xs">
              <button
                onClick={() => setToolMode('probe')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  toolMode === 'probe'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/50'
                }`}
                title={lang === 'bn' ? 'পয়েন্ট নির্বাচন ও শক্তি পরিমাপ' : 'Probe point measurement'}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'পয়েন্ট মাপুন' : 'Probe'}</span>
              </button>

              <button
                onClick={() => setToolMode('pan')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  toolMode === 'pan'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/50'
                }`}
                title={lang === 'bn' ? 'গ্রাফ ডানে বা বামে টেনে সরান' : 'Drag to pan graph'}
              >
                <Hand className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'গ্রাফ সরান' : 'Pan'}</span>
              </button>
            </div>

            {/* Quick Pan Left / Right Step Buttons */}
            <div className="flex items-center gap-1 bg-sky-100/90 p-0.5 rounded-xl border border-sky-300">
              <button
                onClick={() => panByFraction(-0.2)}
                className="px-2 py-1 rounded-lg bg-white hover:bg-sky-50 text-slate-800 font-bold text-xs border border-sky-200 shadow-xs cursor-pointer flex items-center gap-0.5"
                title={lang === 'bn' ? 'গ্রাফ বামে সরান' : 'Pan Left'}
              >
                <ChevronLeft className="w-3.5 h-3.5 text-sky-700" />
                <span className="text-[11px] font-bold">{lang === 'bn' ? 'বামে' : 'Left'}</span>
              </button>

              <button
                onClick={() => panByFraction(0.2)}
                className="px-2 py-1 rounded-lg bg-white hover:bg-sky-50 text-slate-800 font-bold text-xs border border-sky-200 shadow-xs cursor-pointer flex items-center gap-0.5"
                title={lang === 'bn' ? 'গ্রাফ ডানে সরান' : 'Pan Right'}
              >
                <span className="text-[11px] font-bold">{lang === 'bn' ? 'ডানে' : 'Right'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-sky-700" />
              </button>
            </div>

            {/* Canvas Floating Zoom Bar */}
            <div className="flex items-center gap-1 bg-sky-100/90 p-0.5 rounded-xl border border-sky-300">
              <button
                onClick={() => setZoomMultiplier((prev) => Math.max(1.0, prev - 2))}
                className="p-1 rounded-lg bg-white text-slate-900 font-bold hover:bg-sky-50 border border-sky-200 shadow-xs cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="font-mono text-xs font-extrabold text-sky-950 px-1.5 tabular-nums">
                {zoomMultiplier.toFixed(1)}x
              </span>

              <button
                onClick={() => setZoomMultiplier((prev) => Math.min(25.0, prev + 2))}
                className="p-1 rounded-lg bg-white text-slate-900 font-bold hover:bg-sky-50 border border-sky-200 shadow-xs cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => applyZoomPreset('all')}
                className="px-1.5 py-1 rounded-lg bg-sky-200 hover:bg-sky-300 text-sky-950 font-bold text-[11px] border border-sky-300 transition-all cursor-pointer flex items-center gap-0.5"
                title="Reset Zoom to 1x"
              >
                <RotateCcw className="w-3 h-3" />
                <span>1x</span>
              </button>
            </div>
          </div>
        </div>

        {/* Canvas viewport container */}
        <div className="relative flex-1 w-full min-h-[440px] rounded-xl overflow-hidden border border-sky-200/90 bg-white shadow-inner">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheelZoom}
            className={`w-full h-full block ${
              toolMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
            } touch-none`}
          />
        </div>
      </main>

      {/* RIGHT TELEMETRY PANEL (320px width) */}
      <aside className="w-full lg:w-[320px] shrink-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-4 flex flex-col gap-3 text-slate-950">
        <div>
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            {t.common.telemetry}
          </h2>
          <p className="text-[11px] text-slate-700 font-medium mt-0.5">{lang === 'bn' ? 'শক্তি ঘনত্ব ও ইন্টিগ্রেশন রিডআউট' : 'Strain Energy Density & Integration'}</p>
        </div>

        {/* Primary Energy Density Gauge */}
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 flex flex-col">
          <div className="flex justify-between items-center text-xs font-bold text-emerald-950">
            <span>{t.m5.energyDensity}</span>
            <span className="text-[10px] font-mono bg-emerald-200 px-2 py-0.5 rounded text-emerald-900 font-extrabold">
              ∫ σ dε
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-emerald-950 mt-1 tabular-nums">
            {energyStats.totalAreaMJm3.toFixed(3)}
          </div>
          <div className="text-[11px] text-emerald-800 font-bold font-mono mt-0.5">
            MJ/m³ (10⁶ J/m³ = N·m/m³)
          </div>
        </div>

        {/* Energy breakdown */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 flex flex-col">
            <span className="text-[11px] font-bold text-slate-800">{t.m5.resilience}</span>
            <span className="font-mono text-base font-extrabold text-sky-950 mt-1 tabular-nums">
              {energyStats.resilienceMJm3.toFixed(3)}
            </span>
            <span className="text-[10px] text-sky-800 font-bold font-mono">MJ/m³ (Elastic)</span>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex flex-col">
            <span className="text-[11px] font-bold text-slate-800">{lang === 'bn' ? 'প্লাস্টিক অপচয়' : 'Plastic Work'}</span>
            <span className="font-mono text-base font-extrabold text-amber-950 mt-1 tabular-nums">
              {energyStats.plasticWorkMJm3.toFixed(3)}
            </span>
            <span className="text-[10px] text-amber-800 font-bold font-mono">MJ/m³ (Dissipated)</span>
          </div>
        </div>

        {/* Five Milestone Thresholds List */}
        <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div className="font-bold text-slate-950 mb-0.5">মাইলফলক বিন্দুসমূহ (Benchmark Points):</div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">A. {t.common.proportionalLimit}:</span>
            <span className="font-mono font-bold text-emerald-800 tabular-nums">
              {activeMaterial.proportionalStress} MPa
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">B. {t.common.elasticLimit}:</span>
            <span className="font-mono font-bold text-sky-900 tabular-nums">
              {(activeMaterial.yieldStress * 0.96).toFixed(0)} MPa
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">C. {t.common.yieldPoint}:</span>
            <span className="font-mono font-bold text-amber-800 tabular-nums">
              {activeMaterial.yieldStress} MPa
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-800 font-semibold">D. {t.common.uts}:</span>
            <span className="font-mono font-bold text-purple-800 tabular-nums">
              {activeMaterial.ultimateStress} MPa
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-800 font-semibold">E. {t.common.breakingPoint}:</span>
            <span className="font-mono font-bold text-red-700 tabular-nums">
              {activeMaterial.fractureStress} MPa
            </span>
          </div>
        </div>

        {/* Operating Point Readout with Dynamic Point Name */}
        <div className="mt-auto p-3 bg-sky-50 rounded-xl border border-sky-300 text-xs flex flex-col gap-1.5 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-800">সক্রিয় বিন্দু / অঞ্চল (Active Point):</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
          </div>
          <div className="font-bold text-xs text-sky-950 bg-white p-2 rounded-lg border border-sky-200">
            {selectedStrain <= activeMaterial.proportionalStrain * 0.85
              ? (lang === 'bn' ? 'অঞ্চল OA: সরলরৈখিক সমানুপাতিক অঞ্চল (হুকের সূত্র)' : 'Zone OA: Linear Elastic Zone')
              : Math.abs(selectedStrain - activeMaterial.proportionalStrain) <= Math.max(0.0004, activeMaterial.proportionalStrain * 0.28) || (selectedStrain > activeMaterial.proportionalStrain * 0.85 && selectedStrain <= activeMaterial.proportionalStrain * 1.15)
              ? (lang === 'bn' ? 'বিন্দু A: সমানুপাতিক সীমা (Proportional Limit)' : 'Point A: Proportional Limit')
              : selectedStrain > activeMaterial.proportionalStrain * 1.15 && selectedStrain <= activeMaterial.yieldStrain * 0.92
              ? (lang === 'bn' ? 'বিন্দু B: স্থিতিস্থাপক সীমা (Elastic Recovery Limit)' : 'Point B: Elastic Limit')
              : Math.abs(selectedStrain - activeMaterial.yieldStrain) <= Math.max(0.0006, activeMaterial.yieldStrain * 0.18) || (selectedStrain > activeMaterial.yieldStrain * 0.92 && selectedStrain <= activeMaterial.yieldStrain * 1.25)
              ? (lang === 'bn' ? 'বিন্দু C: নমনীয় বিন্দু (Yield Point)' : 'Point C: Yield Point')
              : selectedStrain > activeMaterial.yieldStrain * 1.25 && selectedStrain < activeMaterial.ultimateStrain * 0.88
              ? (lang === 'bn' ? 'প্লাস্টিক অঞ্চল: স্ট্রেন হার্ডেনিং মালভূমি' : 'Plastic Strain Hardening Plateau')
              : Math.abs(selectedStrain - activeMaterial.ultimateStrain) <= Math.max(0.01, activeMaterial.ultimateStrain * 0.16) || (selectedStrain >= activeMaterial.ultimateStrain * 0.88 && selectedStrain <= activeMaterial.ultimateStrain * 1.08)
              ? (lang === 'bn' ? 'বিন্দু D: সর্বোচ্চ সহনশীল পীড়ন (UTS Peak Load)' : 'Point D: Ultimate Tensile Strength (UTS)')
              : (lang === 'bn' ? 'বিন্দু E: নেকিং ও অসহ ভাঙন বিন্দু (Fracture Point)' : 'Point E: Breaking / Fracture Point')}
          </div>
          <div className="font-mono font-extrabold text-xs text-slate-900 mt-0.5">
            ε = {selectedStrain.toFixed(4)} | σ = {currentStressAtProbe.toFixed(1)} MPa
          </div>
        </div>
      </aside>
    </div>
  );
};
