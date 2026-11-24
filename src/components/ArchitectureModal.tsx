import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Compass, Layers, MapPin, X } from 'lucide-react';
import { ExtractedScene, LocationContext, TowerSpecs } from '../types/architecture';

interface ArchitectureModalProps {
  open: boolean;
  elevationSrc: string;
  specs: TowerSpecs;
  location: LocationContext;
  scenes: ExtractedScene[];
  onClose: () => void;
  onExploreTower: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({
  open,
  elevationSrc,
  specs,
  location,
  scenes,
  onClose,
  onExploreTower,
}) => {
  const [tab, setTab] = useState<'architecture' | 'location'>('architecture');
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab('architecture');
    if (panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: 18, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.38, ease: 'power3.out', clearProps: 'transform' }
      );
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const residentialCount = scenes.filter((s) => s.zone === 'residential').length;
  const officeCount = scenes.filter((s) => s.zone === 'office').length;
  const podiumCount = scenes.filter((s) => s.zone === 'podium').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="architecture-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0B0C0E]/85 backdrop-blur-lg"
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-4xl bg-[#141619] border border-white/15 shadow-2xl max-h-[90vh] overflow-y-auto arch-scroll"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-white/10">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-[#C8A96E]">
              Architectural Dossier
            </div>
            <h2 id="architecture-modal-title" className="font-display text-2xl sm:text-3xl text-[#F4F0EA]">
              Facade, Engineering &amp; Site Orientation
            </h2>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <div className="flex items-center border border-white/15 bg-[#0B0C0E]/70 p-0.5">
              <button
                type="button"
                onClick={() => setTab('architecture')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-[0.14em] uppercase transition-colors cursor-pointer ${
                  tab === 'architecture'
                    ? 'bg-[#C8A96E] text-[#0B0C0E] font-medium'
                    : 'text-[#A6A095] hover:text-[#F4F0EA]'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Architecture</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('location')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-[0.14em] uppercase transition-colors cursor-pointer ${
                  tab === 'location'
                    ? 'bg-[#C8A96E] text-[#0B0C0E] font-medium'
                    : 'text-[#A6A095] hover:text-[#F4F0EA]'
                }`}
              >
                <MapPin className="w-3 h-3" />
                <span>Orientation</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close architecture overview"
              className="w-10 h-10 flex items-center justify-center border border-white/15 hover:border-[#C8A96E] text-[#A6A095] hover:text-[#F4F0EA] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-5 bg-[#0B0C0E] border-b md:border-b-0 md:border-r border-white/10 relative">
            <img
              src={elevationSrc}
              alt="Tower Elevation Study"
              referrerPolicy="no-referrer"
              className="w-full h-64 md:h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-[#0B0C0E] via-[#0B0C0E]/75 to-transparent">
              <div className="grid grid-cols-2 gap-2.5 text-[10px]">
                <div className="border-t border-white/15 pt-1.5">
                  <div className="uppercase tracking-[0.12em] text-[#A6A095]">Scale</div>
                  <div className="font-mono text-[#F4F0EA] mt-0.5">{specs.totalLevels}</div>
                </div>
                <div className="border-t border-white/15 pt-1.5">
                  <div className="uppercase tracking-[0.12em] text-[#A6A095]">Clear Span</div>
                  <div className="font-mono text-[#F4F0EA] mt-0.5">{specs.ceilingHeight}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 p-6 flex flex-col justify-between gap-5">
            {tab === 'architecture' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 pb-1">
                  <div className="border border-white/10 bg-[#0B0C0E]/55 px-3 py-2.5">
                    <div className="text-[10px] tracking-[0.14em] uppercase text-[#C8A96E]">
                      Structural System
                    </div>
                    <div className="text-xs text-[#F4F0EA] mt-0.5">{specs.structure}</div>
                  </div>
                  <div className="border border-white/10 bg-[#0B0C0E]/55 px-3 py-2.5">
                    <div className="text-[10px] tracking-[0.14em] uppercase text-[#C8A96E]">
                      Release Status
                    </div>
                    <div className="text-xs text-[#F4F0EA] mt-0.5">{specs.completion}</div>
                  </div>
                </div>

                <div className="border-b border-white/10 pb-3.5">
                  <h3 className="font-display text-xl text-[#F4F0EA]">
                    01. Structural Diagrid &amp; Cantilevered Crown
                  </h3>
                  <p className="text-xs text-[#A6A095] leading-relaxed mt-1">
                    Dark tinted curtain-wall glazing framed by a continuous diagonal structural steel
                    exoskeleton, contrasted by vertical white balcony bays and an angled glass crown.
                  </p>
                </div>

                <div className="border-b border-white/10 pb-3.5">
                  <h3 className="font-display text-xl text-[#F4F0EA]">
                    02. Stacked Podium &amp; Recessed Transfer Tiers
                  </h3>
                  <p className="text-xs text-[#A6A095] leading-relaxed mt-1">
                    Two tapered diagrid lower blocks sit atop an arched stone-and-glass podium base,
                    separated by deep shadow-recessed transfer levels housing amenity and club floors.
                  </p>
                </div>

                <div className="pb-1">
                  <h3 className="font-display text-xl text-[#F4F0EA]">
                    03. Curated Interior Palette ({scenes.length} Views)
                  </h3>
                  <p className="text-xs text-[#A6A095] leading-relaxed mt-1">
                    Across {residentialCount} residential views, {officeCount} Tower Office 04 views,
                    and {podiumCount} podium amenity views, interiors pair dark walnut millwork,
                    veined grey marble, warm architectural cove lighting, and panoramic diagrid views.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border border-white/10 bg-[#0B0C0E]/55 p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] tracking-[0.16em] uppercase text-[#C8A96E]">
                      Urban Context &amp; Axis
                    </div>
                    <div className="font-display text-xl text-[#F4F0EA] mt-0.5">
                      {location.district}
                    </div>
                    <div className="font-mono text-[11px] text-[#A6A095] mt-1">
                      {location.orientation}
                    </div>
                  </div>

                  {/* Minimalist Architectural Solar Compass SVG */}
                  <svg
                    viewBox="0 0 80 80"
                    className="w-16 h-16 shrink-0 text-[#C8A96E]"
                    aria-hidden="true"
                  >
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.3"
                      strokeWidth="1"
                    />
                    <line
                      x1="40"
                      y1="8"
                      x2="40"
                      y2="72"
                      stroke="currentColor"
                      strokeOpacity="0.25"
                      strokeWidth="1"
                    />
                    <line
                      x1="8"
                      y1="40"
                      x2="72"
                      y2="40"
                      stroke="currentColor"
                      strokeOpacity="0.25"
                      strokeWidth="1"
                    />
                    <polygon points="40,12 45,38 40,34 35,38" fill="currentColor" />
                    <text
                      x="40"
                      y="7"
                      textAnchor="middle"
                      fill="#F4F0EA"
                      fontSize="8"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      N
                    </text>
                  </svg>
                </div>

                <div className="space-y-3">
                  {location.highlights.map((item, idx) => (
                    <div key={item.id} className="border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[#C8A96E]">
                          0{idx + 1}
                        </span>
                        <h3 className="font-display text-lg text-[#F4F0EA]">{item.label}</h3>
                      </div>
                      <p className="text-xs text-[#A6A095] leading-relaxed mt-1">{item.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-3 flex items-center justify-between text-[11px]">
                  <span className="uppercase tracking-[0.12em] text-[#A6A095]">Connectivity</span>
                  <span className="text-[#DFC48F]">{location.connectivity}</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExploreTower();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium tracking-[0.16em] uppercase bg-[#C8A96E] text-[#0B0C0E] hover:bg-[#DFC48F] transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Explore the Tower</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
