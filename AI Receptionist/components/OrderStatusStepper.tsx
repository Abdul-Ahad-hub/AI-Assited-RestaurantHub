
import React from 'react';
import { Order } from '../types';

const STATUS_STEPS = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'] as const;

interface OrderStatusStepperProps {
  currentStatus: Order['status'];
  isAdmin?: boolean;
  onStatusChange?: (status: Order['status']) => void;
}

export const OrderStatusStepper: React.FC<OrderStatusStepperProps> = ({ currentStatus, isAdmin, onStatusChange }) => {
  const currentIndex = STATUS_STEPS.indexOf(currentStatus);

  return (
    <div className="flex items-center justify-between w-full py-4 relative">
      {/* Background Line */}
      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-orange-100 -translate-y-1/2 z-0"></div>
      
      {/* Active Line Overlay */}
      <div 
        className="absolute top-1/2 left-0 h-0.5 orange-gradient -translate-y-1/2 z-0 transition-all duration-700 ease-in-out"
        style={{ width: `${(currentIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
      ></div>

      {STATUS_STEPS.map((status, index) => {
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;
        
        return (
          <div key={status} className="relative z-10 flex flex-col items-center group">
            <button
              disabled={!isAdmin}
              onClick={() => onStatusChange?.(status)}
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                isActive 
                  ? 'bg-white border-orange-500 text-orange-600 shadow-md scale-110' 
                  : 'bg-white border-orange-100 text-orange-200'
              } ${isAdmin ? 'hover:scale-125 cursor-pointer' : 'cursor-default'}`}
            >
              {isActive ? (
                <i className={`fas ${status === 'Delivered' ? 'fa-check' : 'fa-circle'} text-[10px]`}></i>
              ) : (
                <div className="w-1.5 h-1.5 bg-orange-100 rounded-full"></div>
              )}
            </button>
            <span className={`absolute top-10 whitespace-nowrap text-[8px] font-black uppercase tracking-tighter transition-colors duration-500 ${
              isActive ? 'text-orange-600' : 'text-gray-300'
            }`}>
              {status}
            </span>
            
            {isAdmin && (
               <div className="absolute -top-8 bg-black text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase">
                 Set to {status}
               </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
