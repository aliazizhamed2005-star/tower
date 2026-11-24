import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  ChevronRight,
  Layers,
  Play,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { FloorHotspot, TierFilter, TowerZone } from '../types/architecture';

interface FloorSelectionProps {
  visible: boolean;
  floors: FloorHotspot[];
  hoveredFloorId: string | null;
  tierFilter: TierFilter;
  studioMode: boolean;
  onChangeTierFilter: (filter: TierFilter) => void;
  onHoverFloor: (floorId: string | null) => void;
  onSelectFloor: (floor: FloorHotspot) => void;
  onStartTour: () => void;
  onOpenCalibration: () => void;
  onDirectoryOpenChange?: (open: boolean) => void;
}

const ZONE_ORDER: { zone: TowerZone; label: string }[] = [
  { zone: 'residential', label: 'Sky Residences' },
  { zone: 'podium', label: 'Club & Podium' },
  { zone: 'office', label: 'Office 04' },
];

const FILTER_OPTIONS: { id: TierFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'residential', label: 'Residences' },
  { id: 'office', label: 'Office' },
  { id: 'podium', label: 'Amenities' },
];

export const FloorSelection: React.FC<FloorSelectionProps> = ({
  visible,
  floors,
  hoveredFloorId,
  tierFilter,
  studioMode,
  onChangeTierFilter,
  onHoverFloor,
  onSelectFloor,
  onStartTour,
  onOpenCalibration,
  onDirectoryOpenChange,
}) => {
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  // Close the levels menu cleanly whenever leaving explore mode
  useEffect(() => {
    if (!visible) {
      setDirectoryOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    onDirectoryOpenChange?.(directoryOpen);
  }, [directoryOpen, onDirectoryOpenChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      if (visible) {
        gsap.set(el, { opacity: 1, overwrite: 'auto' });
        if (!prefersReducedMotion) {
          gsap.fromTo(
            '.explore-reveal',
            { opacity: 0, y: -8 },
            {
              opacity: 1,
              y: 0,
              duration: 0.4,
              stagger: 0.04,
              ease: 'power2.out',
              overwrite: 'auto',
              clearProps: 'transform',
            }
          );
        } else {
          gsap.set('.explore-reveal', { opacity: 1, y: 0 });
        }
      } else {
        gsap.to(el, {
          opacity: 0,
          duration: prefersReducedMotion ? 0.15 : 0.25,
          ease: 'power2.inOut',
          overwrite: 'auto',
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [visible]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !directoryOpen) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    gsap.fromTo(
      panel,
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'transform' }
    );
  }, [directoryOpen]);

  const visibleFloors = useMemo(() => {
    if (tierFilter === 'all') return floors;
    return floors.filter((f) => f.zone === tierFilter);
  }, [floors, tierFilter]);

  const groupedFloors = useMemo(() => {
    return ZONE_ORDER.map((group) => ({
      ...group,
      items: visibleFloors.filter((f) => f.zone === group.zone),
    })).filter((g) => g.items.length > 0);
  }, [visibleFloors]);

  const activeFloor = floors.find((f) => f.id === hoveredFloorId) || null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-20 pointer-events-none opacity-0"
      aria-hidden={!visible}
    >
      {/* Top-Left Quiet Active Level Readout */}
      <div className="fixed left-5 sm:left-8 lg:left-12 top-20 sm:top-24 pointer-events-none">
        <div className="explore-reveal hidden sm:block">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#C8A96E]">
            {activeFloor
              ? `${activeFloor.levelLabel} · ${activeFloor.status || activeFloor.tierLabel}`
              : 'Interactive Facade'}
          </div>
          <div className="font-display text-2xl text-[#F4F0EA] mt-0.5">
            {activeFloor ? activeFloor.title : 'Select any level on the tower'}
          </div>
        </div>
      </div>

      {/* Top-Right Compact Controls: Play Tour + Levels Toggle Button */}
      <div
        className={`fixed right-5 sm:right-8 lg:right-12 top-20 sm:top-24 flex flex-col items-end gap-2.5 ${
          visible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div className="explore-reveal flex items-center gap-2">
          <button
            type="button"
            onClick={onStartTour}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] tracking-[0.14em] uppercase text-[#DFC48F] bg-[#101216]/78 backdrop-blur-md border border-[#C8A96E]/35 hover:bg-[#C8A96E] hover:text-[#0B0C0E] transition-colors cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Tour</span>
          </button>

          <button
            type="button"
            onClick={() => setDirectoryOpen((prev) => !prev)}
            aria-expanded={directoryOpen}
            aria-label={directoryOpen ? 'Close tower levels list' : 'Open tower levels list'}
            className={`inline-flex items-center gap-2 px-4 py-2 text-[11px] tracking-[0.16em] uppercase backdrop-blur-md border transition-colors cursor-pointer ${
              directoryOpen
                ? 'bg-[#C8A96E] text-[#0B0C0E] border-[#C8A96E] font-medium'
                : 'bg-[#101216]/78 text-[#F4F0EA] border-white/15 hover:border-[#C8A96E]'
            }`}
          >
            {directoryOpen ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-[#C8A96E]" />
            )}
            <span>Levels</span>
            <span
              className={`font-mono text-[10px] tabular-nums ${
                directoryOpen ? 'text-[#0B0C0E]/80' : 'text-[#C8A96E]'
              }`}
            >
              {visibleFloors.length}
            </span>
          </button>
        </div>

        {directoryOpen && (
          <aside
            ref={panelRef}
            aria-label="Floor Elevation Directory"
            className="w-72 sm:w-80 max-h-[calc(100vh-10.5rem)] flex flex-col bg-[#101216]/88 backdrop-blur-xl border border-white/14 shadow-2xl"
          >
            {/* Clean single-line tier filter */}
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-1 bg-[#0B0C0E]/45">
              {FILTER_OPTIONS.map((opt) => {
                const active = tierFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeTierFilter(opt.id)}
                    className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#C8A96E] text-[#0B0C0E] font-medium'
                        : 'text-[#A6A095] hover:text-[#F4F0EA]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Minimal, uncluttered floor rows */}
            <div className="flex-1 overflow-y-auto arch-scroll py-2">
              {groupedFloors.map((group) => (
                <div key={group.zone} className="mb-2.5 last:mb-0">
                  <div className="px-4 py-1 text-[9px] tracking-[0.18em] uppercase text-[#A6A095]/70">
                    {group.label}
                  </div>
                  <div>
                    {group.items.map((floor) => {
                      const isHovered = hoveredFloorId === floor.id;
                      return (
                        <button
                          key={floor.id}
                          type="button"
                          onMouseEnter={() => onHoverFloor(floor.id)}
                          onMouseLeave={() => onHoverFloor(null)}
                          onClick={() => {
                            setDirectoryOpen(false);
                            onSelectFloor(floor);
                          }}
                          className={`w-full text-left px-4 py-2 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                            isHovered
                              ? 'bg-[#C8A96E]/15 text-[#F4F0EA]'
                              : 'hover:bg-white/[0.04] text-[#F4F0EA]/85'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-[10px] tracking-[0.12em] text-[#C8A96E] shrink-0 w-10">
                              {String(floor.floorNumber).padStart(2, '0')}F
                            </span>
                            <span className="text-xs truncate">{floor.title}</span>
                          </div>
                          <ChevronRight
                            className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                              isHovered ? 'text-[#DFC48F] opacity-100' : 'text-[#A6A095] opacity-35'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {studioMode && (
              <div className="px-4 py-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setDirectoryOpen(false);
                    onOpenCalibration();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 py-1.5 text-[10px] tracking-[0.14em] uppercase text-[#A6A095] hover:text-[#F4F0EA] transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3 h-3 text-[#C8A96E]" />
                  <span>Calibrate Hotspots</span>
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
