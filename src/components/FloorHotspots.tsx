import React from 'react';
import { FloorHotspot, ImageBounds, TierFilter } from '../types/architecture';

interface FloorHotspotsProps {
  floors: FloorHotspot[];
  bounds: ImageBounds;
  hoveredFloorId: string | null;
  selectedFloorId: string | null;
  tierFilter: TierFilter;
  interactive: boolean;
  showGuideOutlines: boolean;
  suppressCallouts?: boolean;
  onHoverFloor: (floorId: string | null) => void;
  onSelectFloor: (floor: FloorHotspot) => void;
}

export const FloorHotspots: React.FC<FloorHotspotsProps> = ({
  floors,
  bounds,
  hoveredFloorId,
  selectedFloorId,
  tierFilter,
  interactive,
  showGuideOutlines,
  suppressCallouts = false,
  onHoverFloor,
  onSelectFloor,
}) => {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const isFiltered = tierFilter !== 'all';

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-label="Interactive tower floor hotspots"
    >
      {floors.map((floor) => {
        const matchesTier = tierFilter === 'all' || floor.zone === tierFilter;
        const isHovered = hoveredFloorId === floor.id;
        const isSelected = selectedFloorId === floor.id;
        const active = isHovered || (isSelected && !hoveredFloorId);
        const canInteract = interactive && matchesTier;

        const left = bounds.left + floor.x * bounds.width;
        const top = bounds.top + floor.y * bounds.height;
        const width = floor.width * bounds.width;
        const height = floor.height * bounds.height;

        // Flip callout card to the left if right side is close to viewport edge
        const placeOnLeft = left + width + 260 > bounds.containerWidth;

        return (
          <button
            key={floor.id}
            type="button"
            disabled={!canInteract}
            onMouseEnter={() => canInteract && onHoverFloor(floor.id)}
            onMouseLeave={() => canInteract && onHoverFloor(null)}
            onFocus={() => canInteract && onHoverFloor(floor.id)}
            onBlur={() => canInteract && onHoverFloor(null)}
            onClick={() => canInteract && onSelectFloor(floor)}
            aria-label={`${floor.levelLabel} — ${floor.title}. Click to zoom into level.`}
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
            }}
            className={`group absolute transition-all duration-200 focus:outline-none ${
              canInteract ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
            }`}
          >
            {/* Clean highlight only when hovered or actively tier-filtered (no stacked grid boxes) */}
            <span
              className={`block w-full h-full transition-all duration-200 ${
                active
                  ? 'border border-[#DFC48F] bg-[#C8A96E]/18 shadow-[0_0_24px_rgba(200,169,110,0.35)]'
                  : !matchesTier
                  ? 'border border-transparent bg-transparent opacity-0'
                  : isFiltered && showGuideOutlines
                  ? 'border border-[#C8A96E]/55 bg-[#C8A96E]/[0.08] shadow-[0_0_12px_rgba(200,169,110,0.16)]'
                  : 'border border-transparent bg-transparent'
              }`}
            />

            {/* Minimal architectural edge tick marks in explore mode so facade stays clean */}
            {showGuideOutlines && !active && matchesTier && !isFiltered && (
              <>
                <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-px bg-[#C8A96E]/45 transition-opacity" />
                <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-1.5 h-px bg-[#C8A96E]/45 transition-opacity" />
              </>
            )}

            {/* Corner precision ticks on active floor */}
            {active && (
              <>
                <span className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2 border-[#DFC48F]" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2 border-[#DFC48F]" />
                <span className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2 border-[#DFC48F]" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2 border-[#DFC48F]" />
              </>
            )}

            {/* Compact hover-only callout label that avoids viewport/panel overlap */}
            {isHovered && canInteract && !suppressCallouts && (
              <span
                className={`hidden sm:flex items-center gap-2.5 absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none ${
                  placeOnLeft ? 'right-full mr-3 flex-row-reverse' : 'left-full ml-3'
                }`}
              >
                <span className="w-6 h-px bg-[#C8A96E] shrink-0" />
                <span className="w-max max-w-[230px] px-3 py-2 bg-[#101216]/92 backdrop-blur-md border border-[#C8A96E]/45 text-left shadow-xl">
                  <span className="block font-mono text-[10px] tracking-[0.16em] uppercase text-[#C8A96E] truncate">
                    {floor.levelLabel}
                    {floor.status ? ` · ${floor.status}` : ''}
                  </span>
                  <span className="block font-display text-sm text-[#F4F0EA] leading-tight mt-0.5 truncate">
                    {floor.title}
                  </span>
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
