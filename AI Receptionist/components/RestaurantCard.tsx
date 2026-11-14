import React from 'react';
import { Restaurant } from '../types';
import { SmartImage } from './SmartImage';

interface RestaurantCardProps {
  restaurant: Restaurant & { distanceKm?: number };
  onClick: (restaurant: Restaurant) => void;
  isFavourite?: boolean;
  onToggleFavourite?: (restaurantId: string) => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({
  restaurant,
  onClick,
  isFavourite = false,
  onToggleFavourite
}) => {
  return (
    <div
      onClick={() => onClick(restaurant)}
      className="rh-card overflow-hidden flex flex-col cursor-pointer group h-full"
    >
      {/* Cover Photography */}
      <div className="relative h-48 w-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <SmartImage
          src={restaurant.cover_url}
          alt={restaurant.name}
          fallbackLabel={restaurant.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent"></div>

        {/* Top Badges: Show Rank without exposing bid money */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {restaurant.is_sponsored && (
            <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-lg shadow-md bg-[#7c3aed] text-white">
              Featured
            </span>
          )}
          {restaurant.is_trending && (
            <span className="bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-sm">
              <i className="fas fa-fire mr-1"></i> Trending
            </span>
          )}
          {restaurant.services?.voiceOrdering && (
            <span className="bg-gray-900/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
              <i className="fas fa-microphone text-[#a78bfa] mr-1"></i> Voice AI
            </span>
          )}
        </div>

        {/* Favourite Button */}
        {onToggleFavourite && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onToggleFavourite(restaurant.id);
            }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 hover:bg-white flex items-center justify-center shadow-sm transition-transform active:scale-90"
            aria-label="Save favourite restaurant"
          >
            <i
              className={`${
                isFavourite ? 'fas text-red-600' : 'far text-gray-900'
              } fa-heart text-sm`}
            ></i>
          </button>
        )}

        {/* Logo & Delivery / Distance Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <SmartImage
              src={restaurant.logo_url}
              alt={`${restaurant.name} logo`}
              fallbackLabel={restaurant.name.slice(0, 2)}
              className="w-11 h-11 rounded-xl object-cover border-2 border-white shadow-md bg-white shrink-0"
            />
            <div className="text-white truncate">
              <span className="text-[11px] font-bold bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <i className="fas fa-map-marker-alt text-[#a78bfa]"></i>
                <span className="truncate">
                  {restaurant.area}, {restaurant.city}
                  {restaurant.distanceKm !== undefined ? ` • ${restaurant.distanceKm} km` : ''}
                </span>
              </span>
            </div>
          </div>

          <span className="bg-white text-gray-900 text-xs font-extrabold px-2.5 py-1 rounded-lg shadow-sm shrink-0">
            {restaurant.delivery_time_min} to {restaurant.delivery_time_max} min
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-extrabold group-hover:text-[#7c3aed] transition-colors leading-snug">
              {restaurant.name}
              {restaurant.verification_status === 'verified' && (
                <i
                  className="fas fa-check-circle text-[#7c3aed] text-xs ml-1.5"
                  title="Verified Restaurant Partner"
                ></i>
              )}
            </h3>
            <div className="flex items-center gap-1 bg-[#f5f3ff] dark:bg-[#7c3aed]/20 text-[#7c3aed] dark:text-[#a78bfa] px-2 py-0.5 rounded-lg text-xs font-extrabold shrink-0">
              <i className="fas fa-star text-amber-500 text-[10px]"></i>
              <span>{restaurant.rating_avg > 0 ? restaurant.rating_avg.toFixed(1) : 'New'}</span>
              {restaurant.review_count > 0 && (
                <span className="text-gray-500 font-semibold text-[11px]">
                  ({restaurant.review_count})
                </span>
              )}
            </div>
          </div>

          <p className="text-xs font-semibold rh-text-muted mt-1">
            {restaurant.cuisine} • <span className="font-bold">{restaurant.price_range}</span>
          </p>

          <p className="text-xs rh-text-muted mt-1.5 line-clamp-2 leading-relaxed">
            {restaurant.description}
          </p>
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
          <span className="font-semibold rh-text-muted">
            <i className="fas fa-motorcycle text-[#7c3aed] mr-1.5"></i>
            ${restaurant.delivery_fee.toFixed(2)} delivery • Min ${restaurant.min_order.toFixed(0)}
          </span>
          <span className="font-extrabold text-[#7c3aed] dark:text-[#a78bfa] group-hover:translate-x-0.5 transition-transform">
            View Menu →
          </span>
        </div>
      </div>
    </div>
  );
};
