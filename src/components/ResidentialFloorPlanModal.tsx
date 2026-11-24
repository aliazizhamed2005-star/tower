import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  ArrowUpRight,
  Compass,
  Download,
  Eye,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { FloorHotspot } from '../types/architecture';
import { spatialAudio } from '../utils/spatialAudio';

interface ResidentialFloorPlanModalProps {
  open: boolean;
  floor?: FloorHotspot | null;
  onClose: () => void;
  onBookViewing: (unitLabel?: string) => void;
  onViewInteriorScene?: (sceneId: string) => void;
}

interface FloorPlanUnit {
  id: string;
  code: string;
  label: string;
  wing: string;
  axes: string;
  typology: string;
  exposure: string;
  rooms: string[];
  linkedSceneId: string;
  linkedSceneLabel: string;
  color: string;
  /** Coordinates aligned to 2177 × 1786 CAD floor plan canvas */
  svgRect: { x: number; y: number; width: number; height: number };
  labelAnchor: { x: number; y: number };
}

const PLAN_IMAGE_SRC = '/assets/aistudio/resi_floor_plan.png';
const PLAN_PDF_SRC = '/assets/aistudio/resi_tower_50ea4fea.pdf';

const FLOOR_PLAN_UNITS: FloorPlanUnit[] = [
  {
    id: 'suite-north-crown',
    code: '1+3',
    label: 'North Crown Suite',
    wing: 'East-North Wing',
    axes: 'Axes B–C · Grid 1–2',
    typology: '3-Bedroom Sky Residence + Terrace',
    exposure: 'North & East Panoramic Aspect',
    rooms: [
      'Open Corner Living & Dining',
      'Integrated Kitchen Gallery',
      'Primary Bedroom + Dressing + Bath',
      '2 Guest Bedrooms + Private North Balcony',
    ],
    linkedSceneId: 'res-living',
    linkedSceneLabel: 'Panoramic Living Salon',
    color: '#C8A96E',
    svgRect: { x: 1208, y: 186, width: 262, height: 458 },
    labelAnchor: { x: 1339, y: 415 },
  },
  {
    id: 'suite-west-south',
    code: '1+3',
    label: 'South Terrace Suite',
    wing: 'West-South Wing',
    axes: 'Axes A–B · Grid 3–5',
    typology: '3-Bedroom Corner Suite + Balcony',
    exposure: 'South & West Horizon Aspect',
    rooms: [
      'Living & Dining Lounge',
      'Modular Corner Kitchen',
      'Primary Suite + Walk-in Dressing',
      '2 Secondary Bedrooms + South Terrace',
    ],
    linkedSceneId: 'res-bedroom',
    linkedSceneLabel: 'Primary Sky Bedroom',
    color: '#C8A96E',
    svgRect: { x: 649, y: 768, width: 252, height: 525 },
    labelAnchor: { x: 775, y: 1030 },
  },
  {
    id: 'suite-west-north',
    code: '1+3',
    label: 'West Corner Residence',
    wing: 'West-North Wing',
    axes: 'Axes A–B · Grid 1–3',
    typology: '3-Bedroom Dual-Aspect Residence',
    exposure: 'North & West Skyline Aspect',
    rooms: [
      'Corner Dining & Reception Salon',
      'Galley Kitchen + Utility Pantry',
      'Marble Spa Bath + Dressing Corridor',
      '3 Quiet Wing Bedrooms',
    ],
    linkedSceneId: 'res-bathroom',
    linkedSceneLabel: 'Marble Spa Bath',
    color: '#C8A96E',
    svgRect: { x: 649, y: 438, width: 245, height: 326 },
    labelAnchor: { x: 771, y: 601 },
  },
  {
    id: 'suite-east-wing',
    code: '1+1',
    label: 'East Wing Atelier',
    wing: 'East-South Wing',
    axes: 'Axes B–C · Grid 2–3',
    typology: '1-Bedroom Corner Residence',
    exposure: 'East & South Daylight Aspect',
    rooms: [
      'Open Living & 4-Seat Dining',
      'Sculpted Stone Kitchenette',
      'En-suite Primary Bedroom',
      'Private Gallery Bath',
    ],
    linkedSceneId: 'res-kitchen',
    linkedSceneLabel: 'Kitchen & Private Dining',
    color: '#9FB8AD',
    svgRect: { x: 1208, y: 646, width: 262, height: 277 },
    labelAnchor: { x: 1339, y: 785 },
  },
  {
    id: 'core-corridor',
    code: 'CORE',
    label: 'Lift Lobby & Private Ring',
    wing: 'Central Structural Core',
    axes: 'Axes B · Grid 2–3',
    typology: 'Vertical Circulation & Entry Gallery',
    exposure: 'Internal Acoustic Core',
    rooms: [
      'Dual High-Speed Passenger Elevators',
      'Pressurized Fire Escape Stairwell',
      'Daylit Acoustic Entry Corridor Ring',
    ],
    linkedSceneId: 'res-corridor',
    linkedSceneLabel: 'Private Entrance Gallery',
    color: '#D88D8D',
    svgRect: { x: 874, y: 546, width: 334, height: 318 },
    labelAnchor: { x: 1041, y: 705 },
  },
];

