import React, { useEffect, useRef, useState } from 'react';
import { AppStage, FloorHotspot, ImageBounds, TierFilter } from '../types/architecture';
import { computeElevationImageBounds } from '../utils/elevationGeometry';
import { AtmosphericCanvas } from './AtmosphericCanvas';
import { FloorHotspots } from './FloorHotspots';

interface TowerElevationProps {
  src: string;
  heroVideoSrc?: string;
  naturalWidth: number;
  naturalHeight: number;
  brightness?: number;
  contrast?: number;
  stage: AppStage;
  floors: FloorHotspot[];
  hoveredFloorId: string | null;
  selectedFloorId: string | null;
  tierFilter: TierFilter;
  suppressCallouts?: boolean;
  stageRef: React.RefObject<HTMLDivElement | null>;
  boundsRef: React.MutableRefObject<ImageBounds>;
  onHoverFloor: (floorId: string | null) => void;
  onSelectFloor: (floor: FloorHotspot) => void;
}

export const TowerElevation: React.FC<TowerElevationProps> = ({
  src,
  heroVideoSrc,
  naturalWidth,
  naturalHeight,
  brightness = 1,
  contrast = 1,
  stage,
  floors,
  hoveredFloorId,
  selectedFloorId,
  tierFilter,
  suppressCallouts = false,
  stageRef,
  boundsRef,
  onHoverFloor,
  onSelectFloor,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const [bounds, setBounds] = useState<ImageBounds>(() =>
    computeElevationImageBounds(
      typeof window !== 'undefined' ? window.innerWidth : 1440,
      typeof window !== 'undefined' ? window.innerHeight : 900,
      naturalWidth,
      naturalHeight
    )
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateBounds = () => {
      const rect = el.getBoundingClientRect();
      const next = computeElevationImageBounds(
        rect.width,
        rect.height,
        naturalWidth,
        naturalHeight
      );
      boundsRef.current = next;
      setBounds(next);
    };

    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(el);
    window.addEventListener('resize', updateBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, [naturalWidth, naturalHeight, boundsRef]);

  // Keep the ambient architectural video playing smoothly on the tower elevation
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !heroVideoSrc || videoFailed) return;

    if (stage === 'explore' || stage === 'returning') {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Ignore autoplay restriction errors quietly
        });
      }
    } else if (stage === 'interior') {
      video.pause();
    }
  }, [stage, heroVideoSrc, videoFailed]);

  const useVideo = Boolean(heroVideoSrc) && !videoFailed;
  const interactive = stage === 'explore';
  const showGuideOutlines = stage === 'explore';
  const mediaFilter = `brightness(${brightness}) contrast(${contrast})`;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-10 overflow-hidden bg-[#0B0C0E] select-none"
    >
      {/* Unified GSAP Camera Stage Wrapper (used seamlessly by Overview, Explore, and Zoom) */}
      <div
        ref={stageRef}
        className="relative w-full h-full will-change-transform"
        style={{ transformOrigin: 'center center' }}
      >
        {/* Atmospheric Sky Extension Layer for mobile portrait & ultrawide breathing room */}
        <img
          src={src}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          style={{ filter: mediaFilter }}
          className="absolute inset-0 w-full h-full object-cover opacity-25 blur-3xl scale-110 pointer-events-none transition-[filter] duration-300"
        />

        {/* Lightweight Canvas Atmospheric Cloud & Light Haze Layer behind Tower Scene */}
        <AtmosphericCanvas active={stage === 'explore' || stage === 'returning'} />

        {/* Primary Aspect-Locked Tower Media Frame (Video + Poster Fallback) */}
        <div
          style={{
            left: `${bounds.left}px`,
            top: `${bounds.top}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
          }}
          className="absolute overflow-hidden bg-[#141619] shadow-[0_0_90px_rgba(11,12,14,0.85)]"
        >
          {/* Fallback static elevation visible until video renders or if video fails */}
          <img
            src={src}
            alt="Full Tower Architectural Elevation"
            referrerPolicy="no-referrer"
            style={{ filter: mediaFilter }}
            className={`w-full h-full object-cover block pointer-events-none transition-[opacity,filter] duration-300 ${
              useVideo && videoReady ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Continuous Looping Architectural Video */}
          {useVideo && (
            <video
              ref={videoRef}
              src={heroVideoSrc}
              poster={src}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              onCanPlay={() => setVideoReady(true)}
              onLoadedData={() => setVideoReady(true)}
              onError={() => setVideoFailed(true)}
              style={{ filter: mediaFilter }}
              className={`absolute inset-0 w-full h-full object-fill block pointer-events-none transition-[opacity,filter] duration-300 ${
                videoReady ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}
        </div>

        {/* Subtle Architectural Top/Bottom Vignette + Spotlight Dimming when tier filter is active */}
        <div
          className={`absolute inset-0 pointer-events-none transition-colors duration-300 ${
            stage === 'explore' && tierFilter !== 'all'
              ? 'bg-[#0B0C0E]/35'
              : 'bg-gradient-to-b from-[#0B0C0E]/45 via-transparent to-[#0B0C0E]/65'
          }`}
        />

        {/* Normalized Clickable Floor Hotspots anchored directly over the video tower */}
        <FloorHotspots
          floors={floors}
          bounds={bounds}
          hoveredFloorId={hoveredFloorId}
          selectedFloorId={selectedFloorId}
          tierFilter={tierFilter}
          interactive={interactive}
          showGuideOutlines={showGuideOutlines}
          suppressCallouts={suppressCallouts}
          onHoverFloor={onHoverFloor}
          onSelectFloor={onSelectFloor}
        />
      </div>
    </div>
  );
};
