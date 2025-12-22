
import React from 'react';
import { Order } from '../types';
import { OrderStatusStepper } from './OrderStatusStepper';

interface AdminViewProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, newStatus: Order['status']) => void;
  onClose: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ orders, onUpdateStatus, onClose }) => {
  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-12">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl orange-gradient flex items-center justify-center text-white shadow-lg">
            <i className="fas fa-user-shield text-xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Admin Dashboard</h2>
            <p className="text-xs text-orange-400 font-bold uppercase tracking-widest">Manage Live Kitchen Orders</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
        >
          Exit Dashboard
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-20 border border-orange-100 shadow-sm text-center">
          <p className="text-gray-400 font-medium">Waiting for new orders to arrive...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-3xl p-8 border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">Order #{order.id.toUpperCase()}</span>
                      <h3 className="text-lg font-bold text-gray-800">{order.timestamp.toLocaleString()}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-orange-600">${order.total.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{order.items.length} Items Selected</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-orange-50/50 p-4 rounded-2xl border border-orange-100/50">
                    <div>
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Delivery Details</h4>
                      <p className="text-sm font-semibold text-gray-700 flex items-start">
                        <i className="fas fa-map-marker-alt mr-2 mt-1 text-orange-500 text-xs"></i>
                        {order.address}
                      </p>
                      <p className="text-sm font-semibold text-gray-700 flex items-center mt-2">
                        <i className="fas fa-phone-alt mr-2 text-orange-500 text-xs"></i>
                        {order.phone}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Ordered Items</h4>
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs font-medium text-gray-600">
                            <span>{item.name} x{item.quantity}</span>
                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-orange-100 pt-8 lg:pt-0 lg:pl-8">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 text-center">Change Order Status</h4>
                  <div className="px-4">
                    <OrderStatusStepper 
                      currentStatus={order.status} 
                      isAdmin={true} 
                      onStatusChange={(status) => onUpdateStatus(order.id, status)} 
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
