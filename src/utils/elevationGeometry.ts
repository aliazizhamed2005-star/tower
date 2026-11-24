import { FloorHotspot, ImageBounds } from '../types/architecture';

/**
 * Computes the exact pixel rectangle of the 16:9 tower elevation video/image inside its viewport container.
 * Fills wide desktop/laptop viewports edge-to-edge while keeping the entire tower (crown to podium) visible
 * and keeping the tower centered and touch-friendly on narrow portrait screens.
 */
export function computeElevationImageBounds(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number
): ImageBounds {
  if (containerWidth <= 0 || containerHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
    return {
      left: 0,
      top: 0,
      width: containerWidth,
      height: containerHeight,
      containerWidth,
      containerHeight,
    };
  }

  const containerAspect = containerWidth / containerHeight;
  const imageAspect = naturalWidth / naturalHeight;

  let width: number;
  let height: number;

  if (containerAspect >= imageAspect) {
    // Ultra-wide screens: cover full width cleanly
    width = containerWidth;
    height = width / imageAspect;
  } else {
    // Standard desktop (16:10) & mobile portrait:
    // Fit height cleanly up to 1.85x container width so the tower (middle 32%) stays centered & unclipped
    const coverWidth = containerHeight * imageAspect;
    width = Math.min(coverWidth, containerWidth * 1.85);
    height = width / imageAspect;
  }

  const left = (containerWidth - width) / 2;
  const top = (containerHeight - height) / 2;

  return {
    left,
    top,
    width,
    height,
    containerWidth,
    containerHeight,
  };
}

/**
 * Computes the exact GSAP x, y translation and scale required to zoom the tower stage
 * so that the selected floor's normalized (zoomTargetX, zoomTargetY) lands dead-center in the viewport.
 */
export function computeZoomTransform(
  floor: FloorHotspot,
  bounds: ImageBounds
): { scale: number; x: number; y: number } {
  const targetPixelX = bounds.left + floor.zoomTargetX * bounds.width;
  const targetPixelY = bounds.top + floor.zoomTargetY * bounds.height;

  const viewportCenterX = bounds.containerWidth / 2;
  const viewportCenterY = bounds.containerHeight / 2;

  const minCoverScale = Math.max(
    bounds.containerWidth / Math.max(1, bounds.width),
    bounds.containerHeight / Math.max(1, bounds.height)
  );
  const scale = Math.max(floor.zoomScale, minCoverScale * 2.4);

  const dx = targetPixelX - viewportCenterX;
  const dy = targetPixelY - viewportCenterY;

  return {
    scale,
    x: -dx * scale,
    y: -dy * scale,
  };
}
