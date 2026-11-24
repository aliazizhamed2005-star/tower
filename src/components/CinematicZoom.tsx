import React from 'react';
import {
  AnimationSettings,
  AppStage,
  ElevationAtmosphere,
  ExtractedScene,
  FloorHotspot,
  ImageBounds,
} from '../types/architecture';
import { ThreeZoomPortal } from './ThreeZoomPortal';

interface CinematicZoomProps {
  stage: AppStage;
  selectedFloor: FloorHotspot | null;
  targetScene: ExtractedScene | null;
  elevationSrc: string;
  atmosphere: ElevationAtmosphere;
  stageRef: React.RefObject<HTMLDivElement | null>;
  boundsRef: React.MutableRefObject<ImageBounds>;
  animation: AnimationSettings;
  onZoomComplete: () => void;
  onReturnComplete: () => void;
}

export const CinematicZoom: React.FC<CinematicZoomProps> = ({
  stage,
  selectedFloor,
  targetScene,
  elevationSrc,
  atmosphere,
  stageRef,
  boundsRef,
  animation,
  onZoomComplete,
  onReturnComplete,
}) => {
  return (
    <ThreeZoomPortal
      stage={stage}
      selectedFloor={selectedFloor}
      targetScene={targetScene}
      elevationSrc={elevationSrc}
      atmosphere={atmosphere}
      stageRef={stageRef}
      boundsRef={boundsRef}
      animation={animation}
      onZoomComplete={onZoomComplete}
      onReturnComplete={onReturnComplete}
    />
  );
};
