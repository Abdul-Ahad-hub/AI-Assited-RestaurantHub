import React from 'react';
import { Restaurant } from '../types';
import { SmartImage } from './SmartImage';

interface RankedRestaurantRowProps {
  restaurant: Restaurant & { distanceKm?: number };
  rank: number;
  onClick: (restaurant: Restaurant) => void;
  isFavourite?: boolean;
  onToggleFavourite?: (restaurantId: string) => void;
  /** Rank column and bid money are for the restaurant side only (never shown to customers) */
  showRank?: boolean;
  showBidMoneyForOwner?: boolean;
  ownerBidAmount?: number;
}

export const RankedRestaurantRow: React.FC<RankedRestaurantRowProps> = ({
  restaurant,
  rank,
  onClick,
  isFavourite = false,
  onToggleFavourite,
  showRank = false,
  showBidMoneyForOwner = false,
  ownerBidAmount = 0
}) => {
  const isRankOne = showRank && rank === 1;
  const isTopThree = showRank && rank <= 3;

  const rankBadgeStyle =
    rank === 1
      ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-slate-950 shadow-lg shadow-amber-500/25 ring-2 ring-amber-300'
      : rank === 2
        ? 'bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] text-white shadow-md shadow-purple-500/20'
        : rank === 3
          ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white shadow-md'
          : 'rh-surface-muted rh-text-muted border border-gray-200 dark:border-zinc-700';

  return (
    <div
      onClick={() => onClick(restaurant)}
      className={`rh-card w-full cursor-pointer transition-all overflow-hidden flex flex-col md:flex-row items-stretch ${
        isRankOne
          ? 'ring-2 ring-amber-400 dark:ring-amber-400 shadow-xl bg-gradient-to-r from-amber-500/5 via-transparent to-transparent'
          : isTopThree
            ? 'ring-1 ring-[#7C3AED]/40 shadow-md'
            : ''
      }`}
    >
      {/* LEFT RANK COLUMN (restaurant side only) */}
      {showRank && (
      <div
        className={`flex md:flex-col items-center justify-between md:justify-center px-5 py-3 md:py-6 md:w-28 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-zinc-800 ${
          isRankOne ? 'bg-amber-500/10' : 'rh-surface-muted'
        }`}
      >
        <div className="flex md:flex-col items-center gap-2.5 md:gap-1.5">
          <div
            className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl flex flex-col items-center justify-center font-extrabold ${rankBadgeStyle}`}
          >
            {isRankOne && <i className="fas fa-crown text-[10px] mb-0.5"></i>}
            <span className="text-base md:text-xl leading-none">#{rank}</span>
          </div>
          <span
            className={`text-[10px] font-extrabold uppercase tracking-wider text-center ${
              isRankOne ? 'text-amber-600 dark:text-amber-400' : 'rh-text-muted'
            }`}
          >
            {isRankOne ? 'Top Rank' : `Rank ${rank}`}
          </span>
        </div>

        {showBidMoneyForOwner && (
          <div className="md:mt-3 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-extrabold text-center">
            {ownerBidAmount > 0 ? `$${ownerBidAmount} Bid` : 'Organic'}
          </div>
        )}
      </div>
      )}
      <div className="relative w-full md:w-64 lg:w-72 h-48 md:h-auto shrink-0 overflow-hidden bg-slate-900">
        <SmartImage
          src={restaurant.cover_url}
          alt={restaurant.name}
          fallbackLabel={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* Restaurant Logo & Delivery Time Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white shadow-md bg-white shrink-0">
            <SmartImage
              src={restaurant.logo_url}
              alt={restaurant.name}
              fallbackLabel={restaurant.name}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="bg-black/75 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
            <i className="fas fa-clock text-[#A78BFA] mr-1"></i>
            {restaurant.delivery_time_min} to {restaurant.delivery_time_max} min
          </span>
        </div>

        {/* Favourite Heart Button */}
        {onToggleFavourite && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onToggleFavourite(restaurant.id);
            }}
            aria-label="Save restaurant"
            className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm ${
              isFavourite
                ? 'bg-[#7C3AED] text-white'
                : 'bg-black/55 text-white hover:bg-[#7C3AED]'
            }`}
          >
            <i className={`${isFavourite ? 'fas' : 'far'} fa-heart text-xs`}></i>
          </button>
        )}
      </div>

      {/* RIGHT DETAILS & CALL TO ACTION */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {isRankOne && (
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md flex items-center gap-1">
                    <i className="fas fa-trophy"></i> #1 Featured Kitchen
                  </span>
                )}
                {!showRank && restaurant.is_sponsored && (
                  <span className="bg-[#f5f3ff] dark:bg-[#7c3aed]/20 text-[#7c3aed] dark:text-[#a78bfa] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md">
                    Featured
                  </span>
                )}
                <h3 className="text-lg sm:text-xl font-extrabold hover:text-[#7C3AED] transition-colors flex items-center gap-1.5">
                  <span>{restaurant.name}</span>
                  {restaurant.verification_status === 'verified' && (
                    <i
                      className="fas fa-check-circle text-[#7C3AED] text-sm"
                      title="Verified Partner"
                    ></i>
                  )}
                </h3>
              </div>
              <p className="text-xs font-semibold rh-text-muted mt-0.5">
                {restaurant.cuisine} • {restaurant.price_range} • {restaurant.area}, {restaurant.city}
                {typeof restaurant.distanceKm === 'number' && (
                  <span className="ml-2 text-[#7C3AED] font-bold">
                    • {restaurant.distanceKm.toFixed(1)} km away
                  </span>
                )}
              </p>
            </div>

            {/* Rating Pill */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-[#F5F3FF] dark:bg-[#2E1065] text-[#7C3AED] dark:text-[#C4B5FD] px-3 py-1.5 rounded-xl text-xs font-extrabold border border-[#7C3AED]/20">
                <i className="fas fa-star text-amber-400"></i>
                <span>
                  {restaurant.rating_avg > 0 ? restaurant.rating_avg.toFixed(1) : 'New'}
                </span>
                <span className="text-[11px] opacity-75">({restaurant.review_count})</span>
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm rh-text-muted line-clamp-2 leading-relaxed">
            {restaurant.description}
          </p>
        </div>

        {/* Bottom Bar: Services, Fees & View Menu CTA */}
        <div className="pt-3 border-t border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold rh-text-muted">
            <span className="rh-surface-muted px-2.5 py-1 rounded-lg">
              <i className="fas fa-motorcycle text-[#7C3AED] mr-1"></i>
              {restaurant.delivery_fee === 0
                ? 'Free Delivery'
                : `$${Number(restaurant.delivery_fee).toFixed(2)} Delivery`}
            </span>
            <span className="rh-surface-muted px-2.5 py-1 rounded-lg">
              Min ${Number(restaurant.min_order).toFixed(0)}
            </span>
            {restaurant.services?.dineIn && (
              <span className="rh-surface-muted px-2.5 py-1 rounded-lg">Dine In</span>
            )}
            {restaurant.services?.familySeating && (
              <span className="rh-surface-muted px-2.5 py-1 rounded-lg">Family Seating</span>
            )}
          </div>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onClick(restaurant);
            }}
            className="rh-btn-primary px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm"
          >
            <span>Explore Menu & Order</span>
            <i className="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};
