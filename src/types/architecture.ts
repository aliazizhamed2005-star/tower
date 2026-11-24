export type AppStage = 'explore' | 'zooming' | 'interior' | 'returning';

export type TowerZone = 'residential' | 'office' | 'podium';

export type TierFilter = 'all' | TowerZone;

export type RoomCategory =
  | 'Living Areas'
  | 'Kitchen and Dining'
  | 'Bedrooms'
  | 'Bathrooms'
  | 'Entrance and Corridors'
  | 'Other Spaces';

export const ROOM_CATEGORIES: RoomCategory[] = [
  'Living Areas',
  'Kitchen and Dining',
  'Bedrooms',
  'Bathrooms',
  'Entrance and Corridors',
  'Other Spaces',
];

export interface CropRect {
  /** Normalized 0..1 horizontal start */
  x: number;
  /** Normalized 0..1 vertical start */
  y: number;
  /** Normalized 0..1 width */
  width: number;
  /** Normalized 0..1 height */
  height: number;
}

export interface CollageSource {
  id: string;
  label: string;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  zone: TowerZone;
}

export interface InteriorSceneConfig {
  id: string;
  collageId: string;
  title: string;
  subtitle: string;
  category: RoomCategory;
  zone: TowerZone;
  order: number;
  crop: CropRect;
  /** Optional pre-sliced WebP asset for instant loading without full-collage decode */
  preExtractedSrc?: string;
  pixelWidth?: number;
  pixelHeight?: number;
}

export interface ExtractedScene extends InteriorSceneConfig {
  sourceSrc: string;
  blobUrl: string;
  pixelWidth: number;
  pixelHeight: number;
}

export interface ResidenceMetadata {
  floorNumber: string;
  residenceType: string;
  bedrooms: string;
  bathrooms: string;
  area: string;
  view: string;
  price: string;
}

export interface FloorHotspot {
  id: string;
  floorNumber: number;
  levelLabel: string;
  title: string;
  tierLabel: string;
  status?: string;
  zone: TowerZone;
  defaultSceneId: string;
  /** Normalized 0..1 bounding box over the tower elevation image */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Normalized 0..1 focal coordinate for cinematic GSAP zoom */
  zoomTargetX: number;
  zoomTargetY: number;
  zoomScale: number;
  residenceInfo: ResidenceMetadata;
}

export interface TowerSpecs {
  totalLevels: string;
  structure: string;
  ceilingHeight: string;
  completion: string;
}

export interface LocationContext {
  district: string;
  orientation: string;
  connectivity: string;
  highlights: {
    id: string;
    label: string;
    detail: string;
  }[];
}

export interface ContactDetails {
  salesGalleryAddress: string;
  phone: string;
  email: string;
  hours: string;
}

export interface AnimationSettings {
  zoomDuration: number;
  revealDuration: number;
  returnDuration: number;
  sceneTransitionDuration: number;
}

export interface ElevationAtmosphere {
  brightness: number;
  contrast: number;
}

export interface TowerProjectConfig {
  projectName: string;
  heroVideoSrc?: string;
  elevationImage: {
    src: string;
    naturalWidth: number;
    naturalHeight: number;
  };
  atmosphere: ElevationAtmosphere;
  specs: TowerSpecs;
  location: LocationContext;
  collages: CollageSource[];
  scenes: InteriorSceneConfig[];
  floors: FloorHotspot[];
  contact: ContactDetails;
  animation: AnimationSettings;
}

export interface ImageBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  containerWidth: number;
  containerHeight: number;
}
