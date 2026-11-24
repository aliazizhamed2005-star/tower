import React from 'react';
import { ExtractedScene } from '../types/architecture';

interface SceneThumbnailProps {
  scene: ExtractedScene;
  index: number;
  active: boolean;
  onSelect: () => void;
}

export const SceneThumbnail: React.FC<SceneThumbnailProps> = ({
  scene,
  index,
  active,
  onSelect,
}) => {
  const paddedIndex = String(index + 1).padStart(2, '0');

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`View ${paddedIndex}: ${scene.title}`}
      aria-current={active ? 'true' : undefined}
      className={`group relative shrink-0 w-28 sm:w-36 text-left transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C8A96E] ${
        active ? 'opacity-100' : 'opacity-60 hover:opacity-95'
      }`}
    >
      <div
        className={`relative aspect-[16/10] w-full overflow-hidden bg-[#141619] border transition-colors duration-200 ${
          active
            ? 'border-[#DFC48F] shadow-[0_0_14px_rgba(200,169,110,0.28)]'
            : 'border-white/15 group-hover:border-white/35'
        }`}
      >
        <img
          src={scene.blobUrl}
          alt={scene.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span
          className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${
            active
              ? 'bg-[#C8A96E] text-[#0B0C0E] font-medium'
              : 'bg-[#0B0C0E]/75 text-[#F4F0EA]/90'
          }`}
        >
          {paddedIndex}
        </span>
      </div>

      <div
        className={`mt-1.5 px-0.5 text-[11px] font-medium truncate transition-colors ${
          active ? 'text-[#DFC48F]' : 'text-[#F4F0EA]/85 group-hover:text-[#F4F0EA]'
        }`}
      >
        {scene.title}
      </div>
    </button>
  );
};
