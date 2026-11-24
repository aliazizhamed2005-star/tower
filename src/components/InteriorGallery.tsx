import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Link2,
  Map,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AppStage,
  ExtractedScene,
  FloorHotspot,
} from '../types/architecture';
import { spatialAudio } from '../utils/spatialAudio';
import { SceneThumbnail } from './SceneThumbnail';
import { ResidenceInformation } from './ResidenceInformation';

interface InteriorGalleryProps {
  stage: AppStage;
  selectedFloor: FloorHotspot | null;
  scenes: ExtractedScene[];
  interiorStageRef: React.RefObject<HTMLDivElement | null>;
  sceneTransitionDuration: number;
  studioMode: boolean;
  initialSceneId?: string | null;
  tourActive: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onStopTour: () => void;
  onTourFloorComplete: () => void;
  onSceneChange: (sceneId: string) => void;
  onBackToTower: () => void;
  onOpenContact: () => void;
  onOpenFloorPlan: () => void;
  onOpenCalibration: () => void;
}

export const InteriorGallery: React.FC<InteriorGalleryProps> = ({
  stage,
  selectedFloor,
  scenes,
  interiorStageRef,
  sceneTransitionDuration,
  studioMode,
  initialSceneId,
  tourActive,
  soundEnabled,
  onToggleSound,
  onStopTour,
  onTourFloorComplete,
  onSceneChange,
  onBackToTower,
  onOpenContact,
  onOpenFloorPlan,
  onOpenCalibration,
}) => {
  const [activeSceneId, setActiveSceneId] = useState<string>(() => {
    if (initialSceneId && scenes.some((s) => s.id === initialSceneId)) {
      return initialSceneId;
    }
    return selectedFloor?.defaultSceneId || '';
  });
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [infoOpen, setInfoOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const mainImageRef = useRef<HTMLImageElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const prevFloorIdRef = useRef<string | null>(null);
  const prevTransitionSceneRef = useRef<{ stage: AppStage; sceneId: string | null }>({
    stage,
    sceneId: null,
  });

  const isVisible = stage === 'zooming' || stage === 'interior' || stage === 'returning';
  const isInteractive = stage === 'interior';

  // Reset lead scene whenever selecting a floor
  useEffect(() => {
    if (selectedFloor && prevFloorIdRef.current !== selectedFloor.id) {
      prevFloorIdRef.current = selectedFloor.id;
      const targetInitial =
        initialSceneId && scenes.some((s) => s.id === initialSceneId)
          ? initialSceneId
          : selectedFloor.defaultSceneId;
      setActiveSceneId(targetInitial);
      setInfoOpen(false);
    }
    if (!selectedFloor) {
      prevFloorIdRef.current = null;
    }
  }, [selectedFloor, initialSceneId, scenes]);

  // Animate interior HUD elements cleanly once the portal zoom completes
  useEffect(() => {
    const hudEl = hudRef.current;
    if (!hudEl) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      if (stage === 'interior') {
        if (prefersReducedMotion) {
          gsap.set('.interior-hud-item, .interior-hud-top', { opacity: 1, y: 0 });
          return;
        }
        gsap.fromTo(
          '.interior-hud-top',
          { opacity: 0, y: -10 },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
        gsap.fromTo(
          '.interior-hud-item',
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: 0.52,
            delay: 0.06,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      } else if (stage === 'zooming') {
        gsap.set('.interior-hud-item, .interior-hud-top', { opacity: 0 });
      } else {
        gsap.to('.interior-hud-item, .interior-hud-top', {
          opacity: 0,
          duration: 0.18,
          ease: 'power2.in',
        });
      }
    }, hudRef);

    return () => ctx.revert();
  }, [stage]);

  // Show only the clean curated rooms belonging to the selected floor's tier
  const floorScenes = useMemo(() => {
    if (!selectedFloor) return scenes;
    const matching = scenes.filter((s) => s.zone === selectedFloor.zone);
    return matching.length > 0 ? matching : scenes;
  }, [scenes, selectedFloor]);

  useEffect(() => {
    if (floorScenes.length === 0) return;
    const exists = floorScenes.some((s) => s.id === activeSceneId);
    if (!exists) {
      setActiveSceneId(floorScenes[0].id);
    }
  }, [floorScenes, activeSceneId]);

  const activeIndex = Math.max(
    0,
    floorScenes.findIndex((s) => s.id === activeSceneId)
  );
  const activeScene = floorScenes[activeIndex] || floorScenes[0];

  // Notify parent when active scene changes (for deep-link URL sync)
  useEffect(() => {
    if (isInteractive && activeScene) {
      onSceneChange(activeScene.id);
    }
  }, [isInteractive, activeScene?.id, onSceneChange]);

  // Smooth GSAP crossfade only when switching scenes while inside interior (zero arrival flicker)
  useEffect(() => {
    const prev = prevTransitionSceneRef.current;
    const currentId = activeScene?.id ?? null;
    prevTransitionSceneRef.current = { stage, sceneId: currentId };

    if (stage !== 'interior' || !currentId) return;
    if (prev.stage !== 'interior' || prev.sceneId === currentId) return;

    const imgEl = mainImageRef.current;
    if (!imgEl) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        imgEl,
        { opacity: 0.25 },
        {
          opacity: 1,
          duration: prefersReducedMotion ? 0.15 : sceneTransitionDuration,
          ease: 'power2.out',
          overwrite: 'auto',
        }
      );
    }, mainImageRef);

    return () => ctx.revert();
  }, [activeScene?.id, stage, sceneTransitionDuration]);

  // Guided Architectural Tour stepping inside the interior
  useEffect(() => {
    if (!tourActive || !isInteractive || floorScenes.length === 0) return;

    const maxPreviewCount = Math.min(3, floorScenes.length);
    const timer = window.setTimeout(() => {
      if (activeIndex + 1 < maxPreviewCount) {
        setActiveSceneId(floorScenes[activeIndex + 1].id);
      } else {
        onTourFloorComplete();
      }
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [tourActive, isInteractive, activeIndex, floorScenes, onTourFloorComplete]);

  // Keyboard shortcuts while inside the interior
  useEffect(() => {
    if (!isInteractive || floorScenes.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (tourActive) onStopTour();
        spatialAudio.playSceneStep(0.3);
        const nextIdx = (activeIndex + 1) % floorScenes.length;
        setActiveSceneId(floorScenes[nextIdx].id);
      } else if (e.key === 'ArrowLeft') {
        if (tourActive) onStopTour();
        spatialAudio.playSceneStep(-0.3);
        const prevIdx = (activeIndex - 1 + floorScenes.length) % floorScenes.length;
        setActiveSceneId(floorScenes[prevIdx].id);
      } else if (e.key === 'Escape') {
        if (tourActive) onStopTour();
        onBackToTower();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInteractive, activeIndex, floorScenes, tourActive, onStopTour, onBackToTower]);

  if (!isVisible || !selectedFloor || !activeScene) {
    return null;
  }

  const handleManualSelectScene = (sceneId: string) => {
    if (tourActive) onStopTour();
    const targetIdx = floorScenes.findIndex((s) => s.id === sceneId);
    const delta = targetIdx >= 0 ? targetIdx - activeIndex : 0;
    spatialAudio.playSceneStep(delta * 0.14);
    setActiveSceneId(sceneId);
  };

  const handlePrev = () => {
    if (tourActive) onStopTour();
    spatialAudio.playSceneStep(-0.3);
    const prevIdx = (activeIndex - 1 + floorScenes.length) % floorScenes.length;
    setActiveSceneId(floorScenes[prevIdx].id);
  };

  const handleNext = () => {
    if (tourActive) onStopTour();
    spatialAudio.playSceneStep(0.3);
    const nextIdx = (activeIndex + 1) % floorScenes.length;
    setActiveSceneId(floorScenes[nextIdx].id);
  };

  const handleCopyDeepLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('level', selectedFloor.id);
      url.searchParams.set('scene', activeScene.id);
      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      // Clipboard API fallback ignored silently
    }
  };

  const viewCounter = `${String(activeIndex + 1).padStart(2, '0')} / ${String(
    Math.max(1, floorScenes.length)
  ).padStart(2, '0')}`;

  return (
    <div
      ref={interiorStageRef}
      className="fixed inset-0 z-30 bg-[#0B0C0E] overflow-hidden will-change-transform"
      style={{ transformOrigin: 'center center' }}
      aria-hidden={!isInteractive}
    >
      <div className="relative w-full h-full flex flex-col justify-between bg-[#0B0C0E]">
        {/* Ambient blurred backdrop when viewing in full-contain mode */}
        {fitMode === 'contain' && (
          <img
            src={activeScene.blobUrl}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-110 pointer-events-none"
          />
        )}

        {/* Primary Extracted Scene Viewport */}
        <div className="interior-portal-media absolute inset-0 flex items-center justify-center overflow-hidden will-change-transform">
          <img
            ref={mainImageRef}
            key={activeScene.id}
            src={activeScene.blobUrl}
            alt={`${selectedFloor.levelLabel} — ${activeScene.title}`}
            referrerPolicy="no-referrer"
            className={`w-full h-full select-none ${
              fitMode === 'contain' ? 'object-contain' : 'object-cover'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B0C0E]/70 via-transparent to-[#0B0C0E]/88 pointer-events-none" />
        </div>

        {/* Clean Organized HUD Overlay */}
        <div
          ref={hudRef}
          className={`relative z-20 w-full h-full flex flex-col justify-between ${
            isInteractive ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {/* TOP BAR: Single Uncluttered Row (Back | Level Context | Actions) */}
          <header className="interior-hud-top px-5 sm:px-8 lg:px-10 pt-4 pb-3 flex items-center justify-between gap-4 bg-gradient-to-b from-[#0B0C0E]/75 to-transparent">
            <button
              type="button"
              onClick={() => {
                if (tourActive) onStopTour();
                onBackToTower();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-medium tracking-[0.16em] uppercase bg-[#101216]/80 backdrop-blur-md border border-[#C8A96E]/55 text-[#F4F0EA] hover:bg-[#C8A96E] hover:text-[#0B0C0E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Tower</span>
            </button>

            <div className="hidden md:flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase text-[#F4F0EA]/85 truncate">
              <span className="text-[#C8A96E]">{selectedFloor.levelLabel}</span>
              <span aria-hidden="true" className="text-white/30">
                /
              </span>
              <span className="truncate">{selectedFloor.title}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {selectedFloor.zone === 'residential' && (
                <button
                  type="button"
                  onClick={() => {
                    if (tourActive) onStopTour();
                    onOpenFloorPlan();
                  }}
                  title="Inspect typical residential floor plan"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] tracking-[0.14em] uppercase backdrop-blur-md border border-[#C8A96E]/55 bg-[#101216]/75 text-[#F4F0EA] hover:bg-[#C8A96E] hover:text-[#0B0C0E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Floor Plan</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleSound}
                aria-label={soundEnabled ? 'Mute spatial audio' : 'Enable spatial audio'}
                aria-pressed={soundEnabled}
                title={soundEnabled ? 'Spatial Audio: On' : 'Spatial Audio: Muted'}
                className={`inline-flex items-center justify-center w-9 h-[34px] backdrop-blur-md border transition-colors shrink-0 cursor-pointer ${
                  soundEnabled
                    ? 'border-[#C8A96E]/45 bg-[#101216]/75 text-[#DFC48F] hover:border-[#C8A96E]'
                    : 'border-white/15 bg-[#101216]/75 text-[#A6A095] hover:text-[#F4F0EA] hover:border-white/30'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={handleCopyDeepLink}
                title="Copy direct link to this level and room"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] tracking-[0.14em] uppercase backdrop-blur-md border border-white/15 bg-[#101216]/75 text-[#F4F0EA] hover:border-[#C8A96E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#DFC48F]" />
                    <span className="hidden sm:inline text-[#DFC48F]">Copied</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5 text-[#C8A96E]" />
                    <span className="hidden sm:inline">Share</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (tourActive) onStopTour();
                  setInfoOpen((prev) => !prev);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] tracking-[0.14em] uppercase backdrop-blur-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  infoOpen
                    ? 'border-[#C8A96E] bg-[#C8A96E]/20 text-[#F4F0EA]'
                    : 'border-white/15 bg-[#101216]/75 text-[#F4F0EA] hover:border-[#C8A96E]'
                }`}
              >
                <Info className="w-3.5 h-3.5 text-[#C8A96E]" />
                <span>Details</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (tourActive) onStopTour();
                  onOpenContact();
                }}
                className="hidden sm:inline-flex items-center px-4 py-2 text-[11px] font-medium tracking-[0.14em] uppercase bg-[#C8A96E] text-[#0B0C0E] hover:bg-[#DFC48F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Book Viewing
              </button>
            </div>
          </header>

          {/* RIGHT DRAWER (Only visible when Details is toggled open) */}
          <div className="px-5 sm:px-8 lg:px-10 flex justify-end pointer-events-none my-auto">
            {infoOpen && (
              <ResidenceInformation
                floor={selectedFloor}
                currentViewIndex={activeIndex}
                totalViews={floorScenes.length}
                isOpen={infoOpen}
                onToggle={() => setInfoOpen(false)}
                onBookViewing={onOpenContact}
                onOpenFloorPlan={() => {
                  if (tourActive) onStopTour();
                  onOpenFloorPlan();
                }}
              />
            )}
          </div>

          {/* BOTTOM BAR: Clean Room Title (Left) + Room Thumbnails & Controls (Right) */}
          <footer className="interior-hud-item px-5 sm:px-8 lg:px-10 pb-5 pt-4 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
            {/* Left: Concise, Non-Redundant Room Title */}
            <div className="shrink-0 max-w-md">
              <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase text-[#C8A96E]">
                <span>{selectedFloor.levelLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">ROOM {viewCounter}</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl text-[#F4F0EA] leading-tight mt-0.5">
                {activeScene.title}
              </h2>
              <p className="text-xs text-[#F4F0EA]/75 mt-1">{activeScene.subtitle}</p>
            </div>

            {/* Right: Simple Controls + Compact Room Strip */}
            <div className="flex flex-col items-start xl:items-end gap-2 max-w-full">
              <div className="flex items-center gap-2 self-end">
                <button
                  type="button"
                  onClick={() => setFitMode((m) => (m === 'cover' ? 'contain' : 'cover'))}
                  title={fitMode === 'cover' ? 'Show full uncropped render' : 'Fill viewport'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.12em] uppercase bg-[#101216]/75 border border-white/12 hover:border-[#C8A96E] text-[#A6A095] hover:text-[#F4F0EA] transition-colors cursor-pointer"
                >
                  {fitMode === 'cover' ? (
                    <Minimize2 className="w-3 h-3 text-[#C8A96E]" />
                  ) : (
                    <Maximize2 className="w-3 h-3 text-[#C8A96E]" />
                  )}
                  <span>{fitMode === 'cover' ? 'Fit' : 'Fill'}</span>
                </button>

                {studioMode && (
                  <button
                    type="button"
                    onClick={onOpenCalibration}
                    title="Edit scene crops & labels"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.12em] uppercase bg-[#101216]/75 border border-white/12 hover:border-[#C8A96E] text-[#A6A095] hover:text-[#F4F0EA] transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-[#C8A96E]" />
                    <span>Crops</span>
                  </button>
                )}

                <div className="flex items-center border border-white/15 bg-[#101216]/80">
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous interior view"
                    className="w-8 h-7 flex items-center justify-center text-[#F4F0EA] hover:text-[#C8A96E] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="w-px h-4 bg-white/10" />
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next interior view"
                    className="w-8 h-7 flex items-center justify-center text-[#F4F0EA] hover:text-[#C8A96E] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2.5 overflow-x-auto arch-scroll pb-1 max-w-full">
                {floorScenes.map((scene, index) => (
                  <SceneThumbnail
                    key={scene.id}
                    scene={scene}
                    index={index}
                    active={scene.id === activeScene.id}
                    onSelect={() => handleManualSelectScene(scene.id)}
                  />
                ))}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
