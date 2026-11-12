import React, { useState } from 'react';
import { ModuleId, Language } from './types/physics';
import { Header } from './components/Header';
import { Module1Young } from './components/Module1Young';
import { Module2Bulk } from './components/Module2Bulk';
import { Module3Shear } from './components/Module3Shear';
import { Module4Nexus } from './components/Module4Nexus';
import { Module5Graph } from './components/Module5Graph';

export default function App() {
  const [currentModule, setCurrentModule] = useState<ModuleId>('module1');
  const [lang, setLang] = useState<Language>('bn'); // 'বাংলা' by default as required

  const handleToggleLang = () => {
    setLang((prev) => (prev === 'bn' ? 'en' : 'bn'));
  };

  return (
    <div className="min-h-screen bg-sky-50/60 text-slate-950 flex flex-col font-sans">
      {/* Top Header & Branding */}
      <Header
        currentModule={currentModule}
        onSelectModule={setCurrentModule}
        lang={lang}
        onToggleLang={handleToggleLang}
      />

      {/* Main Simulation Viewport */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-3 sm:p-4 lg:p-6 flex flex-col">
        {currentModule === 'module1' && <Module1Young lang={lang} />}
        {currentModule === 'module2' && <Module2Bulk lang={lang} />}
        {currentModule === 'module3' && <Module3Shear lang={lang} />}
        {currentModule === 'module4' && <Module4Nexus lang={lang} />}
        {currentModule === 'module5' && <Module5Graph lang={lang} />}
      </main>

      {/* Minimal Academic Footer */}
      <footer className="border-t border-sky-200/80 bg-white/70 py-2.5 px-4 text-center text-xs text-slate-600">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="font-medium">
            {lang === 'bn'
              ? 'স্থিতিস্থাপকতা ও হুকের সূত্র ল্যাব • রিয়েল-টাইম ফিজিক্স ফ্রেমওয়ার্ক'
              : "Elasticity & Hooke's Law Studio • Real-Time Physics Framework"}
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
            <span>60 FPS Web Canvas</span>
            <span>•</span>
            <span>Interactive Stress-Strain Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
