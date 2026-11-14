import React, { useState } from 'react';
import { Order } from '../types';
import { OrderStatusStepper } from './OrderStatusStepper';

interface LiveOrderBannerProps {
  orders: Order[];
  onViewAllOrders: () => void;
  onStatusChange?: (orderId: string, newStatus: Order['status']) => void;
  canChangeStatus?: boolean;
}

export const LiveOrderBanner: React.FC<LiveOrderBannerProps> = ({
  orders,
  onViewAllOrders,
  onStatusChange,
  canChangeStatus = false
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (!orders || orders.length === 0) return null;

  const activeOrder = orders[Math.min(selectedIdx, orders.length - 1)];
  if (!activeOrder) return null;

  return (
    <section className="rh-container pt-6">
      <div className="rh-card p-5 sm:p-6 border-l-4 border-l-orange-500">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center">
              <i className="fas fa-shipping-fast"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-orange-600">
                  Live Order Status
                </span>
                <span className="text-xs font-extrabold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 px-2.5 py-0.5 rounded-md">
                  {activeOrder.order_number || `#${activeOrder.id.slice(0, 8).toUpperCase()}`}
                </span>
                {activeOrder.restaurant_name && (
                  <span className="text-xs font-bold text-gray-500">
                    • {activeOrder.restaurant_name}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeOrder.items.map(i => `${i.quantity}x ${i.name}`).join(', ')} •{' '}
                <strong className="text-orange-600">${Number(activeOrder.total).toFixed(2)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {orders.length > 1 && (
              <div className="flex items-center gap-1">
                {orders.slice(0, 3).map((ord, idx) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors ${
                      idx === selectedIdx
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}
                  >
                    {ord.order_number || `#${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onViewAllOrders}
              className="text-xs font-extrabold text-orange-600 hover:underline ml-2"
            >
              All Orders ({orders.length}) →
            </button>
          </div>
        </div>

        {/* Interactive Status Stepper Bar */}
        <div className="px-3 pb-4 pt-1">
          <OrderStatusStepper
            currentStatus={activeOrder.status}
            isAdmin={canChangeStatus}
            onStatusChange={st => onStatusChange?.(activeOrder.id, st)}
          />
        </div>
      </div>
    </section>
  );
};
