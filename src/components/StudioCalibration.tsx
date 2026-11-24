import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Download, RotateCcw, Save, SlidersHorizontal, Sun, X } from 'lucide-react';
import {
  ElevationAtmosphere,
  ExtractedScene,
  FloorHotspot,
  ROOM_CATEGORIES,
  RoomCategory,
  TowerProjectConfig,
  TowerZone,
} from '../types/architecture';
import { extractSceneToBlobUrl } from '../utils/collageExtractor';

interface StudioCalibrationProps {
  open: boolean;
  config: TowerProjectConfig;
  extractedScenes: ExtractedScene[];
  onClose: () => void;
  onSaveConfig: (nextConfig: TowerProjectConfig) => void;
  onResetDefaults: () => void;
  onPreviewAtmosphere?: (next: ElevationAtmosphere | null) => void;
}

const TIME_OF_DAY_PRESETS: {
  id: string;
  label: string;
  note: string;
  atmosphere: ElevationAtmosphere;
}[] = [
  { id: 'dawn', label: 'Dawn', note: 'Soft morning haze', atmosphere: { brightness: 0.9, contrast: 0.94 } },
  { id: 'daylight', label: 'Daylight', note: 'Original architectural tone', atmosphere: { brightness: 1.0, contrast: 1.0 } },
  { id: 'golden', label: 'Golden Hour', note: 'Crisp late-afternoon light', atmosphere: { brightness: 1.08, contrast: 1.12 } },
  { id: 'twilight', label: 'Twilight', note: 'Deepening dusk facade', atmosphere: { brightness: 0.78, contrast: 1.18 } },
  { id: 'nightfall', label: 'Nightfall', note: 'High-contrast nocturnal silhouette', atmosphere: { brightness: 0.56, contrast: 1.28 } },
];

