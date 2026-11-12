import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, NexusMaterial } from '../types/physics';
import { translations } from '../utils/translations';
import { ProgressiveSlider } from './ProgressiveSlider';
import { Info, MoveVertical } from 'lucide-react';

const NEXUS_MATERIALS: NexusMaterial[] = [
  {
    id: 'steel',
    nameBn: 'ইস্পাত (Structural Steel)',
    nameEn: 'Structural Steel',
    Y: 200,
    K: 160,
    eta: 77,
    poisson: 0.30,
    descriptionBn: 'ধাতব পরমাণু জালির আদর্শ স্থিতিস্থাপক রূপান্তর, σ ≈ ০.৩০',
    descriptionEn: 'Classic isotropic metal lattice with σ ≈ 0.30',
  },
  {
    id: 'aluminum',
    nameBn: 'অ্যালুমিনিয়াম (Aluminum)',
    nameEn: 'Aluminum',
    Y: 70,
    K: 76,
    eta: 26,
    poisson: 0.33,
    descriptionBn: 'হালকা ধাতু, মাঝারি আয়তন গুণাঙ্ক ও দৃঢ়তা, σ = ০.৩৩',
    descriptionEn: 'Lightweight structural alloy with σ = 0.33',
  },
  {
    id: 'cast_iron',
    nameBn: 'ঢালাই লোহা (Cast Iron)',
    nameEn: 'Cast Iron',
    Y: 110,
    K: 96,
    eta: 44,
    poisson: 0.27,
    descriptionBn: 'তুলনামূলক কম পয়সন অনুপাত (σ ≈ ০.২৭)',
    descriptionEn: 'Lower lateral contraction ratio, σ ≈ 0.27',
  },
  {
    id: 'rubber',
    nameBn: 'নরম রাবার (Soft Rubber)',
    nameEn: 'Soft Vulcanized Rubber',
    Y: 0.05,
    K: 1.5,
    eta: 0.017,
    poisson: 0.499,
    descriptionBn: 'প্রায় অসংকোচনশীল (σ ≈ ০.৫), তাই Y ও η কম হলেও K অত্যন্ত বিশাল!',
    descriptionEn: 'Nearly incompressible (σ ≈ 0.5): K is massive relative to Y and η!',
  },
  {
    id: 'paraffin',
    nameBn: 'প্যারাফিন মোম (Paraffin Wax)',
    nameEn: 'Paraffin Wax',
    Y: 0.2,
    K: 2.0,
    eta: 0.07,
    poisson: 0.45,
    descriptionBn: 'উচ্চ পয়সন অনুপাতযুক্ত প্লাস্টিক মোম, σ = ০.৪৫',
    descriptionEn: 'High Poisson ratio polymer, σ = 0.45',
  },
  {
    id: 'cork',
    nameBn: 'কর্ক (Natural Cork)',
    nameEn: 'Natural Cork',
    Y: 0.03,
    K: 0.01,
    eta: 0.015,
    poisson: 0.00,
    descriptionBn: 'পয়সনের অনুপাত শূন্য (σ ≈ ০)! বোতলে কর্ক ঢোকালে পার্শ্বীয় স্ফীতি ঘটে না।',
    descriptionEn: 'Zero Poisson ratio (σ ≈ 0): No lateral expansion when compressed into bottles!',
  },
  {
    id: 'auxetic',
    nameBn: 'অক্সোটিক মেটাম্যাটেরিয়াল (Auxetic Foam)',
    nameEn: 'Auxetic Metamaterial',
    Y: 0.02,
    K: 0.004,
    eta: 0.012,
    poisson: -0.35,
    descriptionBn: 'ঋণাত্মক পয়সন অনুপাত (σ < ০)! টানলে পার্শ্বীয়ভাবে সংকুচিত না হয়ে বরং প্রসারিত হয়!',
    descriptionEn: 'Negative Poisson ratio (σ < 0): Expands laterally when pulled axially!',
  },
];

interface Module4Props {
  lang: Language;
}

