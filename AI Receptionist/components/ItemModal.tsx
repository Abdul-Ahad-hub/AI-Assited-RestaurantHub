
import React, { useState } from 'react';
import { MenuItem } from '../types';

interface ItemModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (quantity: number) => void;
}

export const ItemModal: React.FC<ItemModalProps> = ({ item, onClose, onAdd }) => {
  const [qty, setQty] = useState(1);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-orange-900/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-orange-100 animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-black text-gray-900 mb-2">{item.name}</h3>
        <p className="text-sm text-gray-500 mb-6">{item.description}</p>
        
        <div className="flex items-center justify-between mb-8">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Quantity</span>
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-8 h-8 rounded-full border border-orange-100 flex items-center justify-center text-orange-600 hover:bg-orange-50"
            >
              <i className="fas fa-minus text-xs"></i>
            </button>
            <span className="text-xl font-black text-gray-800 w-4 text-center">{qty}</span>
            <button 
              onClick={() => setQty(qty + 1)}
              className="w-8 h-8 rounded-full border border-orange-100 flex items-center justify-center text-orange-600 hover:bg-orange-50"
            >
              <i className="fas fa-plus text-xs"></i>
            </button>
          </div>
        </div>

        <div className="flex flex-col space-y-3">
          <button 
            onClick={() => onAdd(qty)}
            className="orange-gradient text-white py-4 rounded-xl text-sm font-bold shadow-lg shadow-orange-100 flex justify-between px-6"
          >
            <span>Add to Selection</span>
            <span>${(item.price * qty).toFixed(2)}</span>
          </button>
          <button 
            onClick={onClose}
            className="text-gray-400 text-xs font-bold uppercase tracking-widest py-2 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
