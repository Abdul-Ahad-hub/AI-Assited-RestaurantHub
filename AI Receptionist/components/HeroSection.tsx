import React from 'react';
import { NavTabId } from './HeaderBar';

interface HeroSectionProps {
  omniInput: string;
  onChangeOmniInput: (val: string) => void;
  onSubmitSearch: (e: React.FormEvent) => void;
  onSelectTab: (tab: NavTabId) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  omniInput,
  onChangeOmniInput,
  onSubmitSearch,
  onSelectTab
}) => {
  return (
    <section className="rh-hero-gradient rh-hero-section">
      <div className="rh-container text-center space-y-6">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
          Everything's here
        </h1>

        <p className="text-white/90 text-sm sm:text-base md:text-lg max-w-2xl mx-auto font-medium leading-relaxed">
          Discover top restaurants, order your favorite food in seconds, or let AI place your order by chat or voice.
        </p>

        {/* Clean Dedicated Search Bar (Search Only — AI is on bottom-right corner) */}
        <form onSubmit={onSubmitSearch} className="rh-search-bar">
          <i className="fas fa-search text-[#1a73e8] dark:text-[#8ab4f8] text-base shrink-0"></i>
          <input
            type="text"
            value={omniInput}
            onChange={e => onChangeOmniInput(e.target.value)}
            placeholder="Search restaurants, cuisines, or dishes..."
            className="flex-1 bg-transparent text-sm sm:text-base font-semibold text-[#202124] dark:text-[#e8eaed] placeholder-[#5f6368] dark:placeholder-[#9aa0a6] outline-none py-2.5"
          />
          <button
            type="submit"
            className="rh-btn-primary px-6 py-3 rounded-full text-xs sm:text-sm font-extrabold shrink-0"
          >
            Search
          </button>
        </form>

        {/* Quick Task Shortcuts (Customer Discovery Only) */}
        <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => onSelectTab('best-restaurants')}
            className="bg-white text-[#7c3aed] hover:opacity-95 px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-2 transition-all shadow-md"
          >
            <i className="fas fa-trophy"></i>
            <span>Best Restaurants</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('trending-food')}
            className="bg-white/15 hover:bg-white hover:text-[#7c3aed] text-white px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-2 transition-all border border-white/25"
          >
            <i className="fas fa-fire"></i>
            <span>Trending Food</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('nearest-restaurants')}
            className="bg-white/15 hover:bg-white hover:text-[#7c3aed] text-white px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-2 transition-all border border-white/25"
          >
            <i className="fas fa-location-arrow"></i>
            <span>Nearest Restaurants</span>
          </button>
        </div>
      </div>
    </section>
  );
};