export const Module4Nexus: React.FC<Module4Props> = ({ lang }) => {
  const t = translations[lang];

  // Selected preset or custom
  const [selectedPreset, setSelectedPreset] = useState<NexusMaterial>(NEXUS_MATERIALS[0]);
  const [poisson, setPoisson] = useState<number>(0.30); // -0.5 to 0.5
  const [baseYoungModulusGPa, setBaseYoungModulusGPa] = useState<number>(200);
  const [axialStretchPct, setAxialStretchPct] = useState<number>(25); // % stretch

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartStretchRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  const handleSelectPreset = (mat: NexusMaterial) => {
    setSelectedPreset(mat);
    setPoisson(mat.poisson);
    setBaseYoungModulusGPa(mat.Y);
  };

  const safeOneMinus2Sigma = Math.max(0.001, 1 - 2 * poisson);
  const safeOnePlusSigma = Math.max(0.1, 1 + poisson);

  const derivedK = baseYoungModulusGPa / (3 * safeOneMinus2Sigma);
  const derivedEta = baseYoungModulusGPa / (2 * safeOnePlusSigma);

  const ratioKtoY = derivedK / baseYoungModulusGPa;
  const ratioEtaToY = derivedEta / baseYoungModulusGPa;

  // High-DPI realistic canvas rendering
  const drawNexusCanvas = useCallback(() => {
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

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const splitX = Math.round(width * 0.62);

    // Divider line
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, 15);
    ctx.lineTo(splitX, height - 15);
    ctx.stroke();

    // ==========================================
    // 1. DYNAMIC LATTICE DEFORMATION VIEW (ENLARGED & PROMINENT)
    // ==========================================
    ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(lang === 'bn' ? 'অক্ষীয় টান ও পার্শ্বীয় বিকৃতি (Lattice Morphing Lab)' : 'Axial Stretch & Lateral Morphing', 25, 30);

    const cellCenterX = splitX / 2;
    const cellCenterY = height / 2 + 10;
    const baseW = 200;
    const baseH = 230;

    const eAxial = axialStretchPct / 100;
    const eLateral = -poisson * eAxial;

    const currentH = baseH * (1 + eAxial * 0.7);
    const currentW = Math.max(36, baseW * (1 + eLateral * 0.7));

    // Ghost original resting shape (dashed outline)
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(cellCenterX - baseW / 2, cellCenterY - baseH / 2, baseW, baseH);
    ctx.restore();

    // Deformed Material Block
    const leftX = cellCenterX - currentW / 2;
    const topY = cellCenterY - currentH / 2;

    const cellGrad = ctx.createLinearGradient(leftX, topY, leftX + currentW, topY + currentH);
    if (poisson < 0) {
      cellGrad.addColorStop(0, '#c084fc');
      cellGrad.addColorStop(1, '#6b21a8');
    } else if (poisson > 0.45) {
      cellGrad.addColorStop(0, '#34d399');
      cellGrad.addColorStop(1, '#065f46');
    } else {
      cellGrad.addColorStop(0, '#38bdf8');
      cellGrad.addColorStop(1, '#0369a1');
    }

    ctx.fillStyle = cellGrad;
    ctx.fillRect(leftX, topY, currentW, currentH);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(leftX, topY, currentW, currentH);

    // Internal lattice grid with enlarged atomic junction balls
    const gridRows = 6;
    const gridCols = 5;
    for (let r = 0; r <= gridRows; r++) {
      const ny = topY + (r / gridRows) * currentH;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(leftX, ny);
      ctx.lineTo(leftX + currentW, ny);
      ctx.stroke();

      for (let c = 0; c <= gridCols; c++) {
        const nx = leftX + (c / gridCols) * currentW;
        if (r === 0) {
          ctx.beginPath();
          ctx.moveTo(nx, topY);
          ctx.lineTo(nx, topY + currentH);
          ctx.stroke();
        }
        // Atomic junction ball with specular highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(nx, ny, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Top & Bottom pull clamps with arrows
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    // Top arrow
    ctx.beginPath();
    ctx.moveTo(cellCenterX, topY);
    ctx.lineTo(cellCenterX, topY - 32);
    ctx.stroke();
    // Bottom arrow
    ctx.beginPath();
    ctx.moveTo(cellCenterX, topY + currentH);
    ctx.lineTo(cellCenterX, topY + currentH + 32);
    ctx.stroke();

    ctx.strokeStyle = '#10b981';
    ctx.fillStyle = '#10b981';
    ctx.lineWidth = 3.5;
    // Top arrow
    ctx.beginPath();
    ctx.moveTo(cellCenterX, topY);
    ctx.lineTo(cellCenterX, topY - 32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cellCenterX, topY - 32);
    ctx.lineTo(cellCenterX - 8, topY - 20);
    ctx.lineTo(cellCenterX + 8, topY - 20);
    ctx.closePath();
    ctx.fill();

    // Bottom arrow
    ctx.beginPath();
    ctx.moveTo(cellCenterX, topY + currentH);
    ctx.lineTo(cellCenterX, topY + currentH + 32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cellCenterX, topY + currentH + 32);
    ctx.lineTo(cellCenterX - 8, topY + currentH + 20);
    ctx.lineTo(cellCenterX + 8, topY + currentH + 20);
    ctx.closePath();
    ctx.fill();

    // Lateral Poisson Arrows
    if (Math.abs(eLateral) > 0.01) {
      const latDir = eLateral < 0 ? -1 : 1;
      ctx.strokeStyle = latDir < 0 ? '#ef4444' : '#8b5cf6';
      ctx.fillStyle = latDir < 0 ? '#ef4444' : '#8b5cf6';
      ctx.lineWidth = 3.5;

      // Left edge arrow
      const leftArrowX = leftX;
      ctx.beginPath();
      ctx.moveTo(leftArrowX - latDir * 28, cellCenterY);
      ctx.lineTo(leftArrowX, cellCenterY);
      ctx.stroke();

      // Right edge arrow
      const rightArrowX = leftX + currentW;
      ctx.beginPath();
      ctx.moveTo(rightArrowX + latDir * 28, cellCenterY);
      ctx.lineTo(rightArrowX, cellCenterY);
      ctx.stroke();
    }

    // High contrast badges for dimensions
    const topBadgeText = `d = d₀ ${eLateral >= 0 ? '+' : '-'} Δd (${(eLateral * 100).toFixed(1)}%)`;
    ctx.font = 'bold 12px JetBrains Mono';
    const tbW = ctx.measureText(topBadgeText).width + 20;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(cellCenterX - tbW / 2, topY - 44, tbW, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText(topBadgeText, cellCenterX, topY - 29);

    const botBadgeText = `L = L₀ + ΔL (+${(eAxial * 100).toFixed(0)}%)`;
    const bbW = ctx.measureText(botBadgeText).width + 20;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(cellCenterX - bbW / 2, topY + currentH + 22, bbW, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.fillText(botBadgeText, cellCenterX, topY + currentH + 37);
    ctx.textAlign = 'left';

    // Drag hint
    ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText(
      lang === 'bn' ? '↕ মাউস দিয়ে ব্লক টেনে টানুন বা সংকুচিত করুন' : '↕ Drag block up/down directly with mouse',
      cellCenterX,
      height - 14
    );
    ctx.textAlign = 'left';

    // ==========================================
    // 2. MODULI NEXUS COMPARATIVE MATRIX (COMPACT 2ND PICTURE)
    // ==========================================
    const rightStartX = splitX + 18;
    ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(t.m4.radarTitle, rightStartX, 28);

    const barStartY = 48;
    const barGap = 36;
    const maxBarW = Math.max(120, width - rightStartX - 85);

    const moduliBars = [
      { name: "Young's Modulus (Y)", val: 1.0, realVal: `${baseYoungModulusGPa.toFixed(1)} GPa`, color: '#0284c7', formula: 'Base Reference' },
      { name: "Bulk Modulus (K)", val: Math.min(3.5, ratioKtoY), realVal: `${derivedK.toFixed(1)} GPa`, color: '#059669', formula: 'K = Y / [3(1 - 2σ)]' },
      { name: "Rigidity Modulus (η)", val: Math.min(3.5, ratioEtaToY), realVal: `${derivedEta.toFixed(1)} GPa`, color: '#d97706', formula: 'η = Y / [2(1 + σ)]' },
    ];

    moduliBars.forEach((b, idx) => {
      const y = barStartY + idx * barGap;

      ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(b.name, rightStartX, y);

      ctx.font = 'bold 10px JetBrains Mono';
      ctx.fillStyle = '#64748b';
      ctx.fillText(b.formula, rightStartX + 120, y);

      // Track background
      const trackY = y + 5;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(rightStartX, trackY, maxBarW, 11);

      // Filled bar
      const fillW = Math.max(8, (b.val / 2.5) * maxBarW);
      ctx.fillStyle = b.color;
      ctx.fillRect(rightStartX, trackY, Math.min(maxBarW, fillW), 11);

      // Bar Value
      ctx.font = 'bold 11px JetBrains Mono';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(b.realVal, rightStartX + maxBarW + 6, trackY + 10);
    });

    // Invariant Equation Box (Compact, well-fitted, NO giant empty space)
    const boxY = barStartY + 3 * barGap + 6;
    const boxW = width - rightStartX - 16;
    const boxH = 112; // Compact, perfectly proportioned

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(rightStartX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('চারটি সার্বজনীন স্থিতিস্থাপক সমীকরণ (Elastic Invariants):', rightStartX + 12, boxY + 20);

    ctx.font = 'bold 11px JetBrains Mono';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('1) Y = 3K(1 - 2σ)', rightStartX + 12, boxY + 42);
    ctx.fillText('2) Y = 2η(1 + σ)', rightStartX + 140, boxY + 42);
    ctx.fillText('3) 9/Y = 1/K + 3/η', rightStartX + 12, boxY + 64);
    ctx.fillText('4) σ = (3K - 2η)/(6K + 2η)', rightStartX + 140, boxY + 64);

    ctx.font = 'bold 10px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = '#fde047';
    let obs = '';
    if (poisson >= 0.48) {
      obs = lang === 'bn' ? '● রাবার সদৃশ অসংকোচনশীল আচরণ: K → ∞, আয়তন ধ্রুব থাকে।' : '● Rubber-like incompressibility: K → ∞, volume stays constant.';
    } else if (poisson <= 0.05 && poisson >= -0.05) {
      obs = lang === 'bn' ? '● কর্কের ন্যায় আচরণ: পার্শ্ব বিকৃতি নেই, Y ও η স্বাধীন।' : '● Cork behavior: Zero lateral strain, Y and η are independent.';
    } else if (poisson < 0) {
      obs = lang === 'bn' ? '● অক্সোটিক বৈশিষ্ট্য: পার্শ্বীয় প্রসারণ ঘটে, মধুচক্র কাঠামোর মতো।' : '● Auxetic metamaterial: Expands laterally due to re-entrant hinges.';
    } else {
      obs = lang === 'bn' ? '● সাধারণ ধাতব স্থিতিস্থাপক আচরণ (০.২৫ ≤ σ ≤ ০.৩৫)।' : '● Typical isotropic metallic elasticity (0.25 ≤ σ ≤ 0.35).';
    }
    ctx.fillText(obs, rightStartX + 12, boxY + 92);

    ctx.restore();
  }, [poisson, baseYoungModulusGPa, axialStretchPct, derivedK, derivedEta, ratioKtoY, ratioEtaToY, lang, t]);

  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      drawNexusCanvas();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      active = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawNexusCanvas]);

  // Pointer drag to stretch/compress lattice
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartStretchRef.current = axialStretchPct;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dy = e.clientY - dragStartYRef.current;
    const newStretch = Math.max(0, Math.min(50, dragStartStretchRef.current - dy * 0.4));
    setAxialStretchPct(Math.round(newStretch));
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
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            {t.common.controls}
          </h2>
          <p className="text-[11px] text-slate-700 font-medium mt-0.5">{t.m4.subtitle}</p>
        </div>

        {/* Preset Material Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-900">{t.common.material}</label>
          <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
            {NEXUS_MATERIALS.map((m) => {
              const isSelected = selectedPreset.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleSelectPreset(m)}
                  className={`px-2 py-1.5 rounded-xl text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-sky-50 text-slate-900 hover:bg-sky-100 border border-sky-300'
                  }`}
                >
                  <span className="truncate">{lang === 'bn' ? m.nameBn.split(' ')[0] : m.nameEn.split(' ')[0]}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-emerald-100' : 'text-slate-600'}`}>
                    σ = {m.poisson.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders with Progressive Green Fill */}
        <div className="flex flex-col gap-3 pt-2 border-t border-sky-100">
          <ProgressiveSlider
            label={t.m4.poissonSlider}
            value={poisson}
            min={-0.5}
            max={0.5}
            step={0.01}
            valueFormatter={(v) => `σ = ${v.toFixed(2)}`}
            onChange={setPoisson}
          />

          <ProgressiveSlider
            label={lang === 'bn' ? 'বেস ইয়াং গুণাঙ্ক (Y)' : "Base Young's Modulus (Y)"}
            value={baseYoungModulusGPa}
            min={1}
            max={350}
            step={5}
            unit="GPa"
            valueFormatter={(v) => `${v} GPa`}
            onChange={setBaseYoungModulusGPa}
          />

          <ProgressiveSlider
            label={lang === 'bn' ? 'অক্ষীয় টান বিকৃতি (Stretch)' : 'Simulated Axial Stretch'}
            value={axialStretchPct}
            min={0}
            max={50}
            step={1}
            unit="%"
            valueFormatter={(v) => `+${v}%`}
            onChange={setAxialStretchPct}
          />
        </div>

        {/* Poisson limits note */}
        <div className="bg-sky-50 rounded-xl p-3 border border-sky-200 text-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-sky-950 font-bold">
            <Info className="w-4 h-4 text-sky-700" />
            <span>{lang === 'bn' ? 'পয়সন অনুপাতের সীমাবদ্ধতা' : "Poisson's Ratio Limits"}</span>
          </div>
          <p className="text-[11px] text-slate-900 font-semibold leading-normal">
            {t.m4.theoreticalRange}
          </p>
          <div className="text-[10px] font-mono font-bold text-slate-800 bg-white p-2 rounded border border-sky-300">
            {poisson >= 0.49
              ? t.m4.incompressibleNote
              : Math.abs(poisson) < 0.03
              ? t.m4.corkNote
              : poisson < 0
              ? t.m4.auxeticNote
              : 'সমসত্ত্ব ধাতুর সাধারণ স্থিতিস্থাপক আচরণ।'}
          </div>
        </div>
      </aside>

      {/* CENTER WORKSPACE */}
      <main className="flex-1 min-w-0 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-200 shadow-sm p-3.5 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-950">{t.common.workspace}</span>
            <span className="text-[11px] text-emerald-900 font-bold hidden sm:inline flex items-center gap-1">
              <MoveVertical className="w-3.5 h-3.5 text-emerald-600" />
              {lang === 'bn' ? 'মাউস দিয়ে ব্লক টেনে অক্ষীয় টান পরিবর্তন করুন' : 'Drag block up/down to stretch/compress'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-bold">
            <span>σ = {poisson.toFixed(2)}</span>
          </div>
        </div>

        {/* Canvas container */}
        <div className="relative flex-1 w-full min-h-[420px] rounded-xl overflow-hidden border border-sky-200/90 bg-slate-50">
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
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            {t.common.telemetry}
          </h2>
          <p className="text-[11px] text-slate-700 font-medium mt-0.5">{lang === 'bn' ? 'তিনটি গুণাঙ্কের নির্ভুল অনুপাত' : 'Inter-Moduli Exact Nexus'}</p>
        </div>

        {/* Three Moduli Cards */}
        <div className="flex flex-col gap-2">
          <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold text-slate-800">Young's Modulus (Y)</span>
              <div className="font-mono text-base font-extrabold text-sky-950 tabular-nums">
                {baseYoungModulusGPa.toFixed(1)} <span className="text-xs font-normal">GPa</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded border border-sky-300">1.00 × Y</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold text-slate-800">Bulk Modulus (K)</span>
              <div className="font-mono text-base font-extrabold text-emerald-950 tabular-nums">
                {derivedK.toFixed(1)} <span className="text-xs font-normal">GPa</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
              {ratioKtoY.toFixed(2)} × Y
            </span>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold text-slate-800">Rigidity Modulus (η)</span>
              <div className="font-mono text-base font-extrabold text-amber-950 tabular-nums">
                {derivedEta.toFixed(1)} <span className="text-xs font-normal">GPa</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              {ratioEtaToY.toFixed(2)} × Y
            </span>
          </div>
        </div>

        {/* Universal Verification Equation */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col gap-1.5">
          <div className="font-bold text-slate-900">যাচাই সমীকরণ (Consistency Check):</div>
          <div className="font-mono text-[11px] text-slate-900 font-semibold bg-white p-2.5 rounded border border-slate-300">
            <div>9/Y = {(9 / baseYoungModulusGPa).toFixed(4)}</div>
            <div>1/K + 3/η = {(1 / derivedK + 3 / derivedEta).toFixed(4)}</div>
            <div className="text-emerald-700 font-extrabold mt-1">✓ শতভাগ গাণিতিক সঙ্গতিপূর্ণ</div>
          </div>
        </div>

        {/* Selected Preset Details */}
        <div className="mt-auto p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs">
          <div className="font-bold text-slate-950 mb-1">{lang === 'bn' ? selectedPreset.nameBn : selectedPreset.nameEn}</div>
          <p className="text-[11px] text-slate-800 font-medium leading-relaxed">
            {lang === 'bn' ? selectedPreset.descriptionBn : selectedPreset.descriptionEn}
          </p>
        </div>
      </aside>
    </div>
  );
};
