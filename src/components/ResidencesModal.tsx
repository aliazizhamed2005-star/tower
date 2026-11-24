import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ArrowRight, Map, X } from 'lucide-react';
import { FloorHotspot, TowerZone } from '../types/architecture';

interface ResidencesModalProps {
  open: boolean;
  floors: FloorHotspot[];
  onClose: () => void;
  onSelectFloor: (floor: FloorHotspot) => void;
  onOpenFloorPlan: () => void;
}

const TIER_GROUPS: { zone: TowerZone; heading: string; description: string }[] = [
  {
    zone: 'residential',
    heading: 'Sky Residences',
    description: 'Upper diagrid tower residences featuring corner panoramic glazing and private sky suites.',
  },
  {
    zone: 'office',
    heading: 'Tower Office 04 & Commercial Tiers',
    description: 'Lower diagrid executive floorplates with reception atrium, boardrooms, and work lounges.',
  },
  {
    zone: 'podium',
    heading: 'Podium, Sky Club & Wellness',
    description: 'Arched arrival colonnade, boutique gallery, resident evening lounge, and fitness studio.',
  },
];

export const ResidencesModal: React.FC<ResidencesModalProps> = ({
  open,
  floors,
  onClose,
  onSelectFloor,
  onOpenFloorPlan,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="residences-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0B0C0E]/85 backdrop-blur-lg"
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-4xl bg-[#141619] border border-white/15 shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-[#C8A96E]">
              Tower Directory
            </div>
            <h2 id="residences-modal-title" className="font-display text-2xl sm:text-3xl text-[#F4F0EA]">
              Residences &amp; Tower Tiers
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close residences directory"
            className="w-10 h-10 flex items-center justify-center border border-white/15 hover:border-[#C8A96E] text-[#A6A095] hover:text-[#F4F0EA] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto arch-scroll space-y-8">
          {TIER_GROUPS.map((group) => {
            const matching = floors.filter((f) => f.zone === group.zone);
            if (matching.length === 0) return null;

            return (
              <section key={group.zone}>
                <div className="mb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl text-[#F4F0EA]">{group.heading}</h3>
                    <p className="text-xs text-[#A6A095] mt-0.5">{group.description}</p>
                  </div>

                  {group.zone === 'residential' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenFloorPlan();
                      }}
                      className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] tracking-[0.14em] uppercase border border-[#C8A96E]/55 bg-[#0B0C0E]/60 text-[#DFC48F] hover:bg-[#C8A96E] hover:text-[#0B0C0E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Map className="w-3.5 h-3.5" />
                      <span>View Floor Plan</span>
                    </button>
                  )}
                </div>

                <div className="divide-y divide-white/10 border border-white/10 bg-[#0B0C0E]/50">
                  {matching.map((floor) => (
                    <div
                      key={floor.id}
                      className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-[#C8A96E]">
                          <span>{floor.levelLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#A6A095] font-sans">{floor.residenceInfo.residenceType}</span>
                        </div>
                        <div className="font-display text-lg text-[#F4F0EA] mt-0.5">
                          {floor.title}
                        </div>
                        <div className="text-[11px] text-[#A6A095] mt-0.5">
                          {floor.residenceInfo.bedrooms} · {floor.residenceInfo.view}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectFloor(floor);
                        }}
                        className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2 text-[11px] font-medium tracking-[0.14em] uppercase border border-[#C8A96E]/55 text-[#F4F0EA] hover:bg-[#C8A96E] hover:text-[#0B0C0E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Zoom to Level</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
