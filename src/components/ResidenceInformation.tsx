import React from 'react';
import { ChevronRight, Info, Map, X } from 'lucide-react';
import { FloorHotspot } from '../types/architecture';

interface ResidenceInformationProps {
  floor: FloorHotspot;
  currentViewIndex: number;
  totalViews: number;
  isOpen: boolean;
  onToggle: () => void;
  onBookViewing: () => void;
  onOpenFloorPlan?: () => void;
}

export const ResidenceInformation: React.FC<ResidenceInformationProps> = ({
  floor,
  currentViewIndex,
  totalViews,
  isOpen,
  onToggle,
  onBookViewing,
  onOpenFloorPlan,
}) => {
  const viewString = `VIEW ${String(currentViewIndex + 1).padStart(2, '0')} / ${String(
    Math.max(1, totalViews)
  ).padStart(2, '0')}`;

  const rows = [
    { label: 'Floor Number', value: floor.residenceInfo.floorNumber },
    { label: 'Residence Type', value: floor.residenceInfo.residenceType },
    { label: 'Bedrooms', value: floor.residenceInfo.bedrooms },
    { label: 'Bathrooms', value: floor.residenceInfo.bathrooms },
    { label: 'Area', value: floor.residenceInfo.area },
    { label: 'View', value: floor.residenceInfo.view },
    { label: 'Price', value: floor.residenceInfo.price },
  ];

  if (!isOpen) {
    return (
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        <div className="px-3 py-1.5 bg-[#101216]/75 backdrop-blur-md border border-white/12 font-mono text-[11px] tracking-[0.16em] text-[#DFC48F]">
          {viewString}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#101216]/80 backdrop-blur-md border border-white/15 hover:border-[#C8A96E] text-[11px] tracking-[0.15em] uppercase text-[#F4F0EA] transition-colors cursor-pointer"
        >
          <Info className="w-3.5 h-3.5 text-[#C8A96E]" />
          <span>Residence Details</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Residence Information"
      className="w-full sm:w-84 bg-[#101216]/85 backdrop-blur-xl border border-white/12 p-5 pointer-events-auto shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3.5">
        <div>
          <div className="font-mono text-[11px] tracking-[0.18em] text-[#C8A96E]">
            {viewString}
          </div>
          <div className="text-xs tracking-[0.14em] uppercase text-[#A6A095] mt-0.5">
            Level Specifications
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse level details"
          className="w-8 h-8 flex items-center justify-center border border-white/10 hover:border-[#C8A96E] text-[#A6A095] hover:text-[#F4F0EA] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <dl className="divide-y divide-white/8">
        {rows.map((row) => (
          <div key={row.label} className="py-2 flex items-baseline justify-between gap-4">
            <dt className="text-[11px] tracking-[0.1em] uppercase text-[#A6A095] shrink-0">
              {row.label}
            </dt>
            <dd className="text-xs text-[#F4F0EA] text-right font-medium">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 space-y-2">
        {floor.zone === 'residential' && onOpenFloorPlan && (
          <button
            type="button"
            onClick={onOpenFloorPlan}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium tracking-[0.14em] uppercase border border-[#C8A96E]/55 text-[#F4F0EA] hover:border-[#C8A96E] hover:text-[#DFC48F] transition-colors cursor-pointer"
          >
            <Map className="w-3.5 h-3.5 text-[#C8A96E]" />
            <span>Residential Floor Plan</span>
          </button>
        )}

        <button
          type="button"
          onClick={onBookViewing}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium tracking-[0.16em] uppercase bg-[#C8A96E] text-[#0B0C0E] hover:bg-[#DFC48F] transition-colors cursor-pointer"
        >
          <span>Enquire About {floor.levelLabel}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
