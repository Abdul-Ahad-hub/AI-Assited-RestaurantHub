import React from 'react';
import { MenuItem } from '../types';
import { SmartImage } from './SmartImage';

interface MenuCardProps {
  item: MenuItem;
  onClick: (item: MenuItem) => void;
  onRestaurantClick?: (restaurantIdOrSlug: string) => void;
  showRestaurantBadge?: boolean;
}

export const MenuCard: React.FC<MenuCardProps> = ({
  item,
  onClick,
  onRestaurantClick,
  showRestaurantBadge = false
}) => {
  const effectivePrice =
    item.discounted_price !== null && item.discounted_price !== undefined
      ? item.discounted_price
      : item.price;

  return (
    <div
      onClick={() => onClick(item)}
      className="rh-card overflow-hidden flex flex-col h-full group cursor-pointer"
    >
      <div className="relative h-44 w-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <SmartImage
          src={item.image_url}
          alt={item.name}
          fallbackLabel={item.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {item.is_popular && (
            <span className="bg-orange-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-sm">
              Popular
            </span>
          )}
          {item.discounted_price !== null && item.discounted_price !== undefined && (
            <span className="bg-gray-900 text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg">
              Deal
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {showRestaurantBadge && item.restaurant_name && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                if (onRestaurantClick && item.restaurant_id) {
                  onRestaurantClick(item.restaurant_id);
                }
              }}
              className="text-[11px] font-bold text-orange-600 hover:underline mb-1 flex items-center gap-1"
            >
              <i className="fas fa-store text-[10px]"></i>
              <span>{item.restaurant_name}</span>
              {item.restaurant_rating ? (
                <span className="text-gray-500 ml-1">★ {Number(item.restaurant_rating).toFixed(1)}</span>
              ) : null}
            </button>
          )}

          <div className="flex justify-between items-start gap-2 mb-1.5">
            <h3 className="text-sm font-extrabold group-hover:text-orange-600 transition-colors leading-snug">
              {item.name}
            </h3>
            <div className="text-right shrink-0">
              {item.discounted_price !== null && item.discounted_price !== undefined && (
                <span className="text-[11px] text-gray-400 line-through mr-1">
                  ${Number(item.price).toFixed(2)}
                </span>
              )}
              <span className="text-sm font-extrabold text-orange-600">
                ${Number(effectivePrice).toFixed(2)}
              </span>
            </div>
          </div>

          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-3">
            {item.description}
          </p>
        </div>

        <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-500">
            {item.variations && item.variations.length > 0
              ? `${item.variations.length} options`
              : item.cuisine || 'Freshly prepared'}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-orange-600 group-hover:translate-x-0.5 transition-transform">
            <i className="fas fa-plus-circle"></i> Add
          </span>
        </div>
      </div>
    </div>
  );
};
