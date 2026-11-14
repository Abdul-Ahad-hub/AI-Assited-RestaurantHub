import React from 'react';
import { Order } from '../types';

const STATUS_STEPS: Order['status'][] = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Out for Delivery',
  'Delivered'
];

interface OrderStatusStepperProps {
  currentStatus: Order['status'];
  isAdmin?: boolean;
  onStatusChange?: (status: Order['status']) => void;
}

export const OrderStatusStepper: React.FC<OrderStatusStepperProps> = ({
  currentStatus,
  isAdmin,
  onStatusChange
}) => {
  if (currentStatus === 'Cancelled') {
    return (
      <div className="bg-red-50 border border-red-200 text-[#D92D20] px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-between">
        <span>
          <i className="fas fa-ban mr-2"></i> Order Cancelled
        </span>
        {isAdmin && (
          <button
            onClick={() => onStatusChange?.('Pending')}
            className="underline text-[11px] font-bold"
          >
            Reopen Order
          </button>
        )}
      </div>
    );
  }

  const currentIndex = Math.max(0, STATUS_STEPS.indexOf(currentStatus));

  return (
    <div className="flex items-center justify-between w-full py-4 relative">
      <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#E4EBE6] -translate-y-1/2 z-0 rounded-full"></div>

      <div
        className="absolute top-1/2 left-0 h-1 bg-[#00A86B] -translate-y-1/2 z-0 transition-all duration-500 ease-in-out rounded-full"
        style={{ width: `${(currentIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
      ></div>

      {STATUS_STEPS.map((status, index) => {
        const isActive = index <= currentIndex;
        return (
          <div key={status} className="relative z-10 flex flex-col items-center group">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => onStatusChange?.(status)}
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                isActive
                  ? 'bg-[#00A86B] border-[#00A86B] text-white shadow-xs scale-105'
                  : 'bg-white border-[#E4EBE6] text-[#68736D]'
              } ${isAdmin ? 'hover:scale-115 cursor-pointer' : 'cursor-default'}`}
            >
              {isActive ? (
                <i className={`fas ${status === 'Delivered' ? 'fa-check' : 'fa-circle'} text-[10px]`}></i>
              ) : (
                <div className="w-1.5 h-1.5 bg-[#E4EBE6] rounded-full"></div>
              )}
            </button>
            <span
              className={`absolute top-10 whitespace-nowrap text-[10px] font-bold tracking-tight ${
                isActive ? 'text-[#087A50]' : 'text-[#68736D]'
              }`}
            >
              {status}
            </span>
          </div>
        );
      })}
    </div>
  );
};
