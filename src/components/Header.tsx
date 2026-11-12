import React from 'react';
import { ModuleId, Language } from '../types/physics';
import { translations } from '../utils/translations';
import { Activity, Globe, Compass } from 'lucide-react';

interface HeaderProps {
  currentModule: ModuleId;
  onSelectModule: (mod: ModuleId) => void;
  lang: Language;
  onToggleLang: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentModule,
  onSelectModule,
  lang,
  onToggleLang,
}) => {
  const t = translations[lang];

  const modulesList: { id: ModuleId; label: string; short: string; badge: string }[] = [
    { id: 'module1', label: t.modules.m1, short: lang === 'bn' ? 'মডিউল ১: ইয়াং (Y)' : 'Mod 1: Young (Y)', badge: 'Y' },
    { id: 'module2', label: t.modules.m2, short: lang === 'bn' ? 'মডিউল ২: আয়তন (K)' : 'Mod 2: Bulk (K)', badge: 'K' },
    { id: 'module3', label: t.modules.m3, short: lang === 'bn' ? 'মডিউল ৩: দৃঢ়তা (η)' : 'Mod 3: Shear (η)', badge: 'η' },
    { id: 'module4', label: t.modules.m4, short: lang === 'bn' ? 'মডিউল ৪: নেক্সাস ও পয়সন (σ)' : 'Mod 4: Nexus (σ)', badge: 'σ' },
    { id: 'module5', label: t.modules.m5, short: lang === 'bn' ? 'মডিউল ৫: গ্রাফ স্টুডিও (σ-ε)' : 'Mod 5: Stress-Strain', badge: 'σ-ε' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-sky-200 shadow-xs px-4 lg:px-6 py-2.5 transition-all">
      <div className="max-w-[1720px] mx-auto flex flex-col xl:flex-row items-center justify-between gap-3">
        {/* Left: Dynamic Studio Title & Brand */}
        <div className="flex items-center gap-3 shrink-0 self-start xl:self-auto">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-600 flex items-center justify-center text-white shadow-sm ring-2 ring-sky-100">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 flex items-center gap-2">
              <span>{t.appTitle}</span>
            </h1>
          </div>
        </div>

        {/* Center: 5 Interactive Navigation Tabs (Pill style buttons) */}
        <nav className="flex items-center gap-1.5 p-1 bg-sky-100/70 rounded-2xl border border-sky-200/80 overflow-x-auto max-w-full">
          {modulesList.map((m) => {
            const isActive = currentModule === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelectModule(m.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-emerald-800 shadow-sm border border-emerald-300 ring-1 ring-emerald-200/50'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
                }`}
                title={m.label}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center transition-colors ${
                    isActive ? 'bg-emerald-600 text-white' : 'bg-sky-200 text-slate-800'
                  }`}
                >
                  {m.badge}
                </span>
                <span className="truncate">{m.short}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Language Switcher & Prominent Bold Red Institution Badge (shifted to far right) */}
        <div className="flex items-center gap-2.5 shrink-0 self-end xl:self-auto">
          {/* Language Switcher */}
          <button
            onClick={onToggleLang}
            className="flex items-center gap-1.5 px-3 py-1 bg-sky-100 hover:bg-sky-200/80 border border-sky-300 rounded-full text-xs font-bold text-slate-900 transition-colors cursor-pointer"
            title="Toggle Language (বাংলা / English)"
          >
            <Globe className="w-3.5 h-3.5 text-sky-700" />
            <span>{t.langToggle}</span>
          </button>

          {/* Prominent Red Institution Badge as specified - shifted to the far right */}
          <span className="bg-rose-50 border border-rose-300 text-rose-600 font-extrabold px-3.5 py-1 rounded-full text-sm tracking-wide shadow-xs">
            {lang === 'bn' ? 'উদ্ভাস' : 'UDVASH'}
          </span>
        </div>
      </div>
    </header>
  );
};
