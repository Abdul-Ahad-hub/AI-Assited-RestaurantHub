import React, { useState } from 'react';
import { Order, OrderItem, UserProfile } from '../types';
import { OrderStatusStepper } from './OrderStatusStepper';

interface OrdersViewProps {
  orders: Order[];
  cart: OrderItem[];
  user?: UserProfile | null;
  onConfirm: (params: {
    address: string;
    phone: string;
    orderType: 'delivery' | 'pickup' | 'dine_in';
    offerCode: string;
    notes: string;
  }) => Promise<void> | void;
  onRemoveFromCart: (index: number) => void;
  onUpdateCartQty?: (index: number, delta: number) => void;
  onCancelOrder?: (orderId: string) => void;
  onRequestVoiceFormFill?: (onFill: (fields: Record<string, string>) => void) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  cart,
  user,
  onConfirm,
  onRemoveFromCart,
  onUpdateCartQty,
  onCancelOrder,
  onRequestVoiceFormFill
}) => {
  const [address, setAddress] = useState(user?.address || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup' | 'dine_in'>('delivery');
  const [offerCode, setOfferCode] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cart.length > 0 && orderType === 'delivery' ? 1.99 : 0;
  const estimatedTax = Math.round(cartSubtotal * 0.08 * 100) / 100;
  const estimatedTotal = cartSubtotal + deliveryFee + estimatedTax;

  const isFormValid =
    cart.length > 0 &&
    (orderType !== 'delivery' || address.trim().length >= 5) &&
    phone.trim().length >= 6;

  const handlePlaceOrder = async () => {
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm({
        address,
        phone,
        orderType,
        offerCode: offerCode.trim().toUpperCase(),
        notes
      });
      setOfferCode('');
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceFillClick = () => {
    if (!onRequestVoiceFormFill) return;
    onRequestVoiceFormFill(fields => {
      if (fields.address) setAddress(fields.address);
      if (fields.phone) setPhone(fields.phone);
      if (fields.offerCode) setOfferCode(fields.offerCode.toUpperCase());
      if (fields.notes) setNotes(fields.notes);
      if (
        fields.orderType &&
        ['delivery', 'pickup', 'dine_in'].includes(fields.orderType.toLowerCase())
      ) {
        setOrderType(fields.orderType.toLowerCase() as any);
      }
    });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Cart & Checkout Box */}
      <div className="rh-surface rounded-2xl p-6 md:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="text-lg font-extrabold flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
              <i className="fas fa-shopping-bag"></i>
            </span>
            Active Cart & Checkout
          </h3>
          <div className="flex items-center gap-2">
            {cart.length > 0 && onRequestVoiceFormFill && (
              <button
                type="button"
                onClick={handleVoiceFillClick}
                className="rh-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2"
                title="Speak your address, phone, and notes to auto-fill this form"
              >
                <i className="fas fa-microphone"></i>
                <span>AI Fill with Voice</span>
              </button>
            )}
            {cart[0]?.restaurantName && (
              <span className="text-xs font-bold text-[#1a73e8] bg-[#e8f0fe] px-3 py-1.5 rounded-lg">
                Ordering from: {cart[0].restaurantName}
              </span>
            )}
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-10 rh-surface-muted rounded-xl">
            <i className="fas fa-utensils text-2xl rh-text-muted mb-2"></i>
            <p className="text-sm font-bold">Your cart is currently empty</p>
            <p className="text-xs rh-text-muted mt-1">
              Browse any restaurant menu or use the AI Assistant on the bottom-right corner.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cart Items */}
            <div className="divide-y divide-[#dadce0] dark:divide-[#3c4043]">
              {cart.map((item, idx) => (
                <div key={idx} className="py-3.5 flex justify-between items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold">{item.name}</span>
                      {item.variationName && (
                        <span className="text-[11px] font-semibold rh-surface-muted px-2 py-0.5 rounded-md">
                          {item.variationName}
                        </span>
                      )}
                    </div>
                    {item.addonNames && item.addonNames.length > 0 && (
                      <p className="text-[11px] rh-text-muted mt-0.5">
                        + {item.addonNames.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {onUpdateCartQty ? (
                      <div className="flex items-center border border-[#dadce0] dark:border-[#3c4043] rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => onUpdateCartQty(idx, -1)}
                          className="px-2.5 py-1 text-xs font-bold hover:bg-[#f1f3f4] dark:hover:bg-[#303134]"
                        >
                          -
                        </button>
                        <span className="px-2.5 py-1 text-xs font-extrabold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateCartQty(idx, 1)}
                          className="px-2.5 py-1 text-xs font-bold hover:bg-[#f1f3f4] dark:hover:bg-[#303134]"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-extrabold text-[#1a73e8]">x{item.quantity}</span>
                    )}

                    <span className="text-sm font-extrabold w-16 text-right">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(idx)}
                      className="rh-text-muted hover:text-[#d93025] transition-colors"
                      title="Remove item"
                    >
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Type Selector */}
            <div className="grid grid-cols-3 gap-2 rh-surface-muted p-1.5 rounded-xl">
              {(['delivery', 'pickup', 'dine_in'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={`py-2 rounded-lg text-xs font-extrabold capitalize transition-all ${
                    orderType === t
                      ? 'bg-[#1a73e8] text-white shadow-xs'
                      : 'rh-text-muted hover:text-[#1a73e8]'
                  }`}
                >
                  {t === 'dine_in' ? 'Dine-In' : t}
                </button>
              ))}
            </div>

            {/* Delivery / Contact Form with AI Voice Fill */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider rh-text-muted">
                  Delivery & Contact Details
                </span>
                {onRequestVoiceFormFill && (
                  <button
                    type="button"
                    onClick={handleVoiceFillClick}
                    className="text-xs font-extrabold text-[#1a73e8] dark:text-[#8ab4f8] hover:underline flex items-center gap-1.5"
                  >
                    <i className="fas fa-microphone"></i>
                    <span>AI Fill Form via Voice</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orderType === 'delivery' && (
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold block mb-1.5">
                      Delivery Address *
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="House/Apt, Street, Area, City..."
                      className="w-full rh-surface-muted rounded-xl px-4 py-3 text-sm focus:border-[#1a73e8] outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold block mb-1.5">
                    Contact Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full rh-surface-muted rounded-xl px-4 py-3 text-sm focus:border-[#1a73e8] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1.5">
                    Promo / Offer Code (e.g. AHAD20, SMASH4)
                  </label>
                  <input
                    type="text"
                    value={offerCode}
                    onChange={e => setOfferCode(e.target.value)}
                    placeholder="Optional promo code"
                    className="w-full rh-surface-muted rounded-xl px-4 py-3 text-sm uppercase focus:border-[#1a73e8] outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold block mb-1.5">
                    Kitchen / Rider Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Spice preference, gate instructions, cutlery..."
                    className="w-full rh-surface-muted rounded-xl px-4 py-3 text-sm focus:border-[#1a73e8] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="rh-surface-muted p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between rh-text-muted">
                <span>Items Subtotal</span>
                <span className="font-bold text-[#202124] dark:text-[#e8eaed]">${cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between rh-text-muted">
                <span>Delivery Fee ({orderType})</span>
                <span className="font-bold text-[#202124] dark:text-[#e8eaed]">${deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between rh-text-muted">
                <span>Estimated GST (8% • Verified Server-Side)</span>
                <span className="font-bold text-[#202124] dark:text-[#e8eaed]">${estimatedTax.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-[#dadce0] dark:border-[#3c4043] flex justify-between items-center text-sm font-extrabold">
                <span>Estimated Total (Cash on Delivery)</span>
                <span className="text-lg text-[#1a73e8] dark:text-[#8ab4f8]">${estimatedTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={!isFormValid || isSubmitting}
              onClick={handlePlaceOrder}
              className="w-full py-4 rounded-xl text-sm font-extrabold uppercase tracking-wider rh-btn-primary disabled:opacity-40 shadow-md"
            >
              {isSubmitting ? 'Validating & Placing Order...' : 'Confirm & Place Order'}
            </button>
          </div>
        )}
      </div>

      {/* Order History & Live Status Tracking */}
      {orders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-extrabold flex items-center gap-2">
            <i className="fas fa-history text-[#1a73e8]"></i>
            Live Order Tracking & History
          </h3>
          <div className="space-y-4">
            {orders.map(order => (
              <div
                key={order.id}
                className="rh-surface rounded-2xl p-6 shadow-xs space-y-5"
              >
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold bg-[#e8f0fe] text-[#1a73e8] px-2.5 py-1 rounded-md">
                        {order.order_number || `#${order.id.slice(0, 8).toUpperCase()}`}
                      </span>
                      {order.restaurant_name && (
                        <span className="text-sm font-extrabold">
                          {order.restaurant_name}
                        </span>
                      )}
                      {order.source === 'voice_ai' && (
                        <span className="text-[10px] font-bold bg-[#1a73e8] text-white px-2 py-0.5 rounded-md">
                          <i className="fas fa-microphone mr-1"></i> Voice AI
                        </span>
                      )}
                    </div>
                    <p className="text-xs rh-text-muted mt-1">
                      {new Date(order.created_at || order.timestamp).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-extrabold text-[#1a73e8] dark:text-[#8ab4f8]">
                      ${Number(order.total).toFixed(2)}
                    </span>
                    <p className="text-[11px] font-bold rh-text-muted uppercase">
                      {order.order_type || 'delivery'} • {order.status}
                    </p>
                  </div>
                </div>

                <div className="px-2 pb-4">
                  <OrderStatusStepper currentStatus={order.status} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rh-surface-muted p-4 rounded-xl text-xs">
                  <div>
                    <p className="font-bold mb-1">
                      <i className="fas fa-map-marker-alt text-[#1a73e8] mr-2"></i>
                      {order.delivery_address || order.address}
                    </p>
                    <p className="rh-text-muted">
                      <i className="fas fa-phone text-[#1a73e8] mr-2"></i>
                      {order.customer_phone || order.phone}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="font-semibold">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-bold rh-text-muted">
                          ${Number(item.lineTotal || item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {onCancelOrder && ['Pending', 'Confirmed'].includes(order.status) && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onCancelOrder(order.id)}
                      className="text-xs font-bold text-[#d93025] hover:underline"
                    >
                      Cancel Order
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