export const ResidentialFloorPlanModal: React.FC<ResidentialFloorPlanModalProps> = ({
  open,
  floor,
  onClose,
  onBookViewing,
  onViewInteriorScene,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(FLOOR_PLAN_UNITS[0].id);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setHoveredUnitId(null);

    if (floor?.id === 'level-26' || floor?.id === 'level-24') {
      setSelectedUnitId('suite-north-crown');
    } else if (floor?.id === 'level-18') {
      setSelectedUnitId('suite-west-south');
    } else if (floor?.id === 'level-15') {
      setSelectedUnitId('suite-east-wing');
    } else {
      setSelectedUnitId(FLOOR_PLAN_UNITS[0].id);
    }

    if (panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: 16, scale: 0.985 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out', clearProps: 'transform' }
      );
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, floor?.id, onClose]);

  if (!open) return null;

  const activeUnit =
    FLOOR_PLAN_UNITS.find((u) => u.id === (hoveredUnitId || selectedUnitId)) ||
    FLOOR_PLAN_UNITS[0];

  const handleSelectUnit = (unit: FloorPlanUnit) => {
    setSelectedUnitId(unit.id);
    const normalizedPan = ((unit.labelAnchor.x / 2177) - 0.5) * 1.6;
    spatialAudio.playBlueprintSelect(normalizedPan);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Number((z + 0.5).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(2))));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="floor-plan-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0B0C0E]/88 backdrop-blur-lg"
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-6xl bg-[#141619] border border-white/15 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#C8A96E] truncate">
              {floor ? `${floor.levelLabel} · ${floor.title}` : 'Sky Residences · Levels 15–26'}
            </div>
            <h2
              id="floor-plan-modal-title"
              className="font-display text-2xl sm:text-3xl text-[#F4F0EA] leading-tight"
            >
              Interactive Residential Floor Plan
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={PLAN_PDF_SRC}
              download="Residential-Floor-Plan.pdf"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] tracking-[0.14em] uppercase border border-white/15 bg-[#0B0C0E]/60 text-[#F4F0EA] hover:border-[#C8A96E] transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#C8A96E]" />
              <span>CAD PDF</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close floor plan"
              className="w-10 h-10 flex items-center justify-center border border-white/15 hover:border-[#C8A96E] text-[#A6A095] hover:text-[#F4F0EA] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Split-Screen Body: Interactive CAD + SVG Overlay (Left) + Unit Inspector (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* Left: Interactive Zoomable Architectural CAD Drawing */}
          <div className="lg:col-span-8 relative bg-[#F6F4EF] flex flex-col min-h-[360px] sm:min-h-[460px] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-white/10">
            {/* Top-Left Cardinal Orientation & Hint */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2.5 bg-[#101216]/90 backdrop-blur-md border border-white/15 px-3 py-1.5 shadow-lg pointer-events-none">
              <div className="flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-[#DFC48F]">
                <Compass className="w-3.5 h-3.5 text-[#C8A96E]" />
                <span>N ↑</span>
              </div>
              <span className="w-px h-3 bg-white/15" />
              <span className="text-[10px] tracking-[0.1em] uppercase text-[#F4F0EA]/85 hidden sm:inline">
                Click any wing or core on plan
              </span>
            </div>

            {/* Compact Top-Right Zoom Bar */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-[#101216]/90 backdrop-blur-md border border-white/15 p-1 shadow-lg">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                aria-label="Zoom out floor plan"
                className="w-7 h-7 flex items-center justify-center text-[#F4F0EA] disabled:opacity-35 hover:text-[#C8A96E] transition-colors cursor-pointer disabled:cursor-default"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono text-[10px] text-[#DFC48F] tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 2.5}
                aria-label="Zoom in floor plan"
                className="w-7 h-7 flex items-center justify-center text-[#F4F0EA] disabled:opacity-35 hover:text-[#C8A96E] transition-colors cursor-pointer disabled:cursor-default"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoom > 1 && (
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  aria-label="Reset zoom"
                  className="w-7 h-7 flex items-center justify-center text-[#A6A095] hover:text-[#F4F0EA] border-l border-white/10 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Scrollable & Zoomable Drawing Viewport with Pixel-Locked SVG Overlay */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center">
              <div
                className="relative inline-block transition-transform duration-200 select-none"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={PLAN_IMAGE_SRC}
                  alt="Typical Residential Tower Floor Plan showing Grid A-C, 1-5, Central Core, Corridor, and 1+3 and 1+1 Residences"
                  className="block max-w-full max-h-[58vh] lg:max-h-[72vh] w-auto h-auto pointer-events-none"
                />

                {/* Interactive SVG Unit Selection Overlay aligned to 2177x1786 natural pixels */}
                <svg
                  viewBox="0 0 2177 1786"
                  className="absolute inset-0 w-full h-full"
                  aria-label="Interactive unit zones on CAD floor plan"
                >
                  {FLOOR_PLAN_UNITS.map((unit) => {
                    const isSelected = selectedUnitId === unit.id;
                    const isHovered = hoveredUnitId === unit.id;
                    const isActive = isSelected || isHovered;

                    return (
                      <g
                        key={unit.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${unit.code} ${unit.label} (${unit.axes})`}
                        onClick={() => handleSelectUnit(unit)}
                        onMouseEnter={() => setHoveredUnitId(unit.id)}
                        onMouseLeave={() => setHoveredUnitId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectUnit(unit);
                          }
                        }}
                        className="cursor-pointer outline-none"
                      >
                        <rect
                          x={unit.svgRect.x}
                          y={unit.svgRect.y}
                          width={unit.svgRect.width}
                          height={unit.svgRect.height}
                          fill={unit.color}
                          fillOpacity={isSelected ? 0.28 : isHovered ? 0.20 : 0.04}
                          stroke={isActive ? '#0B0C0E' : unit.color}
                          strokeWidth={isSelected ? 6 : isHovered ? 4.5 : 2}
                          strokeDasharray={isActive ? undefined : '12 8'}
                          className="transition-all duration-150"
                        />

                        {isActive && (
                          <g transform={`translate(${unit.labelAnchor.x}, ${unit.labelAnchor.y})`}>
                            <rect
                              x={-72}
                              y={-24}
                              width={144}
                              height={48}
                              rx={2}
                              fill="#0B0C0E"
                              fillOpacity={0.92}
                              stroke={unit.color}
                              strokeWidth={2.5}
                            />
                            <text
                              x={0}
                              y={8}
                              textAnchor="middle"
                              fill="#F4F0EA"
                              fontSize="26"
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="600"
                              letterSpacing="2"
                            >
                              {unit.code}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          {/* Right: Structured Architectural Key & Selected Unit Inspector */}
          <div className="lg:col-span-4 p-5 sm:p-6 flex flex-col justify-between gap-5 overflow-y-auto arch-scroll bg-[#141619]">
            <div className="space-y-5">
              {/* Quick Unit Selector Tabs */}
              <section>
                <div className="text-[10px] tracking-[0.18em] uppercase text-[#C8A96E] mb-2.5">
                  Select Zone on Plan
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {FLOOR_PLAN_UNITS.map((unit) => {
                    const selected = selectedUnitId === unit.id;
                    return (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => handleSelectUnit(unit)}
                        onMouseEnter={() => setHoveredUnitId(unit.id)}
                        onMouseLeave={() => setHoveredUnitId(null)}
                        className={`px-2.5 py-2 text-left border transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#C8A96E] bg-[#C8A96E]/15 text-[#F4F0EA]'
                            : 'border-white/10 bg-[#0B0C0E]/45 text-[#A6A095] hover:border-white/25 hover:text-[#F4F0EA]'
                        } ${unit.id === 'core-corridor' ? 'col-span-2' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-[#C8A96E]">{unit.code}</span>
                          <span className="text-[10px] opacity-75 truncate">{unit.wing}</span>
                        </div>
                        <div className="text-xs font-medium text-[#F4F0EA] truncate mt-0.5">
                          {unit.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Active Unit Details Inspector */}
              <section className="border border-white/10 bg-[#0B0C0E]/55 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#C8A96E]">
                      {activeUnit.axes} · {activeUnit.code}
                    </div>
                    <h3 className="font-display text-2xl text-[#F4F0EA] leading-tight mt-0.5">
                      {activeUnit.label}
                    </h3>
                    <div className="text-[11px] text-[#A6A095] mt-0.5">{activeUnit.typology}</div>
                  </div>
                </div>

                <div className="text-[11px] text-[#DFC48F] font-mono">{activeUnit.exposure}</div>

                <ul className="space-y-1.5 pt-0.5">
                  {activeUnit.rooms.map((room) => (
                    <li
                      key={room}
                      className="text-xs text-[#F4F0EA]/90 flex items-center gap-2"
                    >
                      <span className="w-1 h-1 rounded-full bg-[#C8A96E] shrink-0" />
                      <span>{room}</span>
                    </li>
                  ))}
                </ul>

                {onViewInteriorScene && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewInteriorScene(activeUnit.linkedSceneId);
                    }}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 px-3.5 py-2 text-[11px] tracking-[0.14em] uppercase border border-[#C8A96E]/55 bg-[#141619] text-[#F4F0EA] hover:bg-[#C8A96E] hover:text-[#0B0C0E] transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect {activeUnit.linkedSceneLabel}</span>
                  </button>
                )}
              </section>

              {/* Compact CAD Legend */}
              <section className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#A6A095] px-1">
                <div className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border border-black/30 bg-[#D4D2EA]" />
                  <span>Suites (1+3 / 1+1)</span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border border-black/30 bg-[#F5E3B3]" />
                  <span>Corridor</span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border border-black/30 bg-[#F2A6A6]" />
                  <span>Core</span>
                </div>
              </section>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  const unitSummary = `${activeUnit.code} ${activeUnit.label} (${activeUnit.axes})`;
                  onClose();
                  onBookViewing(unitSummary);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-[11px] font-medium tracking-[0.16em] uppercase bg-[#C8A96E] text-[#0B0C0E] hover:bg-[#DFC48F] transition-colors cursor-pointer"
              >
                <span>
                  {floor
                    ? `Enquire · ${floor.levelLabel} (${activeUnit.code})`
                    : `Enquire About ${activeUnit.label}`}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>

              <a
                href={PLAN_PDF_SRC}
                download="Residential-Floor-Plan.pdf"
                className="sm:hidden w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] tracking-[0.14em] uppercase border border-white/15 text-[#F4F0EA] hover:border-[#C8A96E] transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#C8A96E]" />
                <span>Download CAD PDF</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
