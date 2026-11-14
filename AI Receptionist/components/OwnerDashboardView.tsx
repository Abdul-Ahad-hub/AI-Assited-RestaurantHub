import React, { useState, useEffect } from 'react';
import { MenuDraftItem, MenuItem, Order, Restaurant, UserProfile } from '../types';
import { OrderStatusStepper } from './OrderStatusStepper';
import { apiFetch } from '../services/apiClient';

interface OwnerDashboardViewProps {
  user: UserProfile;
  ownedRestaurants: any[];
  onRefreshAuth: () => Promise<void>;
}

export const OwnerDashboardView: React.FC<OwnerDashboardViewProps> = ({
  user,
  ownedRestaurants,
  onRefreshAuth
}) => {
  const [selectedRestId, setSelectedRestId] = useState<string>(
    ownedRestaurants[0]?.id || 'rest_abdul_ahad'
  );
  const [activeSection, setActiveSection] = useState<
    'overview' | 'orders' | 'menu' | 'ai-menu' | 'ai-assistant' | 'bidding' | 'profile' | 'new-restaurant'
  >('overview');

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusBanner, setStatusBanner] = useState('');

  // Menu Management state
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [itemForm, setItemForm] = useState({
    categoryId: '',
    name: '',
    description: '',
    price: '',
    discountedPrice: '',
    imageUrl: '',
    isPopular: false
  });

  // AI Menu Architect state
  const [aiMenuPrompt, setAiMenuPrompt] = useState(
    'Add a biryani section. Chicken biryani costs 14.50, beef biryani costs 16.50, and special royal biryani costs 19.99.'
  );
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [isDraftingMenu, setIsDraftingMenu] = useState(false);
  const [draftSummary, setDraftSummary] = useState('');
  const [menuDraftItems, setMenuDraftItems] = useState<MenuDraftItem[]>([]);
  const [isPublishingDraft, setIsPublishingDraft] = useState(false);

  // Restaurant AI Assistant state
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<{ role: 'owner' | 'ai'; text: string }[]>([]);
  const [isAskingAssistant, setIsAskingAssistant] = useState(false);

  // Bidding state
  const [bidAmount, setBidAmount] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [isPlacingBid, setIsPlacingBid] = useState(false);

  // Profile & Offers & Reply state
  const [profileForm, setProfileForm] = useState<any>({});
  const [offerForm, setOfferForm] = useState({
    title: '',
    code: '',
    discountType: 'percentage',
    discountValue: '15',
    minOrderAmount: '20'
  });
  const [branchForm, setBranchForm] = useState({ name: '', city: 'Karachi', area: '', address: '', phone: '' });
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  // New Restaurant Onboarding state
  const [newRestForm, setNewRestForm] = useState({
    name: '',
    cuisine: 'Pakistani & Mughal',
    priceRange: '$$',
    city: 'Karachi',
    area: '',
    address: '',
    phone: user.phone || '',
    description: ''
  });

  const loadDashboard = async (restId = selectedRestId) => {
    if (!restId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await apiFetch(`/api/owner/restaurants/${restId}/dashboard`);
      setDashboardData(data);
      setProfileForm(data.restaurant || {});
      if (data.categories && data.categories.length > 0 && !itemForm.categoryId) {
        setItemForm(prev => ({ ...prev, categoryId: data.categories[0].id }));
      }
      if (data.biddingStatus?.minNextEligibleBid) {
        setBidAmount(String(data.biddingStatus.minNextEligibleBid));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load restaurant dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ownedRestaurants.length > 0 && !ownedRestaurants.some(r => r.id === selectedRestId)) {
      setSelectedRestId(ownedRestaurants[0].id);
    }
  }, [ownedRestaurants]);

  useEffect(() => {
    if (selectedRestId) {
      loadDashboard(selectedRestId);
    }
  }, [selectedRestId]);

  const showToast = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(''), 4000);
  };

  const handleOrderStatusChange = async (orderId: string, newStatus: Order['status']) => {
    try {
      await apiFetch(`/api/owner/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      showToast(`Order status updated to ${newStatus}`);
      await loadDashboard();
    } catch (err: any) {
      alert(err?.message || 'Failed to update order status');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await apiFetch(`/api/owner/restaurants/${selectedRestId}/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: newCatName, description: newCatDesc })
      });
      setNewCatName('');
      setNewCatDesc('');
      showToast('Menu category created!');
      await loadDashboard();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/owner/restaurants/${selectedRestId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          categoryId: itemForm.categoryId || dashboardData?.categories?.[0]?.id,
          name: itemForm.name,
          description: itemForm.description,
          price: Number(itemForm.price),
          discountedPrice: itemForm.discountedPrice ? Number(itemForm.discountedPrice) : null,
          imageUrl: itemForm.imageUrl,
          isPopular: itemForm.isPopular
        })
      });
      setItemForm(prev => ({ ...prev, name: '', description: '', price: '', discountedPrice: '', imageUrl: '' }));
      showToast('Menu item added to live menu!');
      await loadDashboard();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    try {
      await apiFetch(`/api/owner/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_available: !item.is_available })
      });
      await loadDashboard();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Delete this food item from your menu?')) return;
    try {
      await apiFetch(`/api/owner/items/${itemId}`, { method: 'DELETE' });
      showToast('Menu item deleted.');
      await loadDashboard();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  // Voice Dictation for AI Menu Architect
  const toggleVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Browser speech recognition is not supported on this device. Please type your menu instructions below.');
      return;
    }
    if (isListeningSpeech) {
      setIsListeningSpeech(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    setIsListeningSpeech(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setAiMenuPrompt(prev => (prev ? `${prev} ${transcript}` : transcript));
      }
      setIsListeningSpeech(false);
    };
    recognition.onerror = () => setIsListeningSpeech(false);
    recognition.onend = () => setIsListeningSpeech(false);
    recognition.start();
  };

  const handleGenerateAiMenuDraft = async () => {
    if (!aiMenuPrompt.trim() || isDraftingMenu) return;
    setIsDraftingMenu(true);
    try {
      const res = await apiFetch(`/api/owner/restaurants/${selectedRestId}/ai-menu-draft`, {
        method: 'POST',
        body: JSON.stringify({ prompt: aiMenuPrompt })
      });
      setDraftSummary(res.summary);
      setMenuDraftItems(res.items || []);
    } catch (err: any) {
      alert(err?.message || 'Failed to generate menu draft');
    } finally {
      setIsDraftingMenu(false);
    }
  };

  const handlePublishAiDraft = async () => {
    if (menuDraftItems.length === 0 || isPublishingDraft) return;
    setIsPublishingDraft(true);
    try {
      const res = await apiFetch(`/api/owner/restaurants/${selectedRestId}/ai-menu-publish`, {
        method: 'POST',
        body: JSON.stringify({ items: menuDraftItems })
      });
      setMenuDraftItems([]);
      setDraftSummary('');
      showToast(`Published ${res.createdCount} confirmed items to your live menu!`);
      await loadDashboard();
      setActiveSection('menu');
    } catch (err: any) {
      alert(err?.message || 'Failed to publish menu draft');
    } finally {
      setIsPublishingDraft(false);
    }
  };

  const handleAskOwnerAssistant = async (customQ?: string) => {
    const q = (customQ ?? assistantPrompt).trim();
    if (!q || isAskingAssistant) return;
    setAssistantPrompt('');
    setAssistantMessages(prev => [...prev, { role: 'owner', text: q }]);
    setIsAskingAssistant(true);
    try {
      const res = await apiFetch(`/api/owner/restaurants/${selectedRestId}/ai-assistant`, {
        method: 'POST',
        body: JSON.stringify({ prompt: q })
      });
      setAssistantMessages(prev => [...prev, { role: 'ai', text: res.reply }]);
    } catch (err: any) {
      setAssistantMessages(prev => [...prev, { role: 'ai', text: err?.message || 'Assistant error' }]);
    } finally {
      setIsAskingAssistant(false);
    }
  };

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlacingBid) return;
    setIsPlacingBid(true);
    try {
      const res = await apiFetch(`/api/owner/restaurants/${selectedRestId}/bids`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(bidAmount), notes: bidNotes })
      });
      setBidNotes('');
      showToast(`Bid of $${Number(res.amount).toFixed(2)} confirmed! You now hold Rank #1.`);
      await loadDashboard();
    } catch (err: any) {
      alert(err?.message || 'Bid rejected');
    } finally {
      setIsPlacingBid(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/owner/restaurants/${selectedRestId}`, {
        method: 'PUT',
        body: JSON.stringify(profileForm)
      });
      showToast('Restaurant profile saved!');
      await loadDashboard();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/owner/restaurants/${selectedRestId}/offers`, {
        method: 'POST',
        body: JSON.stringify({
          title: offerForm.title,
          code: offerForm.code,
          discountType: offerForm.discountType,
          discountValue: Number(offerForm.discountValue),
          minOrderAmount: Number(offerForm.minOrderAmount)
        })
      });
      setOfferForm({ title: '', code: '', discountType: 'percentage', discountValue: '15', minOrderAmount: '20' });
      showToast('Promotional offer published!');
      await loadDashboard();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/owner/restaurants/${selectedRestId}/branches`, {
        method: 'POST',
        body: JSON.stringify(branchForm)
      });
      setBranchForm({ name: '', city: 'Karachi', area: '', address: '', phone: '' });
      showToast('New branch added!');
      await loadDashboard();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleReplyReview = async (reviewId: string) => {
    const reply = (replyTexts[reviewId] || '').trim();
    if (!reply) return;
    try {
      await apiFetch(`/api/owner/reviews/${reviewId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply })
      });
      showToast('Reply posted to customer review!');
      await loadDashboard();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleOnboardRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/owner/restaurants', {
        method: 'POST',
        body: JSON.stringify(newRestForm)
      });
      await onRefreshAuth();
      setSelectedRestId(res.restaurantId);
      setActiveSection('overview');
      showToast('New restaurant registered and submitted for platform verification!');
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const restaurant: Restaurant | null = dashboardData?.restaurant || null;
  const metrics = dashboardData?.metrics || {};
  const bidding = dashboardData?.biddingStatus;

  const navItems = [
    { id: 'overview', label: 'Analytics & Overview', icon: 'fa-chart-pie' },
    { id: 'orders', label: `Live Orders (${metrics.activeOrdersCount || 0})`, icon: 'fa-concierge-bell' },
    { id: 'menu', label: 'Menu Management', icon: 'fa-utensils' },
    { id: 'ai-menu', label: 'AI Menu Architect', icon: 'fa-magic' },
    { id: 'ai-assistant', label: 'Business AI Co-Pilot', icon: 'fa-robot' },
    { id: 'bidding', label: 'Paid Ranking & Bidding', icon: 'fa-trophy' },
    { id: 'profile', label: 'Profile, Branches & Offers', icon: 'fa-store' },
    { id: 'new-restaurant', label: '+ Onboard Restaurant', icon: 'fa-plus-circle' }
  ] as const;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {statusBanner && (
        <div className="mb-6 bg-[#E8F7F0] border border-[#00A86B] text-[#087A50] px-4 py-3 rounded-xl text-xs font-extrabold flex items-center justify-between">
          <span>
            <i className="fas fa-check-circle mr-2"></i> {statusBanner}
          </span>
          <button onClick={() => setStatusBanner('')}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Top Restaurant Switcher Bar */}
      <div className="bg-white rounded-2xl p-5 border border-[#E4EBE6] mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#00A86B] text-white flex items-center justify-center text-lg shadow-xs">
            <i className="fas fa-store"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#17231E]">
                {restaurant?.name || 'Restaurant Partner Portal'}
              </h1>
              {restaurant && (
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md ${
                    restaurant.approval_status === 'approved'
                      ? 'bg-[#E8F7F0] text-[#087A50]'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {restaurant.approval_status} • {restaurant.verification_status}
                </span>
              )}
            </div>
            <p className="text-xs text-[#68736D]">
              Logged in as {user.name} ({user.role === 'admin' ? 'Platform Admin Override' : 'Restaurant Owner'})
            </p>
          </div>
        </div>

        {ownedRestaurants.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#68736D]">Switch Restaurant:</span>
            <select
              value={selectedRestId}
              onChange={e => setSelectedRestId(e.target.value)}
              className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2 text-xs font-extrabold text-[#17231E] outline-none focus:border-[#00A86B]"
            >
              {ownedRestaurants.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.city})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 space-y-1.5">
          <div className="bg-white rounded-2xl p-3 border border-[#E4EBE6] space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all text-left ${
                  activeSection === item.id
                    ? 'bg-[#00A86B] text-white shadow-xs'
                    : 'text-[#68736D] hover:bg-[#F5F8F6] hover:text-[#17231E]'
                }`}
              >
                <i className={`fas ${item.icon} w-4 text-center`}></i>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="lg:col-span-9">
          {loading ? (
            <div className="bg-white rounded-2xl p-12 border border-[#E4EBE6] text-center">
              <i className="fas fa-circle-notch fa-spin text-2xl text-[#00A86B] mb-2"></i>
              <p className="text-xs font-bold text-[#68736D]">Loading real-time restaurant data...</p>
            </div>
          ) : errorMsg ? (
            <div className="bg-white rounded-2xl p-8 border border-[#E4EBE6] text-center text-[#D92D20] font-bold">
              {errorMsg}
            </div>
          ) : (
            <>
              {/* 1. OVERVIEW & ANALYTICS */}
              {activeSection === 'overview' && (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-[#E4EBE6]">
                      <p className="text-[11px] font-bold uppercase text-[#68736D]">Tracked Revenue</p>
                      <p className="text-2xl font-extrabold text-[#00A86B] mt-1">
                        ${Number(metrics.totalRevenue || 0).toFixed(2)}
                      </p>
                      <p className="text-[11px] text-[#68736D] mt-1">{metrics.totalOrders || 0} completed/active orders</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-[#E4EBE6]">
                      <p className="text-[11px] font-bold uppercase text-[#68736D]">Profile & Menu Views</p>
                      <p className="text-2xl font-extrabold text-[#17231E] mt-1">
                        {metrics.profileViews || 0} / {metrics.menuViews || 0}
                      </p>
                      <p className="text-[11px] text-[#68736D] mt-1">
                        {metrics.searchAppearances || 0} search appearances
                      </p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-[#E4EBE6]">
                      <p className="text-[11px] font-bold uppercase text-[#68736D]">Customer Rating</p>
                      <p className="text-2xl font-extrabold text-[#17231E] mt-1">
                        ★ {Number(metrics.ratingAvg || 0).toFixed(1)}
                      </p>
                      <p className="text-[11px] text-[#68736D] mt-1">{metrics.reviewCount || 0} verified reviews</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-[#E4EBE6]">
                      <p className="text-[11px] font-bold uppercase text-[#68736D]">Sponsored Rank</p>
                      <p className="text-2xl font-extrabold text-[#087A50] mt-1">
                        {bidding?.myCurrentRank ? `Rank #${bidding.myCurrentRank}` : 'Unranked'}
                      </p>
                      <p className="text-[11px] text-[#68736D] mt-1">
                        {bidding?.myHighestBid ? `Your bid: $${bidding.myHighestBid.toFixed(2)}` : 'No active bid'}
                      </p>
                    </div>
                  </div>

                  {/* Top Popular Food Items & Recent Reviews */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6]">
                      <h3 className="text-sm font-extrabold text-[#17231E] mb-4 flex items-center justify-between">
                        <span>Top Performing Menu Items</span>
                        <button
                          onClick={() => setActiveSection('menu')}
                          className="text-xs text-[#00A86B] hover:underline"
                        >
                          Manage Menu →
                        </button>
                      </h3>
                      <div className="space-y-3">
                        {(dashboardData?.menuItems || []).slice(0, 5).map((item: MenuItem) => (
                          <div key={item.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[#F5F8F6]">
                            <div>
                              <p className="font-extrabold text-[#17231E]">{item.name}</p>
                              <p className="text-[#68736D]">${Number(item.price).toFixed(2)}</p>
                            </div>
                            <span className="bg-[#E8F7F0] text-[#087A50] font-extrabold px-2.5 py-1 rounded-lg">
                              {item.order_count || 0} orders
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6]">
                      <h3 className="text-sm font-extrabold text-[#17231E] mb-4">Recent Customer Reviews</h3>
                      <div className="space-y-3">
                        {(dashboardData?.reviews || []).slice(0, 4).map((rev: any) => (
                          <div key={rev.id} className="p-3 rounded-xl bg-[#F5F8F6] border border-[#E4EBE6] text-xs space-y-2">
                            <div className="flex justify-between">
                              <span className="font-extrabold text-[#17231E]">{rev.customer_name}</span>
                              <span className="text-[#00A86B] font-extrabold">{rev.rating}★</span>
                            </div>
                            <p className="text-[#68736D]">{rev.comment}</p>
                            {rev.owner_reply ? (
                              <p className="text-[11px] text-[#087A50] font-bold">
                                Replied: "{rev.owner_reply}"
                              </p>
                            ) : (
                              <div className="flex gap-2 pt-1">
                                <input
                                  type="text"
                                  value={replyTexts[rev.id] || ''}
                                  onChange={e => setReplyTexts(prev => ({ ...prev, [rev.id]: e.target.value }))}
                                  placeholder="Write owner response..."
                                  className="flex-1 bg-white border border-[#E4EBE6] rounded-lg px-2.5 py-1 text-xs"
                                />
                                <button
                                  onClick={() => handleReplyReview(rev.id)}
                                  className="rh-btn-primary px-3 py-1 rounded-lg text-[11px] font-bold"
                                >
                                  Reply
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. LIVE KITCHEN ORDERS */}
              {activeSection === 'orders' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6]">
                    <h2 className="text-lg font-extrabold text-[#17231E] mb-1">Live Kitchen Order Queue</h2>
                    <p className="text-xs text-[#68736D] mb-6">
                      Click any step on the status bar to update the customer's live order tracker in real time.
                    </p>

                    {(dashboardData?.orders || []).length === 0 ? (
                      <div className="p-12 text-center bg-[#F5F8F6] rounded-xl text-xs font-bold text-[#68736D]">
                        No orders received yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(dashboardData?.orders || []).map((ord: Order) => (
                          <div key={ord.id} className="p-5 rounded-2xl border border-[#E4EBE6] space-y-4">
                            <div className="flex flex-wrap justify-between items-start gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="bg-[#E8F7F0] text-[#087A50] text-xs font-extrabold px-2.5 py-1 rounded-md">
                                    {ord.order_number || ord.id}
                                  </span>
                                  <span className="text-sm font-extrabold text-[#17231E]">
                                    {ord.customer_name}
                                  </span>
                                  {ord.source === 'voice_ai' && (
                                    <span className="bg-[#17231E] text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                                      Voice AI Order
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#68736D] mt-1">
                                  {ord.delivery_address} • {ord.customer_phone}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-extrabold text-[#00A86B]">
                                  ${Number(ord.total).toFixed(2)}
                                </p>
                                <p className="text-[11px] text-[#68736D] uppercase font-bold">
                                  {ord.order_type} • {ord.status}
                                </p>
                              </div>
                            </div>

                            <div className="bg-[#F5F8F6] p-3.5 rounded-xl border border-[#E4EBE6] text-xs space-y-1">
                              {ord.items.map((it, idx) => (
                                <div key={idx} className="flex justify-between font-semibold">
                                  <span>
                                    {it.quantity}x {it.name}
                                  </span>
                                  <span>${Number(it.lineTotal || it.price * it.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>

                            <div className="px-4 pb-4">
                              <OrderStatusStepper
                                currentStatus={ord.status}
                                isAdmin={true}
                                onStatusChange={st => handleOrderStatusChange(ord.id, st)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. MENU MANAGEMENT */}
              {activeSection === 'menu' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Add Category */}
                    <form
                      onSubmit={handleCreateCategory}
                      className="bg-white rounded-2xl p-5 border border-[#E4EBE6] space-y-3 h-fit"
                    >
                      <h3 className="text-sm font-extrabold text-[#17231E]">Add Menu Category</h3>
                      <input
                        type="text"
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        placeholder="Category Name (e.g. Charcoal BBQ)"
                        className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs"
                        required
                      />
                      <input
                        type="text"
                        value={newCatDesc}
                        onChange={e => setNewCatDesc(e.target.value)}
                        placeholder="Short description..."
                        className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs"
                      />
                      <button type="submit" className="w-full rh-btn-primary py-2.5 rounded-xl text-xs font-extrabold">
                        + Create Category
                      </button>
                    </form>

                    {/* Add Food Item */}
                    <form
                      onSubmit={handleCreateMenuItem}
                      className="md:col-span-2 bg-white rounded-2xl p-5 border border-[#E4EBE6] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-[#17231E]">Add Dish to Menu</h3>
                        <button
                          type="button"
                          onClick={() => setActiveSection('ai-menu')}
                          className="text-xs font-extrabold text-[#00A86B] hover:underline flex items-center gap-1"
                        >
                          <i className="fas fa-wand-magic-sparkles"></i> Or use AI Menu Architect →
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <select
                          value={itemForm.categoryId}
                          onChange={e => setItemForm(prev => ({ ...prev, categoryId: e.target.value }))}
                          className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs font-bold"
                        >
                          {(dashboardData?.categories || []).map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={itemForm.name}
                          onChange={e => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Dish Name *"
                          className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs"
                          required
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={itemForm.price}
                          onChange={e => setItemForm(prev => ({ ...prev, price: e.target.value }))}
                          placeholder="Price (USD) *"
                          className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs"
                          required
                        />
                        <input
                          type="url"
                          value={itemForm.imageUrl}
                          onChange={e => setItemForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                          placeholder="Food Photo URL (optional)"
                          className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs"
                        />
                        <input
                          type="text"
                          value={itemForm.description}
                          onChange={e => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Appetizing description..."
                          className="sm:col-span-2 bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs"
                        />
                      </div>
                      <button type="submit" className="rh-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold">
                        + Add Dish to Menu
                      </button>
                    </form>
                  </div>

                  {/* Current Menu Items Table */}
                  <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6]">
                    <h3 className="text-sm font-extrabold text-[#17231E] mb-4">
                      Published Menu Items ({(dashboardData?.menuItems || []).length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#E4EBE6] text-[#68736D] uppercase text-[10px]">
                            <th className="py-2.5 px-3">Dish</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3">Price</th>
                            <th className="py-2.5 px-3">Orders</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4EBE6]">
                          {(dashboardData?.menuItems || []).map((item: MenuItem) => (
                            <tr key={item.id}>
                              <td className="py-3 px-3 font-extrabold text-[#17231E]">
                                {item.name}
                                <p className="text-[11px] font-normal text-[#68736D] line-clamp-1">
                                  {item.description}
                                </p>
                              </td>
                              <td className="py-3 px-3 font-semibold text-[#68736D]">{item.category_name}</td>
                              <td className="py-3 px-3 font-extrabold text-[#00A86B]">
                                ${Number(item.price).toFixed(2)}
                              </td>
                              <td className="py-3 px-3 font-bold">{item.order_count || 0}</td>
                              <td className="py-3 px-3">
                                <button
                                  onClick={() => handleToggleItemAvailability(item)}
                                  className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold ${
                                    item.is_available
                                      ? 'bg-[#E8F7F0] text-[#087A50]'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {item.is_available ? 'Available' : 'Sold Out'}
                                </button>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="text-[#D92D20] hover:underline font-bold"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. AI MENU ARCHITECT (VOICE & TEXT MENU CREATION WITH DRAFT REVIEW) */}
              {activeSection === 'ai-menu' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="bg-[#E8F7F0] text-[#087A50] text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md">
                          Differentiating Feature • Voice & Text AI
                        </span>
                        <h2 className="text-xl font-extrabold text-[#17231E] mt-2">
                          AI Menu Architect — Speak or Type Your Menu
                        </h2>
                        <p className="text-xs text-[#68736D] mt-1">
                          Say or paste natural language instructions. The AI extracts categories, item names, prices, descriptions, and variations into a structured draft. Nothing is published until you review and confirm.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={toggleVoiceDictation}
                        className={`px-4 py-3 rounded-xl text-xs font-extrabold flex items-center gap-2 shrink-0 ${
                          isListeningSpeech
                            ? 'bg-[#D92D20] text-white animate-pulse'
                            : 'bg-[#E8F7F0] text-[#087A50] hover:bg-[#00A86B] hover:text-white'
                        }`}
                      >
                        <i className="fas fa-microphone"></i>
                        {isListeningSpeech ? 'Listening... Speak Now' : 'Dictate via Voice'}
                      </button>
                    </div>

                    <textarea
                      value={aiMenuPrompt}
                      onChange={e => setAiMenuPrompt(e.target.value)}
                      placeholder="Example: Add a biryani section. Chicken biryani costs 450, beef biryani costs 550, and special biryani costs 700."
                      className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl p-4 text-sm font-medium h-28 focus:border-[#00A86B] outline-none"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setAiMenuPrompt(
                              'Add a biryani section. Chicken biryani costs 450, beef biryani costs 550, and special biryani costs 700.'
                            )
                          }
                          className="text-[11px] font-bold bg-[#F5F8F6] hover:bg-[#E8F7F0] text-[#17231E] px-3 py-1.5 rounded-lg border border-[#E4EBE6]"
                        >
                          Sample: Biryani Section (450 / 550 / 700)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAiMenuPrompt(
                              'Add a Wood-Fired Grill section. Smoky Chicken Tikka costs 11.50, Malai Boti Platter costs 14.00, and Turkish Adana Kebab costs 16.50.'
                            )
                          }
                          className="text-[11px] font-bold bg-[#F5F8F6] hover:bg-[#E8F7F0] text-[#17231E] px-3 py-1.5 rounded-lg border border-[#E4EBE6]"
                        >
                          Sample: Charcoal Grill Section
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateAiMenuDraft}
                        disabled={isDraftingMenu || !aiMenuPrompt.trim()}
                        className="rh-btn-primary px-6 py-3 rounded-xl text-xs font-extrabold shadow-sm"
                      >
                        {isDraftingMenu ? (
                          <>
                            <i className="fas fa-circle-notch fa-spin mr-2"></i> Extracting Structured Menu Draft...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-wand-magic-sparkles mr-2"></i> Generate Structured Menu Draft
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Structured Menu Draft Review Interface */}
                  {menuDraftItems.length > 0 && (
                    <div className="bg-white rounded-2xl p-6 border-2 border-[#00A86B] space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <span className="bg-[#00A86B] text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md">
                            Step 2: Review & Edit Before Saving
                          </span>
                          <h3 className="text-base font-extrabold text-[#17231E] mt-1.5">{draftSummary}</h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMenuDraftItems([])}
                            className="px-4 py-2.5 rounded-xl border border-[#E4EBE6] text-xs font-bold text-[#68736D]"
                          >
                            Discard Draft
                          </button>
                          <button
                            type="button"
                            onClick={handlePublishAiDraft}
                            disabled={isPublishingDraft}
                            className="rh-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md"
                          >
                            {isPublishingDraft
                              ? 'Publishing...'
                              : `Confirm & Publish ${menuDraftItems.length} Items to Menu`}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {menuDraftItems.map((item, idx) => (
                          <div
                            key={item.tempId}
                            className="p-4 rounded-xl bg-[#F5F8F6] border border-[#E4EBE6] grid grid-cols-1 md:grid-cols-12 gap-3 items-start"
                          >
                            <div className="md:col-span-3">
                              <label className="text-[10px] font-bold uppercase text-[#68736D] block mb-1">
                                Category
                              </label>
                              <input
                                type="text"
                                value={item.categoryName}
                                onChange={e => {
                                  const val = e.target.value;
                                  setMenuDraftItems(prev =>
                                    prev.map((it, i) => (i === idx ? { ...it, categoryName: val } : it))
                                  );
                                }}
                                className="w-full bg-white border border-[#E4EBE6] rounded-lg px-3 py-2 text-xs font-bold"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <label className="text-[10px] font-bold uppercase text-[#68736D] block mb-1">
                                Item Name
                              </label>
                              <input
                                type="text"
                                value={item.name}
                                onChange={e => {
                                  const val = e.target.value;
                                  setMenuDraftItems(prev =>
                                    prev.map((it, i) => (i === idx ? { ...it, name: val } : it))
                                  );
                                }}
                                className="w-full bg-white border border-[#E4EBE6] rounded-lg px-3 py-2 text-xs font-extrabold text-[#17231E]"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-[10px] font-bold uppercase text-[#68736D] block mb-1">
                                Price
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.price}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setMenuDraftItems(prev =>
                                    prev.map((it, i) => (i === idx ? { ...it, price: val } : it))
                                  );
                                }}
                                className="w-full bg-white border border-[#E4EBE6] rounded-lg px-3 py-2 text-xs font-extrabold text-[#00A86B]"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <label className="text-[10px] font-bold uppercase text-[#68736D] block mb-1">
                                Description
                              </label>
                              <input
                                type="text"
                                value={item.description}
                                onChange={e => {
                                  const val = e.target.value;
                                  setMenuDraftItems(prev =>
                                    prev.map((it, i) => (i === idx ? { ...it, description: val } : it))
                                  );
                                }}
                                className="w-full bg-white border border-[#E4EBE6] rounded-lg px-3 py-2 text-xs"
                              />
                            </div>
                            <div className="md:col-span-1 flex justify-end pt-5">
                              <button
                                type="button"
                                onClick={() => setMenuDraftItems(prev => prev.filter((_, i) => i !== idx))}
                                className="text-[#D92D20] hover:bg-red-50 p-2 rounded-lg"
                                title="Remove draft item"
                              >
                                <i className="fas fa-trash-alt text-xs"></i>
                              </button>
                            </div>

                            {item.missingDetails && item.missingDetails.length > 0 && (
                              <div className="md:col-span-12 flex flex-wrap gap-2 pt-1">
                                {item.missingDetails.map((warn, wIdx) => (
                                  <span
                                    key={wIdx}
                                    className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md"
                                  >
                                    <i className="fas fa-triangle-exclamation mr-1"></i> {warn}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. RESTAURANT AI OPERATIONS ASSISTANT */}
              {activeSection === 'ai-assistant' && (
                <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-5">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#17231E]">
                      Restaurant AI Business Co-Pilot
                    </h2>
                    <p className="text-xs text-[#68736D]">
                      Connected to {restaurant?.name}'s live database orders, reviews, and menu analytics.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      'Summarize customer feedback and reviews',
                      'Which dishes are our top sellers and how can we increase average order value?',
                      'Suggest 3 promotional campaign ideas for this weekend'
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => handleAskOwnerAssistant(q)}
                        className="text-xs font-bold bg-[#F5F8F6] hover:bg-[#E8F7F0] text-[#17231E] px-3.5 py-2 rounded-xl border border-[#E4EBE6]"
                      >
                        "{q}"
                      </button>
                    ))}
                  </div>

                  <div className="bg-[#F5F8F6] rounded-2xl p-4 border border-[#E4EBE6] min-h-[260px] max-h-[400px] overflow-y-auto space-y-3">
                    {assistantMessages.length === 0 ? (
                      <p className="text-xs text-[#68736D] text-center py-16">
                        Select a prompt above or ask any question about your menu, reviews, or performance.
                      </p>
                    ) : (
                      assistantMessages.map((m, idx) => (
                        <div
                          key={idx}
                          className={`flex ${m.role === 'owner' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] p-3.5 rounded-2xl text-xs whitespace-pre-line leading-relaxed ${
                              m.role === 'owner'
                                ? 'bg-[#00A86B] text-white font-bold'
                                : 'bg-white text-[#17231E] border border-[#E4EBE6]'
                            }`}
                          >
                            {m.text}
                          </div>
                        </div>
                      ))
                    )}
                    {isAskingAssistant && (
                      <p className="text-xs font-bold text-[#00A86B]">
                        <i className="fas fa-circle-notch fa-spin mr-2"></i> Analyzing live restaurant metrics...
                      </p>
                    )}
                  </div>

                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      handleAskOwnerAssistant();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={assistantPrompt}
                      onChange={e => setAssistantPrompt(e.target.value)}
                      placeholder="Ask your Restaurant AI Co-Pilot..."
                      className="flex-1 bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-4 py-3 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={isAskingAssistant || !assistantPrompt.trim()}
                      className="rh-btn-primary px-5 py-3 rounded-xl text-xs font-extrabold"
                    >
                      Ask AI
                    </button>
                  </form>
                </div>
              )}

              {/* 6. PAID RANKING & BIDDING ENGINE */}
              {activeSection === 'bidding' && (
                <div className="space-y-6">
                  <div className="rh-hero-gradient rounded-2xl p-6 text-white flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="bg-white/20 text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md">
                        Sponsored Discovery Auction
                      </span>
                      <h2 className="text-2xl font-extrabold mt-2">
                        {bidding?.campaign?.title || 'Homepage Sponsored Placement'}
                      </h2>
                      <p className="text-xs text-white/90 mt-1 max-w-xl">
                        Bids can start at just a few cents. Each new bid must beat the leading bid by a small step that grows as the amount grows. Organic ratings remain 100% independent.
                      </p>
                    </div>
                    <div className="bg-white text-[#17231E] px-5 py-4 rounded-2xl text-center shadow-lg">
                      <p className="text-[10px] font-extrabold uppercase text-[#68736D]">Your Current Standing</p>
                      <p className="text-2xl font-extrabold text-[#00A86B]">
                        {bidding?.myCurrentRank ? `Rank #${bidding.myCurrentRank}` : 'Not Ranked'}
                      </p>
                      <p className="text-[11px] font-bold text-[#17231E]">
                        {bidding?.isLeading ? 'Leading #1 Spot!' : `Leading Bid: $${Number(bidding?.currentLeadingBid || 0).toFixed(2)}`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Place Bid Form */}
                    <form
                      onSubmit={handlePlaceBid}
                      className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4"
                    >
                      <h3 className="text-base font-extrabold text-[#17231E]">Place a Qualifying Bid</h3>
                      <div className="grid grid-cols-2 gap-3 bg-[#F5F8F6] p-4 rounded-xl border border-[#E4EBE6] text-xs">
                        <div>
                          <span className="text-[#68736D] block">Current Leading Bid</span>
                          <span className="text-base font-extrabold text-[#17231E]">
                            ${Number(bidding?.currentLeadingBid || 0).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#68736D] block">Minimum Next Eligible Bid</span>
                          <span className="text-base font-extrabold text-[#00A86B]">
                            ${Number(bidding?.minNextEligibleBid || 0.1).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-[#17231E] block mb-1.5">
                          Your Bid Amount (USD), Min ${Number(bidding?.minNextEligibleBid || 0.1).toFixed(2)}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min={bidding?.minNextEligibleBid || 0.1}
                          value={bidAmount}
                          onChange={e => setBidAmount(e.target.value)}
                          className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-4 py-3 text-sm font-extrabold text-[#17231E]"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-[#17231E] block mb-1.5">
                          Campaign Note (Internal)
                        </label>
                        <input
                          type="text"
                          value={bidNotes}
                          onChange={e => setBidNotes(e.target.value)}
                          placeholder="e.g. Weekend Family Dinner Promotion"
                          className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-4 py-2.5 text-xs"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isPlacingBid}
                        className="w-full rh-btn-primary py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md"
                      >
                        {isPlacingBid ? 'Processing Atomic Bid...' : `Confirm & Place Bid ($${Number(bidAmount || 0).toFixed(2)})`}
                      </button>
                    </form>

                    {/* Own Bid History */}
                    <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4">
                      <h3 className="text-base font-extrabold text-[#17231E]">
                        Your Restaurant's Bid History
                      </h3>
                      <p className="text-xs text-[#68736D]">
                        For privacy and fair competition, only your own bid history is shown here.
                      </p>
                      <div className="space-y-2.5">
                        {(bidding?.myBidHistory || []).length === 0 ? (
                          <p className="text-xs text-[#68736D] py-8 text-center bg-[#F5F8F6] rounded-xl">
                            You have not placed any bids in this campaign yet.
                          </p>
                        ) : (
                          (bidding?.myBidHistory || []).map((b: any) => (
                            <div
                              key={b.id}
                              className="p-3.5 rounded-xl bg-[#F5F8F6] border border-[#E4EBE6] flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-extrabold text-[#17231E] text-sm">
                                  ${Number(b.amount).toFixed(2)}
                                </span>
                                <p className="text-[#68736D] text-[11px]">{b.notes || 'Sponsored Bid'}</p>
                                <p className="text-[10px] text-[#68736D]">
                                  {new Date(b.created_at).toLocaleString()}
                                </p>
                              </div>
                              <span
                                className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${
                                  b.status === 'leading'
                                    ? 'bg-[#E8F7F0] text-[#087A50]'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {b.status} • {b.payment_status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. PROFILE, BRANCHES & OFFERS */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleSaveProfile}
                    className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4"
                  >
                    <h3 className="text-base font-extrabold text-[#17231E]">Restaurant Profile Settings</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="font-bold block mb-1">Restaurant Name</label>
                        <input
                          type="text"
                          value={profileForm.name || ''}
                          onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                          className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5"
                        />
                      </div>
                      <div>
                        <label className="font-bold block mb-1">Primary Cuisine</label>
                        <input
                          type="text"
                          value={profileForm.cuisine || ''}
                          onChange={e => setProfileForm({ ...profileForm, cuisine: e.target.value })}
                          className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5"
                        />
                      </div>
                      <div>
                        <label className="font-bold block mb-1">City</label>
                        <input
                          type="text"
                          value={profileForm.city || ''}
                          onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                          className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5"
                        />
                      </div>
                      <div>
                        <label className="font-bold block mb-1">Phone</label>
                        <input
                          type="text"
                          value={profileForm.phone || ''}
                          onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                          className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="font-bold block mb-1">Address</label>
                        <input
                          type="text"
                          value={profileForm.address || ''}
                          onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                          className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="font-bold block mb-1">Description</label>
                        <textarea
                          value={profileForm.description || ''}
                          onChange={e => setProfileForm({ ...profileForm, description: e.target.value })}
                          className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl p-3.5 h-20"
                        />
                      </div>
                    </div>
                    <button type="submit" className="rh-btn-primary px-6 py-2.5 rounded-xl text-xs font-extrabold">
                      Save Profile Changes
                    </button>
                  </form>

                  {/* Offers & Branches */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <form
                      onSubmit={handleCreateOffer}
                      className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-3"
                    >
                      <h3 className="text-sm font-extrabold text-[#17231E]">Create Promotional Offer</h3>
                      <input
                        type="text"
                        value={offerForm.title}
                        onChange={e => setOfferForm({ ...offerForm, title: e.target.value })}
                        placeholder="Offer Title (e.g. 20% OFF Weekend Feast)"
                        className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs"
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={offerForm.code}
                          onChange={e => setOfferForm({ ...offerForm, code: e.target.value })}
                          placeholder="Code (e.g. FEAST20)"
                          className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs uppercase"
                          required
                        />
                        <input
                          type="number"
                          value={offerForm.discountValue}
                          onChange={e => setOfferForm({ ...offerForm, discountValue: e.target.value })}
                          placeholder="Discount %"
                          className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs"
                          required
                        />
                      </div>
                      <button type="submit" className="w-full rh-btn-primary py-2.5 rounded-xl text-xs font-extrabold">
                        + Publish Promo Offer
                      </button>
                    </form>

                    <form
                      onSubmit={handleCreateBranch}
                      className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-3"
                    >
                      <h3 className="text-sm font-extrabold text-[#17231E]">Add Restaurant Branch</h3>
                      <input
                        type="text"
                        value={branchForm.name}
                        onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                        placeholder="Branch Name (e.g. Clifton Branch)"
                        className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs"
                        required
                      />
                      <input
                        type="text"
                        value={branchForm.address}
                        onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                        placeholder="Full Branch Address"
                        className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs"
                        required
                      />
                      <button type="submit" className="w-full rh-btn-primary py-2.5 rounded-xl text-xs font-extrabold">
                        + Add Branch Location
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* 8. ONBOARD NEW RESTAURANT */}
              {activeSection === 'new-restaurant' && (
                <form
                  onSubmit={handleOnboardRestaurant}
                  className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4"
                >
                  <h2 className="text-lg font-extrabold text-[#17231E]">Onboard a New Restaurant</h2>
                  <p className="text-xs text-[#68736D]">
                    Register another restaurant concept or brand under your owner account.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <input
                      type="text"
                      value={newRestForm.name}
                      onChange={e => setNewRestForm({ ...newRestForm, name: e.target.value })}
                      placeholder="Restaurant Name *"
                      className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5"
                      required
                    />
                    <input
                      type="text"
                      value={newRestForm.cuisine}
                      onChange={e => setNewRestForm({ ...newRestForm, cuisine: e.target.value })}
                      placeholder="Primary Cuisine *"
                      className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5"
                      required
                    />
                    <select
                      value={newRestForm.city}
                      onChange={e => setNewRestForm({ ...newRestForm, city: e.target.value })}
                      className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 font-bold"
                    >
                      <option value="Karachi">Karachi</option>
                      <option value="Lahore">Lahore</option>
                      <option value="Islamabad">Islamabad</option>
                    </select>
                    <input
                      type="text"
                      value={newRestForm.area}
                      onChange={e => setNewRestForm({ ...newRestForm, area: e.target.value })}
                      placeholder="Neighborhood / Area *"
                      className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5"
                      required
                    />
                    <input
                      type="text"
                      value={newRestForm.address}
                      onChange={e => setNewRestForm({ ...newRestForm, address: e.target.value })}
                      placeholder="Complete Street Address *"
                      className="sm:col-span-2 bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5"
                      required
                    />
                    <textarea
                      value={newRestForm.description}
                      onChange={e => setNewRestForm({ ...newRestForm, description: e.target.value })}
                      placeholder="Tell customers about your food & story..."
                      className="sm:col-span-2 bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl p-3.5 h-24"
                    />
                  </div>
                  <button type="submit" className="rh-btn-primary px-6 py-3 rounded-xl text-xs font-extrabold">
                    Submit Restaurant for Verification
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