export const StudioCalibration: React.FC<StudioCalibrationProps> = ({
  open,
  config,
  extractedScenes,
  onClose,
  onSaveConfig,
  onResetDefaults,
  onPreviewAtmosphere,
}) => {
  const [tab, setTab] = useState<'crops' | 'floors' | 'atmosphere' | 'project'>('crops');
  const [draft, setDraft] = useState<TowerProjectConfig>(config);
  const [selectedSceneId, setSelectedSceneId] = useState<string>(config.scenes[0]?.id || '');
  const [selectedFloorId, setSelectedFloorId] = useState<string>(config.floors[0]?.id || '');
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(config);
      onPreviewAtmosphere?.(config.atmosphere);
      if (!config.scenes.some((s) => s.id === selectedSceneId)) {
        setSelectedSceneId(config.scenes[0]?.id || '');
      }
      if (!config.floors.some((f) => f.id === selectedFloorId)) {
        setSelectedFloorId(config.floors[0]?.id || '');
      }
      setSavedNotice(null);
      if (drawerRef.current) {
        gsap.fromTo(
          drawerRef.current,
          { opacity: 0, x: 32 },
          { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out', clearProps: 'transform' }
        );
      }
    }
  }, [open, config]);

  const activeScene = draft.scenes.find((s) => s.id === selectedSceneId) || draft.scenes[0];
  const activeCollage = draft.collages.find((c) => c.id === activeScene?.collageId);
  const activeFloor = draft.floors.find((f) => f.id === selectedFloorId) || draft.floors[0];

  // Live re-crop preview when adjusting crop coordinates in calibration
  useEffect(() => {
    if (!open || tab !== 'crops' || !activeScene || !activeCollage) return;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const res = await extractSceneToBlobUrl(activeCollage.src, activeScene.crop);
        if (cancelled) {
          URL.revokeObjectURL(res.blobUrl);
          return;
        }
        setLivePreviewUrl((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return res.blobUrl;
        });
      } catch {
        // Ignore transient invalid preview
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    open,
    tab,
    activeScene?.id,
    activeScene?.crop.x,
    activeScene?.crop.y,
    activeScene?.crop.width,
    activeScene?.crop.height,
    activeCollage?.src,
  ]);

  if (!open) return null;

  const updateScene = (
    sceneId: string,
    updater: (prev: typeof draft.scenes[0]) => typeof draft.scenes[0]
  ) => {
    setDraft((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === sceneId ? updater(s) : s)),
    }));
  };

  const updateFloor = (floorId: string, updater: (prev: FloorHotspot) => FloorHotspot) => {
    setDraft((prev) => ({
      ...prev,
      floors: prev.floors.map((f) => (f.id === floorId ? updater(f) : f)),
    }));
  };

  const updateAtmosphere = (next: ElevationAtmosphere) => {
    setDraft((prev) => ({
      ...prev,
      atmosphere: next,
    }));
    onPreviewAtmosphere?.(next);
  };

  const handleCloseDrawer = () => {
    onPreviewAtmosphere?.(null);
    onClose();
  };

  const handleApplySave = () => {
    onSaveConfig(draft);
    onPreviewAtmosphere?.(null);
    setSavedNotice('Calibration & lighting saved.');
    window.setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tower-calibration-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const fallbackExtracted = extractedScenes.find((s) => s.id === activeScene?.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Studio Calibration Editor"
      className="fixed inset-0 z-50 flex items-center justify-end bg-[#0B0C0E]/75 backdrop-blur-md"
    >
      <div
        ref={drawerRef}
        className="w-full max-w-3xl h-full bg-[#141619] border-l border-white/15 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-[#C8A96E]" />
            <div>
              <h2 className="font-display text-xl text-[#F4F0EA]">Studio Calibration</h2>
              <p className="text-[11px] text-[#A6A095]">
                Fine-tune interior crops, floor hotspots, time-of-day tone, and tower metadata
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label="Close calibration drawer"
            className="w-9 h-9 flex items-center justify-center border border-white/15 hover:border-[#C8A96E] text-[#A6A095] hover:text-[#F4F0EA] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2.5 border-b border-white/10 flex flex-wrap items-center gap-2 shrink-0 bg-[#0B0C0E]/50">
          {(
            [
              { id: 'crops', label: `Interior Crops (${draft.scenes.length})` },
              { id: 'floors', label: `Floor Hotspots (${draft.floors.length})` },
              { id: 'atmosphere', label: 'Time of Day' },
              { id: 'project', label: 'Project & Contact' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-1.5 text-[11px] tracking-[0.12em] uppercase border transition-colors cursor-pointer ${
                tab === item.id
                  ? 'border-[#C8A96E] bg-[#C8A96E]/15 text-[#F4F0EA]'
                  : 'border-white/10 text-[#A6A095] hover:text-[#F4F0EA]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto arch-scroll p-6 space-y-6">
          {tab === 'crops' && activeScene && activeCollage && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5">
                    Select Extracted Scene
                  </label>
                  <select
                    value={activeScene.id}
                    onChange={(e) => setSelectedSceneId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                  >
                    {draft.scenes.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{String(s.order).padStart(2, '0')} — {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5">
                    Room Category
                  </label>
                  <select
                    value={activeScene.category}
                    onChange={(e) =>
                      updateScene(activeScene.id, (s) => ({
                        ...s,
                        category: e.target.value as RoomCategory,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                  >
                    {ROOM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5">
                    Scene Name
                  </label>
                  <input
                    type="text"
                    value={activeScene.title}
                    onChange={(e) =>
                      updateScene(activeScene.id, (s) => ({ ...s, title: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5">
                    Subtitle / Architectural Note
                  </label>
                  <input
                    type="text"
                    value={activeScene.subtitle}
                    onChange={(e) =>
                      updateScene(activeScene.id, (s) => ({ ...s, subtitle: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    { key: 'x', label: 'Crop X (0–1)' },
                    { key: 'y', label: 'Crop Y (0–1)' },
                    { key: 'width', label: 'Width (0–1)' },
                    { key: 'height', label: 'Height (0–1)' },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-[10px] tracking-[0.12em] uppercase text-[#A6A095] mb-1">
                      {label}
                    </label>
                    <input
                      type="number"
                      step="0.002"
                      min="0"
                      max="1"
                      value={activeScene.crop[key]}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
                        updateScene(activeScene.id, (s) => ({
                          ...s,
                          crop: { ...s.crop, [key]: val },
                        }));
                      }}
                      className="w-full px-2.5 py-2 font-mono text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                    />
                  </div>
                ))}
              </div>

              {/* Dual Visual Verification: Source Collage Overlay + Live Extracted Crop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-[10px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5">
                    Source Collage Region ({activeCollage.label})
                  </div>
                  <div className="relative aspect-[1402/1122] bg-[#0B0C0E] border border-white/15 overflow-hidden">
                    <img
                      src={activeCollage.src}
                      alt={activeCollage.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-fill opacity-75"
                    />
                    <div
                      style={{
                        left: `${activeScene.crop.x * 100}%`,
                        top: `${activeScene.crop.y * 100}%`,
                        width: `${activeScene.crop.width * 100}%`,
                        height: `${activeScene.crop.height * 100}%`,
                      }}
                      className="absolute border-2 border-[#DFC48F] bg-[#C8A96E]/20 shadow-[0_0_0_9999px_rgba(11,12,14,0.55)]"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-[10px] tracking-[0.14em] uppercase text-[#C8A96E] mb-1.5">
                    Extracted Output Preview
                  </div>
                  <div className="aspect-[1402/1122] bg-[#0B0C0E] border border-[#C8A96E]/40 flex items-center justify-center overflow-hidden">
                    {(livePreviewUrl || fallbackExtracted?.blobUrl) && (
                      <img
                        src={livePreviewUrl || fallbackExtracted?.blobUrl}
                        alt={activeScene.title}
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'floors' && activeFloor && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5">
                    Select Floor Hotspot
                  </label>
                  <select
                    value={activeFloor.id}
                    onChange={(e) => setSelectedFloorId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                  >
                    {draft.floors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.levelLabel} — {f.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5">
                    Interior Tier Mapping
                  </label>
                  <select
                    value={activeFloor.zone}
                    onChange={(e) =>
                      updateFloor(activeFloor.id, (f) => ({
                        ...f,
                        zone: e.target.value as TowerZone,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                  >
                    <option value="residential">Sky Residences</option>
                    <option value="office">Tower Office 04</option>
                    <option value="podium">Podium &amp; Amenities</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5">
                    Level Label
                  </label>
                  <input
                    type="text"
                    value={activeFloor.levelLabel}
                    onChange={(e) =>
                      updateFloor(activeFloor.id, (f) => ({ ...f, levelLabel: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5">
                    Display Title
                  </label>
                  <input
                    type="text"
                    value={activeFloor.title}
                    onChange={(e) =>
                      updateFloor(activeFloor.id, (f) => ({ ...f, title: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-[#A6A095] mb-1.5">
                    Status Label
                  </label>
                  <input
                    type="text"
                    value={activeFloor.status || ''}
                    placeholder="e.g. Available"
                    onChange={(e) =>
                      updateFloor(activeFloor.id, (f) => ({
                        ...f,
                        status: e.target.value || undefined,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                  />
                </div>
              </div>

              <div>
                <div className="text-[10px] tracking-[0.14em] uppercase text-[#C8A96E] mb-2">
                  Normalized Tower Hotspot &amp; Zoom Target (0–1)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      { key: 'x', label: 'Box X' },
                      { key: 'y', label: 'Box Y' },
                      { key: 'width', label: 'Box W' },
                      { key: 'height', label: 'Box H' },
                      { key: 'zoomTargetX', label: 'Zoom X' },
                      { key: 'zoomTargetY', label: 'Zoom Y' },
                      { key: 'zoomScale', label: 'Zoom Scale' },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-[10px] text-[#A6A095] mb-1">{label}</label>
                      <input
                        type="number"
                        step={key === 'zoomScale' ? '0.1' : '0.005'}
                        value={activeFloor[key]}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          updateFloor(activeFloor.id, (f) => ({ ...f, [key]: val }));
                        }}
                        className="w-full px-2.5 py-2 font-mono text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Residence Information Fields */}
              <div>
                <div className="text-[10px] tracking-[0.14em] uppercase text-[#C8A96E] mb-2">
                  Level Specifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      { key: 'floorNumber', label: 'Floor Number' },
                      { key: 'residenceType', label: 'Residence Type' },
                      { key: 'bedrooms', label: 'Bedrooms' },
                      { key: 'bathrooms', label: 'Bathrooms' },
                      { key: 'area', label: 'Area' },
                      { key: 'view', label: 'View' },
                      { key: 'price', label: 'Schedule / Status' },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-[10px] text-[#A6A095] mb-1">{label}</label>
                      <input
                        type="text"
                        value={activeFloor.residenceInfo[key]}
                        onChange={(e) =>
                          updateFloor(activeFloor.id, (f) => ({
                            ...f,
                            residenceInfo: { ...f.residenceInfo, [key]: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'project' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="text-[10px] tracking-[0.14em] uppercase text-[#C8A96E]">
                  Brand &amp; Tower Specifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#A6A095] mb-1">Project Name</label>
                    <input
                      type="text"
                      value={draft.projectName}
                      onChange={(e) => setDraft({ ...draft, projectName: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#A6A095] mb-1">Total Levels</label>
                    <input
                      type="text"
                      value={draft.specs.totalLevels}
                      onChange={(e) =>
                        setDraft({ ...draft, specs: { ...draft.specs, totalLevels: e.target.value } })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#A6A095] mb-1">Structural System</label>
                    <input
                      type="text"
                      value={draft.specs.structure}
                      onChange={(e) =>
                        setDraft({ ...draft, specs: { ...draft.specs, structure: e.target.value } })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#A6A095] mb-1">Ceiling / Glazing</label>
                    <input
                      type="text"
                      value={draft.specs.ceilingHeight}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          specs: { ...draft.specs, ceilingHeight: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] tracking-[0.14em] uppercase text-[#C8A96E]">
                  Site District &amp; Orientation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#A6A095] mb-1">District</label>
                    <input
                      type="text"
                      value={draft.location.district}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          location: { ...draft.location, district: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#A6A095] mb-1">Solar Axis</label>
                    <input
                      type="text"
                      value={draft.location.orientation}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          location: { ...draft.location, orientation: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] tracking-[0.14em] uppercase text-[#C8A96E]">
                  Sales Gallery Contact Details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      { key: 'salesGalleryAddress', label: 'Sales Gallery Address' },
                      { key: 'phone', label: 'Telephone' },
                      { key: 'email', label: 'Email' },
                      { key: 'hours', label: 'Appointment Hours' },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-[10px] text-[#A6A095] mb-1">{label}</label>
                      <input
                        type="text"
                        value={draft.contact[key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            contact: { ...draft.contact, [key]: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-xs bg-[#0B0C0E] border border-white/15 text-[#F4F0EA] outline-none focus:border-[#C8A96E]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab === 'atmosphere' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase text-[#C8A96E]">
                    <Sun className="w-3.5 h-3.5" />
                    <span>Time-of-Day Lighting Presets</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateAtmosphere({ brightness: 1, contrast: 1 })}
                    className="text-[10px] tracking-[0.12em] uppercase text-[#A6A095] hover:text-[#DFC48F] transition-colors cursor-pointer"
                  >
                    Reset 100% / 100%
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {TIME_OF_DAY_PRESETS.map((preset) => {
                    const isSelected =
                      Math.abs(draft.atmosphere.brightness - preset.atmosphere.brightness) < 0.015 &&
                      Math.abs(draft.atmosphere.contrast - preset.atmosphere.contrast) < 0.015;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => updateAtmosphere(preset.atmosphere)}
                        className={`px-3 py-2.5 text-left border transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-[#C8A96E] bg-[#C8A96E]/18 text-[#F4F0EA]'
                            : 'border-white/10 bg-[#0B0C0E]/55 text-[#A6A095] hover:border-white/25 hover:text-[#F4F0EA]'
                        }`}
                      >
                        <div className="text-xs font-medium text-[#F4F0EA]">{preset.label}</div>
                        <div className="text-[10px] opacity-75 mt-0.5 truncate">{preset.note}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border border-white/10 bg-[#0B0C0E]/45 p-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="elevation-brightness"
                      className="text-[10px] tracking-[0.14em] uppercase text-[#A6A095]"
                    >
                      Elevation Brightness
                    </label>
                    <span className="font-mono text-xs text-[#DFC48F] tabular-nums">
                      {Math.round(draft.atmosphere.brightness * 100)}%
                    </span>
                  </div>
                  <input
                    id="elevation-brightness"
                    type="range"
                    min="0.4"
                    max="1.5"
                    step="0.02"
                    value={draft.atmosphere.brightness}
                    onChange={(e) =>
                      updateAtmosphere({
                        ...draft.atmosphere,
                        brightness: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-[#C8A96E] cursor-pointer"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-[#A6A095]/70 mt-1">
                    <span>40% Night</span>
                    <span>100%</span>
                    <span>150% Bright</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="elevation-contrast"
                      className="text-[10px] tracking-[0.14em] uppercase text-[#A6A095]"
                    >
                      Elevation Contrast
                    </label>
                    <span className="font-mono text-xs text-[#DFC48F] tabular-nums">
                      {Math.round(draft.atmosphere.contrast * 100)}%
                    </span>
                  </div>
                  <input
                    id="elevation-contrast"
                    type="range"
                    min="0.5"
                    max="1.6"
                    step="0.02"
                    value={draft.atmosphere.contrast}
                    onChange={(e) =>
                      updateAtmosphere({
                        ...draft.atmosphere,
                        contrast: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-[#C8A96E] cursor-pointer"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-[#A6A095]/70 mt-1">
                    <span>50% Soft</span>
                    <span>100%</span>
                    <span>160% Crisp</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] tracking-[0.14em] uppercase text-[#C8A96E]">
                    Live Elevation Filter Preview
                  </div>
                  <div className="font-mono text-[10px] text-[#A6A095]">
                    filter: brightness({draft.atmosphere.brightness.toFixed(2)}) contrast(
                    {draft.atmosphere.contrast.toFixed(2)})
                  </div>
                </div>
                <div className="relative aspect-[16/9] bg-[#0B0C0E] border border-white/15 overflow-hidden">
                  <img
                    src={draft.elevationImage.src}
                    alt="Tower Elevation Lighting Preview"
                    style={{
                      filter: `brightness(${draft.atmosphere.brightness}) contrast(${draft.atmosphere.contrast})`,
                    }}
                    className="w-full h-full object-cover transition-[filter] duration-200"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0B0C0E]/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onPreviewAtmosphere?.(null);
                onResetDefaults();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] tracking-[0.12em] uppercase border border-white/15 text-[#A6A095] hover:text-[#F4F0EA] hover:border-white/30 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] tracking-[0.12em] uppercase border border-white/15 text-[#A6A095] hover:text-[#F4F0EA] hover:border-white/30 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {savedNotice && <span className="text-xs text-[#DFC48F]">{savedNotice}</span>}
            <button
              type="button"
              onClick={handleApplySave}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-medium tracking-[0.14em] uppercase bg-[#C8A96E] text-[#0B0C0E] hover:bg-[#DFC48F] transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Apply &amp; Re-Extract</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
