import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause } from 'lucide-react';
import { DEFAULT_TOWER_CONFIG } from './config/towerConfig';
import {
  AppStage,
  CropRect,
  ElevationAtmosphere,
  ExtractedScene,
  FloorHotspot,
  ImageBounds,
  TierFilter,
  TowerProjectConfig,
} from './types/architecture';
import { extractAllCollageScenes } from './utils/collageExtractor';
import { computeElevationImageBounds } from './utils/elevationGeometry';
import { spatialAudio } from './utils/spatialAudio';
import { MainNavigation } from './components/MainNavigation';
import { TowerElevation } from './components/TowerElevation';
import { FloorSelection } from './components/FloorSelection';
import { CinematicZoom } from './components/CinematicZoom';
import { InteriorGallery } from './components/InteriorGallery';
import { ContactInterface } from './components/ContactInterface';
import { ResidencesModal } from './components/ResidencesModal';
import { ArchitectureModal } from './components/ArchitectureModal';
import { StudioCalibration } from './components/StudioCalibration';
import { GlobalStageTransition } from './components/GlobalStageTransition';
import { ResidentialFloorPlanModal } from './components/ResidentialFloorPlanModal';
import { warmImageAsset } from './components/ThreeZoomPortal';

const STORAGE_KEY = 'tower_architectural_config_v3';
const TOUR_SEQUENCE = ['level-26', 'level-12', 'level-04', 'level-01'];

function hasPlaceholderCopy(value: string | undefined): boolean {
  if (!value) return false;
  return /placeholder|TBA/i.test(value);
}

function loadInitialConfig(): TowerProjectConfig {
  if (typeof window === 'undefined') return DEFAULT_TOWER_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TOWER_CONFIG;
    const parsed = JSON.parse(raw) as Partial<TowerProjectConfig>;
    if (!parsed.scenes || !parsed.floors || !parsed.collages) {
      return DEFAULT_TOWER_CONFIG;
    }

    const defaultFloorMap = new Map(
      DEFAULT_TOWER_CONFIG.floors.map((floor) => [floor.id, floor])
    );

    const defaultSceneMap = new Map(
      DEFAULT_TOWER_CONFIG.scenes.map((scene) => [scene.id, scene])
    );

    const mergedScenes = parsed.scenes.map((scene) => {
      const fallback = defaultSceneMap.get(scene.id);
      if (!fallback) return scene;
      return {
        ...fallback,
        ...scene,
        preExtractedSrc: scene.preExtractedSrc ?? fallback.preExtractedSrc,
        pixelWidth: scene.pixelWidth ?? fallback.pixelWidth,
        pixelHeight: scene.pixelHeight ?? fallback.pixelHeight,
      };
    });

    const mergedFloors = parsed.floors.map((floor) => {
      const fallback = defaultFloorMap.get(floor.id);
      if (!fallback) return floor;
      const savedInfo = floor.residenceInfo;
      return {
        ...fallback,
        ...floor,
        status: floor.status ?? fallback.status,
        residenceInfo: savedInfo
          ? {
              floorNumber: hasPlaceholderCopy(savedInfo.floorNumber)
                ? fallback.residenceInfo.floorNumber
                : savedInfo.floorNumber,
              residenceType: hasPlaceholderCopy(savedInfo.residenceType)
                ? fallback.residenceInfo.residenceType
                : savedInfo.residenceType,
              bedrooms: hasPlaceholderCopy(savedInfo.bedrooms)
                ? fallback.residenceInfo.bedrooms
                : savedInfo.bedrooms,
              bathrooms: hasPlaceholderCopy(savedInfo.bathrooms)
                ? fallback.residenceInfo.bathrooms
                : savedInfo.bathrooms,
              area: hasPlaceholderCopy(savedInfo.area)
                ? fallback.residenceInfo.area
                : savedInfo.area,
              view: hasPlaceholderCopy(savedInfo.view)
                ? fallback.residenceInfo.view
                : savedInfo.view,
              price: hasPlaceholderCopy(savedInfo.price)
                ? fallback.residenceInfo.price
                : savedInfo.price,
            }
          : fallback.residenceInfo,
      };
    });

    return {
      ...DEFAULT_TOWER_CONFIG,
      ...parsed,
      heroVideoSrc: DEFAULT_TOWER_CONFIG.heroVideoSrc,
      elevationImage: DEFAULT_TOWER_CONFIG.elevationImage,
      atmosphere: {
        brightness:
          typeof parsed.atmosphere?.brightness === 'number'
            ? Math.max(0.4, Math.min(1.5, parsed.atmosphere.brightness))
            : DEFAULT_TOWER_CONFIG.atmosphere.brightness,
        contrast:
          typeof parsed.atmosphere?.contrast === 'number'
            ? Math.max(0.5, Math.min(1.6, parsed.atmosphere.contrast))
            : DEFAULT_TOWER_CONFIG.atmosphere.contrast,
      },
      specs: {
        ...DEFAULT_TOWER_CONFIG.specs,
        ...parsed.specs,
      },
      location: {
        ...DEFAULT_TOWER_CONFIG.location,
        ...parsed.location,
      },
      contact: {
        salesGalleryAddress: hasPlaceholderCopy(parsed.contact?.salesGalleryAddress)
          ? DEFAULT_TOWER_CONFIG.contact.salesGalleryAddress
          : parsed.contact?.salesGalleryAddress || DEFAULT_TOWER_CONFIG.contact.salesGalleryAddress,
        phone: parsed.contact?.phone || DEFAULT_TOWER_CONFIG.contact.phone,
        email: hasPlaceholderCopy(parsed.contact?.email)
          ? DEFAULT_TOWER_CONFIG.contact.email
          : parsed.contact?.email || DEFAULT_TOWER_CONFIG.contact.email,
        hours: parsed.contact?.hours || DEFAULT_TOWER_CONFIG.contact.hours,
      },
      scenes: mergedScenes,
      floors: mergedFloors,
    };
  } catch {
    return DEFAULT_TOWER_CONFIG;
  }
}

function getInitialStudioMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('studio') === '1';
}

function getInitialDeepLink(): { level: string | null; scene: string | null } {
  if (typeof window === 'undefined') return { level: null, scene: null };
  const params = new URLSearchParams(window.location.search);
  return {
    level: params.get('level'),
    scene: params.get('scene'),
  };
}

export default function App() {
  const [config, setConfig] = useState<TowerProjectConfig>(loadInitialConfig);
  const [stage, setStage] = useState<AppStage>('explore');
  const [hoveredFloorId, setHoveredFloorId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<FloorHotspot | null>(null);

  const [studioMode, setStudioMode] = useState<boolean>(getInitialStudioMode);
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [levelsMenuOpen, setLevelsMenuOpen] = useState<boolean>(false);
  const [deepLinkSceneId, setDeepLinkSceneId] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

  const [tourActive, setTourActive] = useState<boolean>(false);
  const [tourStepIndex, setTourStepIndex] = useState<number>(0);

  const [extractedScenes, setExtractedScenes] = useState<ExtractedScene[]>([]);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const [contactOpen, setContactOpen] = useState(false);
  const [preselectedUnitLabel, setPreselectedUnitLabel] = useState<string | undefined>(undefined);
  const [residencesOpen, setResidencesOpen] = useState(false);
  const [architectureOpen, setArchitectureOpen] = useState(false);
  const [floorPlanOpen, setFloorPlanOpen] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [previewAtmosphere, setPreviewAtmosphere] = useState<ElevationAtmosphere | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => spatialAudio.isEnabled());

  const prevStageRef = useRef<AppStage>('explore');
  const prevHoveredAudioRef = useRef<string | null>(null);

  const initialDeepLinkRef = useRef<{ level: string | null; scene: string | null }>(
    getInitialDeepLink()
  );
  const deepLinkResolvedRef = useRef<boolean>(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const interiorStageRef = useRef<HTMLDivElement | null>(null);
  const boundsRef = useRef<ImageBounds>(
    computeElevationImageBounds(
      typeof window !== 'undefined' ? window.innerWidth : 1440,
      typeof window !== 'undefined' ? window.innerHeight : 900,
      config.elevationImage.naturalWidth,
      config.elevationImage.naturalHeight
    )
  );

  const collageMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of config.collages) {
      map[c.id] = c.src;
    }
    return map;
  }, [config.collages]);

  const defaultCropsById = useMemo(() => {
    const map: Record<string, CropRect> = {};
    for (const s of DEFAULT_TOWER_CONFIG.scenes) {
      map[s.id] = s.crop;
    }
    return map;
  }, []);

  // Unlock Studio Calibration via Shift+C keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.shiftKey || (e.key !== 'C' && e.key !== 'c')) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setTourActive(false);
      setStudioMode(true);
      setCalibrationOpen((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Unlock Web Audio context on first user gesture and sync sound toggle state
  useEffect(() => {
    const unsubscribe = spatialAudio.subscribe(setSoundEnabled);
    const unlockOnce = () => spatialAudio.unlock();

    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    window.addEventListener('keydown', unlockOnce, { passive: true });

    return () => {
      unsubscribe();
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
  }, []);

  // Subtle spatial harmonic when hovering over tower levels in Explore mode
  useEffect(() => {
    if (stage !== 'explore') {
      prevHoveredAudioRef.current = null;
      return;
    }

    if (hoveredFloorId && hoveredFloorId !== prevHoveredAudioRef.current) {
      const floor = config.floors.find((f) => f.id === hoveredFloorId);
      if (floor) {
        spatialAudio.playFloorHover(floor);
        const sceneMatch = extractedScenes.find((s) => s.id === floor.defaultSceneId);
        if (sceneMatch?.blobUrl) {
          warmImageAsset(sceneMatch.blobUrl);
        }
      }
    }
    prevHoveredAudioRef.current = hoveredFloorId;
  }, [hoveredFloorId, stage, config.floors, extractedScenes]);

  // Spatial audio atmospheric transitions across Explore -> Zoom -> Interior -> Return
  useEffect(() => {
    const prevStage = prevStageRef.current;
    if (prevStage === stage) return;
    prevStageRef.current = stage;

    if (stage === 'zooming' && selectedFloor) {
      spatialAudio.playZoomEnter(selectedFloor);
    } else if (stage === 'interior' && prevStage === 'zooming' && selectedFloor) {
      spatialAudio.playInteriorReveal(selectedFloor.zone);
    } else if (stage === 'returning') {
      spatialAudio.playReturnToTower();
    }
  }, [stage, selectedFloor]);

  // Resolve pre-extracted WebP scenes immediately, or re-slice via canvas when crops were customized
  useEffect(() => {
    let active = true;
    const prevBlobUrls: string[] = [];

    const runExtraction = async () => {
      try {
        setExtractionError(null);
        const scenes = await extractAllCollageScenes(
          config.scenes,
          collageMap,
          defaultCropsById
        );
        if (!active) {
          scenes.forEach((s) => {
            if (s.blobUrl.startsWith('blob:')) URL.revokeObjectURL(s.blobUrl);
          });
          return;
        }
        setExtractedScenes((current) => {
          current.forEach((s) => {
            if (s.blobUrl.startsWith('blob:')) prevBlobUrls.push(s.blobUrl);
          });
          return scenes;
        });
        prevBlobUrls.forEach((url) => URL.revokeObjectURL(url));
      } catch (err) {
        if (active) {
          setExtractionError(
            err instanceof Error
              ? err.message
              : 'Unable to prepare architectural interior scenes.'
          );
        }
      }
    };

    runExtraction();

    return () => {
      active = false;
    };
  }, [config.scenes, collageMap, defaultCropsById]);

  // Resolve ?level=...&scene=... deep-link once scenes are prepared
  useEffect(() => {
    if (deepLinkResolvedRef.current || extractedScenes.length === 0) return;
    deepLinkResolvedRef.current = true;

    const { level, scene } = initialDeepLinkRef.current;
    if (!level) return;

    const matchedFloor = config.floors.find((f) => f.id === level);
    if (!matchedFloor) return;

    const matchedScene =
      scene && extractedScenes.some((s) => s.id === scene) ? scene : matchedFloor.defaultSceneId;

    setSelectedFloor(matchedFloor);
    setHoveredFloorId(matchedFloor.id);
    setDeepLinkSceneId(matchedScene);
    setActiveSceneId(matchedScene);
    setStage('interior');
  }, [extractedScenes, config.floors]);

  // Keep URL query parameters synchronized with the active floor and interior room
  useEffect(() => {
    if (typeof window === 'undefined' || !deepLinkResolvedRef.current) return;

    const url = new URL(window.location.href);
    let changed = false;

    if (stage === 'interior' && selectedFloor) {
      if (url.searchParams.get('level') !== selectedFloor.id) {
        url.searchParams.set('level', selectedFloor.id);
        changed = true;
      }
      if (activeSceneId && url.searchParams.get('scene') !== activeSceneId) {
        url.searchParams.set('scene', activeSceneId);
        changed = true;
      }
    } else if (stage === 'explore') {
      if (url.searchParams.has('level')) {
        url.searchParams.delete('level');
        changed = true;
      }
      if (url.searchParams.has('scene')) {
        url.searchParams.delete('scene');
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [stage, selectedFloor, activeSceneId]);

  const extractedScenesRef = useRef<ExtractedScene[]>([]);

  useEffect(() => {
    extractedScenesRef.current = extractedScenes;
  }, [extractedScenes]);

  // Cleanup Blob URLs on final unmount
  useEffect(() => {
    return () => {
      extractedScenesRef.current.forEach((s) => {
        if (s.blobUrl.startsWith('blob:')) {
          URL.revokeObjectURL(s.blobUrl);
        }
      });
    };
  }, []);

  // Guided Architectural Auto-Tour controller when on tower elevation
  useEffect(() => {
    if (!tourActive || stage !== 'explore' || config.floors.length === 0) return;

    const targetFloorId = TOUR_SEQUENCE[tourStepIndex % TOUR_SEQUENCE.length];
    const targetFloor =
      config.floors.find((f) => f.id === targetFloorId) || config.floors[0];

    const highlightTimer = window.setTimeout(() => {
      setHoveredFloorId(targetFloor.id);
    }, 450);

    const zoomTimer = window.setTimeout(() => {
      setDeepLinkSceneId(null);
      setActiveSceneId(targetFloor.defaultSceneId);
      setSelectedFloor(targetFloor);
      setStage('zooming');
    }, 1250);

    return () => {
      window.clearTimeout(highlightTimer);
      window.clearTimeout(zoomTimer);
    };
  }, [tourActive, stage, tourStepIndex, config.floors]);

  const stopTour = useCallback(() => {
    setTourActive(false);
  }, []);

  const handleStartTour = useCallback(() => {
    if (stage === 'zooming' || stage === 'returning') return;
    setContactOpen(false);
    setResidencesOpen(false);
    setArchitectureOpen(false);
    setFloorPlanOpen(false);
    setCalibrationOpen(false);
    setTierFilter('all');
    setTourStepIndex(0);
    setTourActive(true);
    if (stage !== 'explore') {
      setStage('explore');
    }
  }, [stage]);

  const handleTourFloorComplete = useCallback(() => {
    if (stage !== 'interior') return;
    setTourStepIndex((prev) => (prev + 1) % TOUR_SEQUENCE.length);
    setStage('returning');
  }, [stage]);

  const handleSelectFloor = useCallback(
    (floor: FloorHotspot, customSceneId?: string) => {
      if (stage === 'zooming' || stage === 'returning') return;
      const targetScene = customSceneId || floor.defaultSceneId;
      setTourActive(false);
      setDeepLinkSceneId(customSceneId || null);
      setActiveSceneId(targetScene);
      setHoveredFloorId(floor.id);
      setSelectedFloor(floor);
      setStage('zooming');
    },
    [stage]
  );

  const handleZoomComplete = useCallback(() => {
    setStage('interior');
  }, []);

  const handleBackToTower = useCallback(() => {
    if (stage !== 'interior') return;
    setTourActive(false);
    setDeepLinkSceneId(null);
    setStage('returning');
  }, [stage]);

  const handleReturnComplete = useCallback(() => {
    setHoveredFloorId(null);
    setSelectedFloor(null);
    setStage('explore');
  }, []);

  const handleSaveConfig = useCallback((nextConfig: TowerProjectConfig) => {
    setConfig(nextConfig);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
    } catch {
      // Ignore storage quota issues
    }
  }, []);

  const handleResetDefaults = useCallback(() => {
    setConfig(DEFAULT_TOWER_CONFIG);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleResetToTower = useCallback(() => {
    setTourActive(false);
    setContactOpen(false);
    setResidencesOpen(false);
    setArchitectureOpen(false);
    setFloorPlanOpen(false);
    setCalibrationOpen(false);
    setTierFilter('all');
    setHoveredFloorId(null);
    if (stage === 'interior') {
      setDeepLinkSceneId(null);
      setStage('returning');
    }
  }, [stage]);

  const handleChangeTierFilter = useCallback((nextFilter: TierFilter) => {
    setTourActive(false);
    setTierFilter(nextFilter);
    setHoveredFloorId(null);
  }, []);

  const handleOpenContact = useCallback((unitLabel?: string) => {
    setTourActive(false);
    setPreselectedUnitLabel(typeof unitLabel === 'string' ? unitLabel : undefined);
    setContactOpen(true);
  }, []);

  const handleOpenResidences = useCallback(() => {
    setTourActive(false);
    setResidencesOpen(true);
  }, []);

  const handleOpenArchitecture = useCallback(() => {
    setTourActive(false);
    setArchitectureOpen(true);
  }, []);

  const handleOpenCalibration = useCallback(() => {
    setTourActive(false);
    setStudioMode(true);
    setCalibrationOpen(true);
  }, []);

  const handleOpenFloorPlan = useCallback(() => {
    setTourActive(false);
    setFloorPlanOpen(true);
  }, []);

  const handleViewInteriorFromFloorPlan = useCallback(
    (sceneId: string) => {
      setTourActive(false);
      if (stage === 'interior' && selectedFloor?.zone === 'residential') {
        setDeepLinkSceneId(sceneId);
        setActiveSceneId(sceneId);
        return;
      }

      const fallbackResidential =
        (selectedFloor?.zone === 'residential' ? selectedFloor : null) ||
        config.floors.find((f) => f.id === 'level-26') ||
        config.floors.find((f) => f.zone === 'residential');

      if (fallbackResidential) {
        handleSelectFloor(fallbackResidential, sceneId);
      }
    },
    [stage, selectedFloor, config.floors, handleSelectFloor]
  );

  const currentTourFloor = useMemo(() => {
    const id = TOUR_SEQUENCE[tourStepIndex % TOUR_SEQUENCE.length];
    return config.floors.find((f) => f.id === id) || null;
  }, [tourStepIndex, config.floors]);

  const activeAtmosphere = previewAtmosphere || config.atmosphere;

  const targetPortalScene = useMemo(() => {
    if (extractedScenes.length === 0) return null;
    const preferredId =
      activeSceneId || deepLinkSceneId || selectedFloor?.defaultSceneId || null;
    if (preferredId) {
      const exact = extractedScenes.find((s) => s.id === preferredId);
      if (exact) return exact;
    }
    if (selectedFloor) {
      const byZone = extractedScenes.find((s) => s.zone === selectedFloor.zone);
      if (byZone) return byZone;
    }
    return extractedScenes[0];
  }, [extractedScenes, activeSceneId, deepLinkSceneId, selectedFloor]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0B0C0E] text-[#F4F0EA]">
      {/* Persistent Three-Zone Luxury Navigation */}
      <MainNavigation
        projectName={config.projectName}
        stage={stage}
        soundEnabled={soundEnabled}
        onToggleSound={() => spatialAudio.toggle()}
        onExploreTower={handleResetToTower}
        onOpenResidences={handleOpenResidences}
        onOpenArchitecture={handleOpenArchitecture}
        onOpenContact={() => handleOpenContact()}
      />

      {/* Base Architectural Tower Elevation + Interactive Normalized Hotspots */}
      <TowerElevation
        src={config.elevationImage.src}
        heroVideoSrc={config.heroVideoSrc}
        naturalWidth={config.elevationImage.naturalWidth}
        naturalHeight={config.elevationImage.naturalHeight}
        brightness={(previewAtmosphere || config.atmosphere).brightness}
        contrast={(previewAtmosphere || config.atmosphere).contrast}
        stage={stage}
        floors={config.floors}
        hoveredFloorId={hoveredFloorId}
        selectedFloorId={selectedFloor?.id || null}
        tierFilter={tierFilter}
        suppressCallouts={levelsMenuOpen}
        stageRef={stageRef}
        boundsRef={boundsRef}
        onHoverFloor={setHoveredFloorId}
        onSelectFloor={(floor) => handleSelectFloor(floor)}
      />

      {/* Interactive Tower Floor Directory & Facade Readout */}
      <FloorSelection
        visible={stage === 'explore'}
        floors={config.floors}
        hoveredFloorId={hoveredFloorId}
        tierFilter={tierFilter}
        studioMode={studioMode}
        onChangeTierFilter={handleChangeTierFilter}
        onHoverFloor={setHoveredFloorId}
        onSelectFloor={(floor) => handleSelectFloor(floor)}
        onStartTour={handleStartTour}
        onOpenCalibration={handleOpenCalibration}
        onDirectoryOpenChange={setLevelsMenuOpen}
      />

      {/* Stage Two: True Three.js 3D Architectural Camera Fly-Through */}
      <CinematicZoom
        stage={stage}
        selectedFloor={selectedFloor}
        targetScene={targetPortalScene}
        elevationSrc={config.elevationImage.src}
        atmosphere={activeAtmosphere}
        stageRef={stageRef}
        boundsRef={boundsRef}
        animation={config.animation}
        onZoomComplete={handleZoomComplete}
        onReturnComplete={handleReturnComplete}
      />

      {/* Stage Three & Four: Multi-Scene Interior Exploration */}
      <InteriorGallery
        stage={stage}
        selectedFloor={selectedFloor}
        scenes={extractedScenes}
        interiorStageRef={interiorStageRef}
        sceneTransitionDuration={config.animation.sceneTransitionDuration}
        studioMode={studioMode}
        initialSceneId={deepLinkSceneId}
        tourActive={tourActive}
        soundEnabled={soundEnabled}
        onToggleSound={() => spatialAudio.toggle()}
        onStopTour={stopTour}
        onTourFloorComplete={handleTourFloorComplete}
        onSceneChange={setActiveSceneId}
        onBackToTower={handleBackToTower}
        onOpenContact={() => handleOpenContact()}
        onOpenFloorPlan={handleOpenFloorPlan}
        onOpenCalibration={handleOpenCalibration}
      />

      {/* Guided Architectural Tour Floating Pause Control */}
      {tourActive && (
        <div className="fixed top-16 sm:top-[72px] left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
          <button
            type="button"
            onClick={stopTour}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-[#101216]/88 backdrop-blur-md border border-[#C8A96E]/60 text-[10px] tracking-[0.16em] uppercase text-[#DFC48F] hover:bg-[#C8A96E] hover:text-[#0B0C0E] transition-colors shadow-xl whitespace-nowrap cursor-pointer"
          >
            <Pause className="w-3 h-3 fill-current" />
            <span>
              Guided Tour
              {currentTourFloor ? ` · ${currentTourFloor.levelLabel}` : ''}
            </span>
            <span className="font-mono tabular-nums opacity-75">
              {String((tourStepIndex % TOUR_SEQUENCE.length) + 1).padStart(2, '0')}/
              {String(TOUR_SEQUENCE.length).padStart(2, '0')}
            </span>
            <span className="opacity-80">· Pause</span>
          </button>
        </div>
      )}

      {/* Stage Transition Guard */}
      <GlobalStageTransition stage={stage} />

      {/* Extraction Error Banner */}
      {extractionError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-sm px-4 py-3 bg-rose-950/90 border border-rose-500/40 text-xs text-rose-100"
        >
          {extractionError}
        </div>
      )}

      {/* Functional Modals & Calibration Drawer */}
      <ContactInterface
        open={contactOpen}
        contact={config.contact}
        floors={config.floors}
        preselectedFloorLabel={selectedFloor?.levelLabel}
        preselectedUnitLabel={preselectedUnitLabel}
        onClose={() => setContactOpen(false)}
      />

      <ResidencesModal
        open={residencesOpen}
        floors={config.floors}
        onClose={() => setResidencesOpen(false)}
        onSelectFloor={(floor) => handleSelectFloor(floor)}
        onOpenFloorPlan={handleOpenFloorPlan}
      />

      <ResidentialFloorPlanModal
        open={floorPlanOpen}
        floor={selectedFloor?.zone === 'residential' ? selectedFloor : null}
        onClose={() => setFloorPlanOpen(false)}
        onBookViewing={(unitLabel) => handleOpenContact(unitLabel)}
        onViewInteriorScene={handleViewInteriorFromFloorPlan}
      />

      <ArchitectureModal
        open={architectureOpen}
        elevationSrc={config.elevationImage.src}
        specs={config.specs}
        location={config.location}
        scenes={extractedScenes}
        onClose={() => setArchitectureOpen(false)}
        onExploreTower={handleResetToTower}
      />

      <StudioCalibration
        open={calibrationOpen}
        config={config}
        extractedScenes={extractedScenes}
        onClose={() => {
          setPreviewAtmosphere(null);
          setCalibrationOpen(false);
        }}
        onSaveConfig={handleSaveConfig}
        onResetDefaults={handleResetDefaults}
        onPreviewAtmosphere={setPreviewAtmosphere}
      />
    </main>
  );
}
