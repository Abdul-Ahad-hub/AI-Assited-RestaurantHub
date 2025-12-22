import React, { useState, useEffect } from 'react';
import { MenuItem, Order, OrderItem } from './types';
import { MENU_ITEMS } from './constants';
import { MenuCard } from './components/MenuCard';
import { ChatInterface } from './components/ChatInterface';
import { OrdersView } from './components/OrdersView';
import { ItemModal } from './components/ItemModal';
import { AdminView } from './components/AdminView';

const App: React.FC = () => {
  const [view, setView] = useState<'client' | 'admin'>('client');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openAgent = () => {
    setIsChatOpen(true);
  };

  const handleAddToCart = (qty: number) => {
    if (selectedItem) {
      const newItem: OrderItem = {
        name: selectedItem.name,
        quantity: qty,
        price: selectedItem.price
      };
      setCart(prev => [...prev, newItem]);
      setSelectedItem(null);
    }
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirmManualOrder = (address: string, phone: string) => {
    const newOrder: Order = {
      id: Math.random().toString(36).substring(7),
      items: [...cart],
      address,
      phone,
      total: cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0),
      status: 'Pending',
      timestamp: new Date()
    };
    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
  };

  const handleAIAgentOrder = (items: OrderItem[], address: string, phone: string) => {
    const newOrder: Order = {
      id: Math.random().toString(36).substring(7),
      items,
      address,
      phone,
      total: items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0),
      status: 'Pending',
      timestamp: new Date()
    };
    setOrders(prev => [newOrder, ...prev]);
    setTimeout(() => {
        setIsChatOpen(false);
        setIsOrdersOpen(true);
    }, 2000);
  };

  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
  };

  return (
    <div className="min-h-screen selection:bg-orange-100">
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 px-6 ${
        scrolled ? 'bg-white/90 backdrop-blur-md py-3 border-b border-orange-100 shadow-sm' : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
             <div className="name-banner">
                <h1 className="text-sm font-black uppercase tracking-tighter text-orange-600">
                  Abdul Ahad's Kitchen
                </h1>
             </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setView(view === 'admin' ? 'client' : 'admin')}
              className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-orange-500 transition-colors"
            >
              {view === 'admin' ? 'Customer View' : 'Kitchen Login'}
            </button>
            <button 
              onClick={() => {
                setView('client');
                setIsOrdersOpen(!isOrdersOpen);
              }}
              className="w-10 h-10 rounded-full bg-white border border-orange-100 flex items-center justify-center text-orange-600 hover:bg-orange-50 transition-colors shadow-sm relative"
            >
              <i className={`fas ${isOrdersOpen && view === 'client' ? 'fa-times' : 'fa-user-circle'} text-xl`}></i>
              {(orders.length > 0 || cart.length > 0) && !isOrdersOpen && (
                <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white font-bold">
                  {cart.length > 0 ? cart.length : orders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {view === 'admin' ? (
        <div className="pt-32 pb-24 px-6">
          <AdminView 
            orders={orders} 
            onUpdateStatus={updateOrderStatus} 
            onClose={() => setView('client')}
          />
        </div>
      ) : (
        <>
          <section className="pt-32 pb-20 px-6 text-center">
            <div className="max-w-3xl mx-auto">
              <div className="inline-block px-4 py-1.5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold uppercase tracking-widest mb-6">
                Place Order Now
              </div>
              <h2 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight">
                Order with Your <span className="text-orange-600">Voice</span> <br />
                Eat with <span className="text-orange-600">Joy.</span>
              </h2>
              <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto mb-10 leading-relaxed font-medium">
                Explore our curated menu manually or simply talk to our voice agent to handle everything for you.
              </p>
              
              <div className="flex justify-center">
                <button 
                  onClick={openAgent}
                  className="orange-gradient text-white px-12 py-5 rounded-xl text-base font-bold shadow-xl shadow-orange-200 flex items-center hover:scale-[1.02] transition-transform active:scale-95 group"
                >
                  <div className="relative">
                    <i className="fas fa-microphone mr-4 text-xl group-hover:animate-pulse"></i>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping opacity-75"></div>
                  </div>
                  Talk to Voice Agent
                  <i className="fas fa-arrow-right ml-3 text-sm opacity-80 group-hover:translate-x-1 transition-transform"></i>
                </button>
              </div>

              <div className="mt-12">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">OR BROWSE MENU</p>
                <div className="flex justify-center space-x-4">
                  <div className="w-1 h-1 bg-orange-300 rounded-full"></div>
                  <div className="w-1 h-1 bg-orange-300 rounded-full"></div>
                  <div className="w-1 h-1 bg-orange-300 rounded-full"></div>
                  <div className="w-1 h-1 bg-orange-300 rounded-full"></div>
                </div>
              </div>
            </div>
          </section>

          <main className="max-w-7xl mx-auto px-6 pb-24">
            {isOrdersOpen ? (
              <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center space-x-4 mb-10">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                     <i className="fas fa-receipt text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900">Your Orders</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Checkout & Live Tracking</p>
                  </div>
                </div>
                <OrdersView 
                  orders={orders} 
                  cart={cart} 
                  onConfirm={handleConfirmManualOrder}
                  onRemoveFromCart={removeFromCart}
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg orange-gradient flex items-center justify-center text-white">
                      <i className="fas fa-th-list"></i>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Full Menu</h3>
                  </div>
                  <div className="hidden md:block h-[1px] flex-1 mx-8 bg-orange-100"></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {MENU_ITEMS.length} Delicacies
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {MENU_ITEMS.map(item => (
                    <MenuCard key={item.id} item={item} onClick={setSelectedItem} />
                  ))}
                </div>
              </div>
            )}
          </main>
        </>
      )}

      <ChatInterface 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        onOrderPlaced={handleAIAgentOrder}
      />

      <ItemModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onAdd={handleAddToCart}
      />

      <footer className="py-12 border-t border-orange-50 bg-white/50 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center">
            <div className="w-12 h-1 bg-orange-200 rounded-full mb-8"></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
              Abdul Ahad's Kitchen &copy; 2024
            </p>
            <div className="flex space-x-8 text-gray-400">
              <a href="#" className="hover:text-orange-600 transition-colors"><i className="fab fa-instagram"></i></a>
              <a href="#" className="hover:text-orange-600 transition-colors"><i className="fab fa-facebook"></i></a>
            </div>
            <button 
              onClick={() => setView('admin')} 
              className="mt-8 text-[9px] font-black uppercase tracking-widest text-gray-200 hover:text-orange-200 transition-colors"
            >
              Staff Portal
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;