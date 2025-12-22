
import React, { useState } from 'react';
import { Order, OrderItem } from '../types';
import { OrderStatusStepper } from './OrderStatusStepper';

interface OrdersViewProps {
  orders: Order[];
  cart: OrderItem[];
  onConfirm: (address: string, phone: string) => void;
  onRemoveFromCart: (index: number) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ orders, cart, onConfirm, onRemoveFromCart }) => {
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const isFormValid = address.trim().length > 10 && phone.trim().length >= 8;

  return (
    <div className="space-y-12 pb-12">
      {/* Current Selection / Cart */}
      <div className="bg-white rounded-3xl p-8 border border-orange-100 shadow-sm">
        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-6 flex items-center">
          <i className="fas fa-shopping-basket mr-3 text-orange-500"></i>
          Active Selection
        </h3>

        {cart.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400 font-medium italic">Your selection is empty. Explore the menu to add items.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center group">
                  <div className="flex items-center space-x-3">
                    <span className="text-orange-600 font-bold text-sm">{item.quantity}x</span>
                    <span className="text-sm font-semibold text-gray-700">{item.name}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-400 font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                    <button onClick={() => onRemoveFromCart(idx)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <i className="fas fa-times-circle text-xs"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-dashed border-orange-100">
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Subtotal</span>
                <span className="text-xl font-black text-orange-600">${cartTotal.toFixed(2)}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Delivery Address</label>
                  <textarea 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Provide your complete street address..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all h-24 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Phone Number</label>
                  <input 
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 890"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  />
                </div>
                <button 
                  disabled={!isFormValid}
                  onClick={() => onConfirm(address, phone)}
                  className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:grayscale orange-gradient text-white shadow-lg shadow-orange-100"
                >
                  Confirm Order
                </button>
                {!isFormValid && cart.length > 0 && (
                  <p className="text-[10px] text-center text-orange-400 font-bold uppercase tracking-tighter">
                    Please provide a valid address and phone to confirm.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {orders.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center px-2">
            <i className="fas fa-history mr-3 text-gray-400"></i>
            Active Orders & History
          </h3>
          <div className="space-y-8">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-3xl p-8 border border-orange-100 shadow-sm relative overflow-hidden group">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">#{order.id.toUpperCase()}</span>
                    <p className="text-sm font-bold text-gray-800 mt-1">{order.timestamp.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-gray-900">${order.total.toFixed(2)}</span>
                    <p className="text-[9px] text-orange-500 font-black uppercase tracking-widest">Order Confirmed</p>
                  </div>
                </div>

                <div className="mb-12 px-2">
                  <OrderStatusStepper currentStatus={order.status} />
                </div>
                
                <div className="text-xs text-gray-600 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="font-bold flex items-start mb-2">
                    <i className="fas fa-map-marker-alt mr-3 mt-0.5 text-orange-400"></i> 
                    {order.address}
                  </p>
                  <p className="flex items-center font-bold">
                    <i className="fas fa-phone-alt mr-3 text-orange-400"></i> 
                    {order.phone}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-300 mb-2">Items Breakdown</h4>
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                       <span className="font-semibold text-gray-700">{item.name} <span className="text-orange-600 ml-1">x{item.quantity}</span></span>
                       <span className="text-gray-400">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
