import React from 'react';
import { AppStage } from '../types/architecture';

interface GlobalStageTransitionProps {
  stage: AppStage;
}

/**
 * Pure unobstructed 3D transitions are rendered directly by ThreeZoomPortal.
 * Keep this component minimal and free of 2D box crosshairs or brackets.
 */
export const GlobalStageTransition: React.FC<GlobalStageTransitionProps> = () => {
  return null;
};
