import React, { useState } from 'react';
import { Menu, Volume2, VolumeX, X } from 'lucide-react';
import { AppStage } from '../types/architecture';

interface MainNavigationProps {
  projectName: string;
  stage: AppStage;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onExploreTower: () => void;
  onOpenResidences: () => void;
  onOpenArchitecture: () => void;
  onOpenContact: () => void;
}

export const MainNavigation: React.FC<MainNavigationProps> = ({
  projectName,
  stage,
  soundEnabled,
  onToggleSound,
  onExploreTower,
  onOpenResidences,
  onOpenArchitecture,
  onOpenContact,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isHiddenDuringTransition =
    stage === 'zooming' || stage === 'interior' || stage === 'returning';

  const handleMobileAction = (fn: () => void) => {
    setMobileMenuOpen(false);
    fn();
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
          isHiddenDuringTransition
            ? 'opacity-0 pointer-events-none -translate-y-2'
            : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="mx-auto flex items-center justify-between gap-8 px-5 sm:px-8 lg:px-12 py-4 bg-gradient-to-b from-[#0B0C0E]/85 via-[#0B0C0E]/45 to-transparent">
          {/* Zone 1: Single-element brand wordmark */}
          <button
            type="button"
            onClick={onExploreTower}
            className="font-display text-lg sm:text-xl tracking-[0.2em] uppercase text-[#F4F0EA] hover:text-[#DFC48F] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C8A96E]"
          >
            {projectName}
          </button>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-8 text-xs tracking-[0.16em] uppercase text-[#F4F0EA]/80"
          >
            <button
              type="button"
              onClick={onOpenResidences}
              className="py-1 border-b border-transparent hover:text-[#F4F0EA] hover:border-[#F4F0EA]/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Residences
            </button>
            <button
              type="button"
              onClick={onOpenArchitecture}
              className="py-1 border-b border-transparent hover:text-[#F4F0EA] hover:border-[#F4F0EA]/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Architecture
            </button>
            <button
              type="button"
              onClick={onOpenContact}
              className="py-1 border-b border-transparent hover:text-[#F4F0EA] hover:border-[#F4F0EA]/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Contact
            </button>
          </nav>

          {/* Zone 3: Spatial Sound Toggle + Single Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleSound}
              aria-label={soundEnabled ? 'Mute spatial audio' : 'Enable spatial audio'}
              aria-pressed={soundEnabled}
              title={soundEnabled ? 'Spatial Audio: On' : 'Spatial Audio: Muted'}
              className={`inline-flex items-center justify-center w-10 h-10 border backdrop-blur-md transition-colors cursor-pointer ${
                soundEnabled
                  ? 'border-[#C8A96E]/45 bg-[#101216]/75 text-[#DFC48F] hover:border-[#C8A96E]'
                  : 'border-white/15 bg-[#101216]/75 text-[#A6A095] hover:text-[#F4F0EA] hover:border-white/30'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onOpenContact}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 text-[11px] font-medium tracking-[0.16em] uppercase text-[#0B0C0E] bg-[#C8A96E] hover:bg-[#DFC48F] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F4F0EA]"
            >
              Book a Viewing
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 border border-[#F4F0EA]/20 bg-[#141619]/75 backdrop-blur-md text-[#F4F0EA] hover:border-[#C8A96E] transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && !isHiddenDuringTransition && (
        <div className="fixed inset-0 z-50 lg:hidden bg-[#0B0C0E]/95 backdrop-blur-xl flex flex-col justify-between p-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <span className="font-display text-xl tracking-[0.2em] uppercase text-[#F4F0EA]">
              {projectName}
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="w-11 h-11 flex items-center justify-center border border-white/15 text-[#F4F0EA]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-5 my-auto">
            <button
              type="button"
              onClick={() => handleMobileAction(onOpenResidences)}
              className="text-left font-display text-3xl text-[#F4F0EA] hover:text-[#C8A96E] transition-colors py-1"
            >
              Residences
            </button>
            <button
              type="button"
              onClick={() => handleMobileAction(onOpenArchitecture)}
              className="text-left font-display text-3xl text-[#F4F0EA] hover:text-[#C8A96E] transition-colors py-1"
            >
              Architecture
            </button>
            <button
              type="button"
              onClick={() => handleMobileAction(onOpenContact)}
              className="text-left font-display text-3xl text-[#F4F0EA] hover:text-[#C8A96E] transition-colors py-1"
            >
              Contact
            </button>
          </nav>

          <button
            type="button"
            onClick={() => handleMobileAction(onOpenContact)}
            className="w-full py-3.5 text-xs font-medium tracking-[0.18em] uppercase text-[#0B0C0E] bg-[#C8A96E] hover:bg-[#DFC48F] transition-colors"
          >
            Book a Viewing
          </button>
        </div>
      )}
    </>
  );
};
