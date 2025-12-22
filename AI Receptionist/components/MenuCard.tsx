
import React from 'react';
import { MenuItem } from '../types';

interface MenuCardProps {
  item: MenuItem;
  onClick: (item: MenuItem) => void;
}

export const MenuCard: React.FC<MenuCardProps> = ({ item, onClick }) => {
  return (
    <div 
      onClick={() => onClick(item)}
      className="glass-card p-5 rounded-xl hover:bg-orange-50/50 transition-all duration-300 border border-orange-100/50 flex flex-col h-full group cursor-pointer active:scale-95"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-base font-bold text-gray-800 leading-tight group-hover:text-orange-600 transition-colors">
          {item.name}
        </h3>
        <span className="text-sm font-bold text-orange-600 ml-2">
          ${item.price.toFixed(2)}
        </span>
      </div>
      <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
        {item.description}
      </p>
      <div className="mt-3 text-[10px] font-bold text-orange-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
        + Click to add
      </div>
    </div>
  );
};
