import React, { useState, useEffect } from 'react';
import { MenuItem } from '../types';
import { SmartImage } from './SmartImage';

interface ItemModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (quantity: number, variationName?: string, addonNames?: string[]) => void;
}

export const ItemModal: React.FC<ItemModalProps> = ({ item, onClose, onAdd }) => {
  const [qty, setQty] = useState(1);
  const [selectedVariation, setSelectedVariation] = useState<string>('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  useEffect(() => {
    if (item) {
      setQty(1);
      setSelectedVariation(item.variations && item.variations.length > 0 ? item.variations[0].name : '');
      setSelectedAddons([]);
    }
  }, [item]);

  if (!item) return null;

  const basePrice =
    item.discounted_price !== null && item.discounted_price !== undefined
      ? Number(item.discounted_price)
      : Number(item.price);

  const variationDelta =
    item.variations?.find(v => v.name === selectedVariation)?.priceDelta || 0;

  const addonsTotal =
    item.addons
      ?.filter(a => selectedAddons.includes(a.name))
      .reduce((s, a) => s + Number(a.price || 0), 0) || 0;

  const unitPrice = basePrice + variationDelta + addonsTotal;
  const totalPrice = unitPrice * qty;

  const toggleAddon = (name: string) => {
    setSelectedAddons(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] flex flex-col max-h-[88vh]"
      >
        {/* Top Dish Image */}
        <div className="relative h-48 w-full shrink-0 bg-[#f1f3f4] dark:bg-[#1e1f20]">
          <SmartImage
            src={item.image_url}
            alt={item.name}
            fallbackLabel={item.name}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 dark:bg-[#202124]/95 text-[#202124] dark:text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-white dark:bg-[#202124]">
          <div>
            {item.restaurant_name && (
              <p className="text-xs font-extrabold text-[#1a73e8] dark:text-[#8ab4f8] uppercase tracking-wider mb-1">
                {item.restaurant_name}
              </p>
            )}
            <div className="flex justify-between items-start gap-3">
              <h3 className="text-xl font-extrabold text-[#202124] dark:text-[#e8eaed]">
                {item.name}
              </h3>
              <span className="text-lg font-extrabold text-[#1a73e8] dark:text-[#8ab4f8] shrink-0">
                ${basePrice.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1.5 leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Variations */}
          {item.variations && item.variations.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-[#202124] dark:text-[#e8eaed] block">
                Choose Portion / Variation
              </label>
              <div className="space-y-2">
                {item.variations.map(v => {
                  const isSelected = selectedVariation === v.name;
                  return (
                    <label
                      key={v.name}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-[#1a73e8] bg-[#e8f0fe] dark:bg-[#1a73e8]/20 text-[#202124] dark:text-white'
                          : 'border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#28292c] text-[#202124] dark:text-[#e8eaed]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="variation"
                          checked={isSelected}
                          onChange={() => setSelectedVariation(v.name)}
                          className="accent-[#1a73e8] w-4 h-4"
                        />
                        <span className="text-xs sm:text-sm font-bold">{v.name}</span>
                      </div>
                      <span className="text-xs font-extrabold text-[#1a73e8] dark:text-[#8ab4f8]">
                        {v.priceDelta > 0 ? `+$${Number(v.priceDelta).toFixed(2)}` : 'Included'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {item.addons && item.addons.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-[#202124] dark:text-[#e8eaed] block">
                Optional Extras & Add-ons
              </label>
              <div className="space-y-2">
                {item.addons.map(a => {
                  const isChecked = selectedAddons.includes(a.name);
                  return (
                    <label
                      key={a.name}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-[#1a73e8] bg-[#e8f0fe] dark:bg-[#1a73e8]/20 text-[#202124] dark:text-white'
                          : 'border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#28292c] text-[#202124] dark:text-[#e8eaed]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAddon(a.name)}
                          className="accent-[#1a73e8] w-4 h-4"
                        />
                        <span className="text-xs sm:text-sm font-bold">{a.name}</span>
                      </div>
                      <span className="text-xs font-extrabold text-[#1a73e8] dark:text-[#8ab4f8]">
                        +${Number(a.price).toFixed(2)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Footer with Quantity & Add to Cart */}
        <div className="p-4 sm:p-5 border-t border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#1e1f20] space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#5f6368] dark:text-[#9aa0a6]">
              Quantity
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-9 h-9 rounded-xl border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] flex items-center justify-center hover:border-[#1a73e8]"
              >
                <i className="fas fa-minus text-xs"></i>
              </button>
              <span className="text-base font-extrabold w-7 text-center">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                className="w-9 h-9 rounded-xl border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] flex items-center justify-center hover:border-[#1a73e8]"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAdd(qty, selectedVariation || undefined, selectedAddons)}
            className="w-full rh-btn-primary py-3.5 rounded-xl text-sm font-extrabold flex justify-between items-center px-5 shadow-md"
          >
            <span>Add to Cart</span>
            <span>${totalPrice.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
