import { CropRect, ExtractedScene, InteriorSceneConfig } from '../types/architecture';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const existing = imageCache.get(src);
  if (existing) {
    return existing;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load architectural render: ${src}`));
    img.src = src;
  });

  imageCache.set(src, promise);
  return promise;
}

function clampCrop(crop: CropRect, imgWidth: number, imgHeight: number) {
  const sx = Math.max(0, Math.min(imgWidth - 1, Math.round(crop.x * imgWidth)));
  const sy = Math.max(0, Math.min(imgHeight - 1, Math.round(crop.y * imgHeight)));
  const sw = Math.max(16, Math.min(imgWidth - sx, Math.round(crop.width * imgWidth)));
  const sh = Math.max(16, Math.min(imgHeight - sy, Math.round(crop.height * imgHeight)));
  return { sx, sy, sw, sh };
}

function cropsMatch(a: CropRect, b: CropRect): boolean {
  const eps = 0.0005;
  return (
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.width - b.width) < eps &&
    Math.abs(a.height - b.height) < eps
  );
}

export async function extractSceneToBlobUrl(
  src: string,
  crop: CropRect
): Promise<{ blobUrl: string; pixelWidth: number; pixelHeight: number }> {
  const img = await loadImage(src);
  const { sx, sy, sw, sh } = clampCrop(crop, img.naturalWidth, img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize 2D canvas context for collage extraction');
  }

  // Copy at exact 1:1 native pixel resolution without smoothing loss
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Canvas failed to export scene PNG blob'));
      }
    }, 'image/png');
  });

  return {
    blobUrl: URL.createObjectURL(blob),
    pixelWidth: sw,
    pixelHeight: sh,
  };
}

export async function extractAllCollageScenes(
  scenes: InteriorSceneConfig[],
  collageMap: Record<string, string>,
  defaultCropsById?: Record<string, CropRect>
): Promise<ExtractedScene[]> {
  const ordered = [...scenes].sort((a, b) => a.order - b.order);

  const results = await Promise.all(
    ordered.map(async (scene) => {
      const sourceSrc = collageMap[scene.collageId];
      if (!sourceSrc) {
        throw new Error(`Missing collage source for ${scene.collageId}`);
      }

      const defaultCrop = defaultCropsById?.[scene.id];
      const canUsePreExtracted =
        Boolean(scene.preExtractedSrc) &&
        (!defaultCrop || cropsMatch(scene.crop, defaultCrop));

      if (canUsePreExtracted && scene.preExtractedSrc) {
        return {
          ...scene,
          sourceSrc,
          blobUrl: scene.preExtractedSrc,
          pixelWidth: scene.pixelWidth ?? 691,
          pixelHeight: scene.pixelHeight ?? 553,
        };
      }

      const { blobUrl, pixelWidth, pixelHeight } = await extractSceneToBlobUrl(
        sourceSrc,
        scene.crop
      );
      return {
        ...scene,
        sourceSrc,
        blobUrl,
        pixelWidth,
        pixelHeight,
      };
    })
  );

  return results;
}
