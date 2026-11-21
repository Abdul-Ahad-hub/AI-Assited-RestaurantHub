import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MenuItem, Order, OrderItem, Restaurant, RestaurantOffer, UserProfile } from './types';
import { MenuCard } from './components/MenuCard';
import { RestaurantCard } from './components/RestaurantCard';
import { RankedRestaurantRow } from './components/RankedRestaurantRow';
import { ChatInterface, VoiceFormFillType } from './components/ChatInterface';
import { OrdersView } from './components/OrdersView';
import { ItemModal } from './components/ItemModal';
import { AdminView } from './components/AdminView';
import { RestaurantDetailView } from './components/RestaurantDetailView';
import { OwnerDashboardView } from './components/OwnerDashboardView';
import { AuthModal } from './components/AuthModal';
import { HeaderBar, NavTabId } from './components/HeaderBar';
import { HeroSection } from './components/HeroSection';
import { LiveOrderBanner } from './components/LiveOrderBanner';
import { LiveBiddingShowcase } from './components/LiveBiddingShowcase';
import { WhyRestaurantHubView } from './components/WhyRestaurantHubView';
import { SmartImage } from './components/SmartImage';
import { apiFetch, setAuthToken } from './services/apiClient';
import {
  DEFAULT_USER_LOCATION,
  UserLocationState,
  calculateDistanceKm,
  getCoordinatesForCity,
  requestUserGeolocation
} from './services/locationService';

const App: React.FC = () => {
  const [view, setView] = useState<NavTabId>('home');
  // Default to user location ('NearMe')
  const [selectedCity, setSelectedCity] = useState<string>('NearMe');
  const [userLocation, setUserLocation] = useState<UserLocationState>(DEFAULT_USER_LOCATION);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('rest_abdul_ahad');

  // Theme State (Orange + Dark Mode toggle)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rh_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('rh_dark_mode', String(darkMode));
    } catch {}
  }, [darkMode]);

  // Request user geolocation on initial mount
  useEffect(() => {
    requestUserGeolocation().then(coords => {
      setUserLocation(coords);
    });
  }, []);

  // Auth & User State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ownedRestaurants, setOwnedRestaurants] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Homepage & Live Orders Data
  const [homeData, setHomeData] = useState<{
    sponsoredRestaurants: Restaurant[];
    topRated: Restaurant[];
    nearby: Restaurant[];
    trendingRestaurants: Restaurant[];
    recentlyAdded: Restaurant[];
    trendingFood: MenuItem[];
    popularCuisines: { name: string; count: number; image: string }[];
    specialOffers: RestaurantOffer[];
    favouriteIds: string[];
    liveOrders?: Order[];
    biddingOverview?: any;
    neonStatus?: { configured: boolean; connected: boolean; provider: string };
  }>({
    sponsoredRestaurants: [],
    topRated: [],
    nearby: [],
    trendingRestaurants: [],
    recentlyAdded: [],
    trendingFood: [],
    popularCuisines: [],
    specialOffers: [],
    favouriteIds: [],
    liveOrders: []
  });
  const [loadingHome, setLoadingHome] = useState(true);

  // Unified Search & Ask AI State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCuisine, setSearchCuisine] = useState('All');
  const [searchPrice, setSearchPrice] = useState('All');
  const [searchMinRating, setSearchMinRating] = useState(0);
  const [searchService, setSearchService] = useState('');
  const [searchSortBy, setSearchSortBy] = useState('recommended');
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [topRatedList, setTopRatedList] = useState<Restaurant[]>([]);

  // Conversational AI Discovery Inline State
  const [aiDiscoveryResult, setAiDiscoveryResult] = useState<{
    answer: string;
    restaurants: any[];
    foods: any[];
  } | null>(null);
  const [loadingAiDiscovery, setLoadingAiDiscovery] = useState(false);

  // Food Discovery State
  const [foodQuery, setFoodQuery] = useState('');
  const [foodCuisine, setFoodCuisine] = useState('All');
  const [foodMaxPrice, setFoodMaxPrice] = useState(0);
  const [foodSortBy, setFoodSortBy] = useState('popular');
  const [discoveredFoods, setDiscoveredFoods] = useState<MenuItem[]>([]);
  const [loadingFoods, setLoadingFoods] = useState(false);

  // Customer Account Data
  const [customerDashboard, setCustomerDashboard] = useState<{
    orders: Order[];
    favourites: Restaurant[];
    reviews: any[];
    notifications: any[];
  }>({
    orders: [],
    favourites: [],
    reviews: [],
    notifications: []
  });
  const [accountTab, setAccountTab] = useState<'orders' | 'favourites' | 'reviews' | 'notifications' | 'profile'>('orders');
  const [profileEdit, setProfileEdit] = useState({ name: '', phone: '', city: 'Karachi', address: '' });
  const [profileSavedToast, setProfileSavedToast] = useState('');

  // Cart & Item Modal & AI Drawer
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedItemRestaurant, setSelectedItemRestaurant] = useState<{ id: string; name: string } | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [voiceContextRestaurant, setVoiceContextRestaurant] = useState<Restaurant | null>(null);
  const [voiceContextMenu, setVoiceContextMenu] = useState<MenuItem[]>([]);
  const [voiceFormType, setVoiceFormType] = useState<VoiceFormFillType>(null);
  const voiceFormCallbackRef = useRef<((fields: Record<string, string>) => void) | null>(null);

  const openVoiceFormFiller = useCallback(
    (formType: VoiceFormFillType, onFill: (fields: Record<string, string>) => void) => {
      voiceFormCallbackRef.current = onFill;
      setVoiceFormType(formType);
      setIsChatOpen(true);
    },
    []
  );

  // Compute effective API city filter ('NearMe' maps to detected userLocation.city or 'All')
  const apiCityFilter = useMemo(() => {
    if (selectedCity === 'NearMe') return 'All';
    return selectedCity;
  }, [selectedCity]);

  // Attach distanceKm from user's coordinates to any restaurant list
  const enrichWithDistance = useCallback(
    (restaurants: Restaurant[]): (Restaurant & { distanceKm?: number })[] => {
      return restaurants.map(r => {
        if (typeof r.latitude === 'number' && typeof r.longitude === 'number') {
          const dist = calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            r.latitude,
            r.longitude
          );
          return { ...r, distanceKm: dist };
        }
        return r;
      });
    },
    [userLocation]
  );

  // 1. Load Current User Session
  const DEMO_USER_IDS = new Set([
    'usr_admin_1',
    'usr_owner_abdul',
    'usr_owner_zaffran',
    'usr_owner_smash',
    'usr_customer_1',
    'usr_customer_2'
  ]);
  const [demoAiRemaining, setDemoAiRemaining] = useState<number | null>(null);
  const isDemoUser = Boolean(user && DEMO_USER_IDS.has(user.id));

  const loadAuthSession = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data.user || null);
      setOwnedRestaurants(data.ownedRestaurants || []);
      setUnreadNotifications(data.unreadNotifications || 0);
      if (data.demoAiUsage && typeof data.demoAiUsage.remaining === 'number') {
        setDemoAiRemaining(data.demoAiUsage.remaining);
      } else {
        setDemoAiRemaining(null);
      }
      if (data.user) {
        setProfileEdit({
          name: data.user.name || '',
          phone: data.user.phone || '',
          city: data.user.city || 'Karachi',
          address: data.user.address || ''
        });
      }
    } catch {
      setUser(null);
      setDemoAiRemaining(null);
    }
  }, []);

  // 2. Load Homepage Discovery Data & Live Orders
  const loadHomeData = useCallback(async () => {
    setLoadingHome(true);
    try {
      const data = await apiFetch(`/api/discovery/home?city=${encodeURIComponent(apiCityFilter)}`);
      setHomeData(data);
    } catch (err) {
      console.error('Failed to load home discovery:', err);
    } finally {
      setLoadingHome(false);
    }
  }, [apiCityFilter]);

  // Poll live orders every 6 seconds so status changes from Restaurant Kitchen immediately reflect on Customer status bar
  const refreshLiveOrders = useCallback(async () => {
    try {
      const data = await apiFetch('/api/orders/live');
      if (data?.orders) {
        setHomeData(prev => ({ ...prev, liveOrders: data.orders }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshLiveOrders, 6000);
    return () => clearInterval(interval);
  }, [refreshLiveOrders]);

  // 3. Load Restaurant Search Results
  const runRestaurantSearch = useCallback(async () => {
    setLoadingSearch(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        city: apiCityFilter,
        cuisine: searchCuisine,
        priceRange: searchPrice,
        minRating: String(searchMinRating),
        service: searchService,
        sortBy: searchSortBy
      });
      const data = await apiFetch(`/api/restaurants?${params.toString()}`);
      setSearchResults(data.restaurants || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoadingSearch(false);
    }
  }, [searchQuery, apiCityFilter, searchCuisine, searchPrice, searchMinRating, searchService, searchSortBy]);

  // 4. Load Independent Food Discovery
  const runFoodDiscovery = useCallback(async () => {
    setLoadingFoods(true);
    try {
      const params = new URLSearchParams({
        q: foodQuery,
        city: apiCityFilter,
        cuisine: foodCuisine,
        maxPrice: String(foodMaxPrice),
        sortBy: foodSortBy
      });
      const data = await apiFetch(`/api/foods?${params.toString()}`);
      setDiscoveredFoods(data.foods || []);
    } catch (err) {
      console.error('Food discovery error:', err);
    } finally {
      setLoadingFoods(false);
    }
  }, [foodQuery, apiCityFilter, foodCuisine, foodMaxPrice, foodSortBy]);

  // 5. Load Customer Account Dashboard
  const loadCustomerDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch('/api/customer/dashboard');
      setCustomerDashboard(data);
    } catch (err) {
      console.error('Customer dashboard error:', err);
    }
  }, [user]);

  useEffect(() => {
    loadAuthSession();
  }, [loadAuthSession]);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  useEffect(() => {
    if (view === 'top-rated') {
      apiFetch(`/api/restaurants?sortBy=rating&city=${encodeURIComponent(apiCityFilter)}`)
        .then(data => {
          const rated = ((data.restaurants || []) as Restaurant[]).filter(r => r.review_count > 0);
          setTopRatedList(rated);
        })
        .catch(() => setTopRatedList([]));
    }
  }, [view, apiCityFilter, user]);

  useEffect(() => {
    if (view === 'best-restaurants' || view === 'nearest-restaurants' || view === 'live-bidding') {
      runRestaurantSearch();
    } else if (view === 'trending-food') {
      runFoodDiscovery();
    } else if (view === 'account' && user) {
      loadCustomerDashboard();
    }
  }, [view, runRestaurantSearch, runFoodDiscovery, loadCustomerDashboard, user]);

  // Handle city / GPS selector change
  const handleSelectCity = async (cityVal: string) => {
    setSelectedCity(cityVal);
    if (cityVal === 'NearMe') {
      const coords = await requestUserGeolocation();
      setUserLocation(coords);
    } else if (cityVal !== 'All') {
      setUserLocation(getCoordinatesForCity(cityVal));
    }
  };

  // Handlers
  const handleOpenRestaurant = (restOrId: Restaurant | string) => {
    const id = typeof restOrId === 'string' ? restOrId : restOrId.id;
    setSelectedRestaurantId(id);
    setView('restaurant-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleFavourite = async (restaurantId: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      const res = await apiFetch('/api/customer/favourites/toggle', {
        method: 'POST',
        body: JSON.stringify({ restaurantId })
      });
      setHomeData(prev => ({
        ...prev,
        favouriteIds: res.isFavourite
          ? [...prev.favouriteIds, restaurantId]
          : prev.favouriteIds.filter(id => id !== restaurantId)
      }));
      if (view === 'account') {
        loadCustomerDashboard();
      }
    } catch {}
  };

  // Unified Search & Ask AI Bar Submit Handler
  const handleHeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setView('best-restaurants');
      runRestaurantSearch();
      return;
    }

    // Run both AI Discovery and Standard Search so the unified bar answers questions AND finds restaurants
    setLoadingAiDiscovery(true);
    try {
      const res = await apiFetch('/api/ai/discovery', {
        method: 'POST',
        body: JSON.stringify({ query: q, city: apiCityFilter })
      });
      setAiDiscoveryResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAiDiscovery(false);
    }
  };

  const handleSelectMenuItem = (item: MenuItem, restaurant?: Restaurant) => {
    setSelectedItem(item);
    setSelectedItemRestaurant({
      id: restaurant?.id || item.restaurant_id || 'rest_abdul_ahad',
      name: restaurant?.name || item.restaurant_name || "Abdul Ahad's Kitchen"
    });
  };

  const handleAddToCart = (qty: number, variationName?: string, addonNames?: string[]) => {
    if (!selectedItem) return;
    const targetRestId = selectedItemRestaurant?.id || selectedItem.restaurant_id || 'rest_abdul_ahad';
    const targetRestName = selectedItemRestaurant?.name || selectedItem.restaurant_name || "Abdul Ahad's Kitchen";

    const basePrice =
      selectedItem.discounted_price !== null && selectedItem.discounted_price !== undefined
        ? Number(selectedItem.discounted_price)
        : Number(selectedItem.price);
    const varDelta =
      selectedItem.variations?.find(v => v.name === variationName)?.priceDelta || 0;
    const addonsSum =
      selectedItem.addons
        ?.filter(a => addonNames?.includes(a.name))
        .reduce((s, a) => s + Number(a.price || 0), 0) || 0;

    const newItem: OrderItem = {
      foodItemId: selectedItem.id,
      restaurantId: targetRestId,
      restaurantName: targetRestName,
      name: selectedItem.name,
      quantity: qty,
      price: Math.round((basePrice + varDelta + addonsSum) * 100) / 100,
      variationName,
      addonNames
    };

    setCart(prev => {
      if (prev.length > 0 && prev[0].restaurantId && prev[0].restaurantId !== targetRestId) {
        const replace = window.confirm(
          `Your cart has items from ${prev[0].restaurantName}. Start a new cart with ${targetRestName}?`
        );
        if (!replace) return prev;
        return [newItem];
      }
      return [...prev, newItem];
    });
    setSelectedItem(null);
  };

  const handleUpdateCartQty = (index: number, delta: number) => {
    setCart(prev =>
      prev
        .map((it, idx) => (idx === index ? { ...it, quantity: it.quantity + delta } : it))
        .filter(it => it.quantity > 0)
    );
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirmManualOrder = async (params: {
    address: string;
    phone: string;
    orderType: 'delivery' | 'pickup' | 'dine_in';
    offerCode: string;
    notes: string;
  }) => {
    if (cart.length === 0) return;
    const restaurantId = cart[0].restaurantId || 'rest_abdul_ahad';
    try {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          restaurantId,
          items: cart,
          address: params.address,
          phone: params.phone,
          customerName: user?.name || 'Customer',
          orderType: params.orderType,
          offerCode: params.offerCode,
          notes: params.notes,
          source: 'web'
        })
      });
      setCart([]);
      setCustomerDashboard(prev => ({
        ...prev,
        orders: [res.order, ...prev.orders]
      }));
      await refreshLiveOrders();
      if (user) {
        await loadCustomerDashboard();
        await loadAuthSession();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to place order');
    }
  };

  const handleAIAgentOrder = async (
    items: OrderItem[],
    address: string,
    phone: string,
    restaurantId = 'rest_abdul_ahad'
  ) => {
    try {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          restaurantId,
          items,
          address,
          phone,
          customerName: user?.name || 'AI Customer',
          orderType: 'delivery',
          source: 'voice_ai'
        })
      });
      setCustomerDashboard(prev => ({
        ...prev,
        orders: [res.order, ...prev.orders]
      }));
      await refreshLiveOrders();
      setIsChatOpen(false);
      setView('account');
      setAccountTab('orders');
    } catch (err) {
      console.error('AI order creation error:', err);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = window.prompt('Reason for cancelling order:', 'Changed my mind');
    if (reason === null) return;
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await refreshLiveOrders();
      if (user) {
        await loadCustomerDashboard();
      } else {
        setCustomerDashboard(prev => ({
          ...prev,
          orders: prev.orders.map(o => (o.id === orderId ? { ...o, status: 'Cancelled' } : o))
        }));
      }
    } catch (err: any) {
      alert(err?.message || 'Could not cancel order');
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setAuthToken(null);
    setUser(null);
    setOwnedRestaurants([]);
    setDemoAiRemaining(null);
    setIsChatOpen(false);
    setVoiceFormType(null);
    setView('home');
  };

  const handleSaveCustomerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileEdit)
      });
      setUser(res.user);
      setProfileSavedToast('Profile settings saved successfully.');
      setTimeout(() => setProfileSavedToast(''), 3000);
    } catch (err: any) {
      alert(err?.message);
    }
  };

  // Enrich restaurant lists with real distance from user location
  const topRatedWithDistance = useMemo(
    () => enrichWithDistance(homeData.topRated),
    [enrichWithDistance, homeData.topRated]
  );

  const sponsoredWithDistance = useMemo(
    () => enrichWithDistance(homeData.sponsoredRestaurants),
    [enrichWithDistance, homeData.sponsoredRestaurants]
  );

  const nearestSortedRestaurants = useMemo(() => {
    const list = enrichWithDistance(
      searchResults.length > 0 ? searchResults : [...homeData.topRated, ...homeData.nearby]
    );
    // Deduplicate by id and sort by distanceKm ascending
    const seen = new Set<string>();
    const unique = list.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    return unique.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }, [enrichWithDistance, searchResults, homeData.topRated, homeData.nearby]);

  // Combine customer's own active orders + seeded dummy live orders for the Live Order Status Bar
  const activeOrdersForBanner = useMemo(() => {
    const combined = [...customerDashboard.orders, ...(homeData.liveOrders || [])];
    const seen = new Set<string>();
    return combined.filter(o => {
      if (!o || seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
  }, [customerDashboard.orders, homeData.liveOrders]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ===================================================================
          TOP NAVIGATION HEADER & TASKBAR (Separated Component)
         =================================================================== */}
      <HeaderBar
        activeTab={view}
        onSelectTab={tab => setView(tab)}
        selectedCity={selectedCity}
        userLocation={userLocation}
        onChangeCity={handleSelectCity}
        onDetectGpsLocation={async () => {
          const coords = await requestUserGeolocation();
          setUserLocation(coords);
          setSelectedCity('NearMe');
        }}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(d => !d)}
        cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
        user={user}
        unreadNotifications={unreadNotifications}
        onOpenAiChat={() => {
          setVoiceContextRestaurant(null);
          setVoiceContextMenu([]);
          setIsChatOpen(true);
        }}
        onOpenAuth={() => (user ? setIsAuthModalOpen(true) : setView('home'))}
        onLogout={handleLogout}
      />

      {/* ===================================================================
          AUTH GATE: FIRST PAGE IS LOGIN (NO DUMMY DATA BEFORE LOGIN)
         =================================================================== */}
      {!user ? (
        <main className="flex-1">
          {view === 'why-us' ? (
            <div className="space-y-4">
              <div className="rh-container pt-6">
                <button
                  type="button"
                  onClick={() => setView('home')}
                  className="rh-btn-primary px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-2"
                >
                  <i className="fas fa-arrow-left"></i>
                  <span>Back to Sign In</span>
                </button>
              </div>
              <WhyRestaurantHubView
                onSelectTab={() => setView('home')}
                onOpenAuth={() => setView('home')}
              />
            </div>
          ) : (
            <AuthModal
              isOpen={true}
              fullPage={true}
              onClose={() => {}}
              onOpenWhyUs={() => setView('why-us')}
              onSuccess={async (loggedInUser, owned) => {
                setUser(loggedInUser);
                setOwnedRestaurants(owned);
                await loadAuthSession();
                await loadHomeData();
                if (loggedInUser.role === 'restaurant_owner') {
                  setView('live-bidding');
                } else if (loggedInUser.role === 'admin') {
                  setView('admin');
                } else {
                  setView('home');
                }
              }}
            />
          )}
        </main>
      ) : (
      /* ===================================================================
          AUTHENTICATED MAIN VIEW ROUTER (ROLE-BASED)
         =================================================================== */
      <main className="flex-1">
        {/* VIEW 1: CUSTOMER HOMEPAGE (Customer Role Only) */}
        {view === 'home' && (
          <div className="space-y-10 pb-20">
            <HeroSection
              omniInput={searchQuery}
              onChangeOmniInput={setSearchQuery}
              onSubmitSearch={e => {
                e.preventDefault();
                setSearchSortBy('recommended');
                setView('best-restaurants');
                runRestaurantSearch();
              }}
              onSelectTab={tab => {
                if (tab === 'best-restaurants') {
                  setSearchSortBy('recommended');
                  setView('best-restaurants');
                } else {
                  setView(tab);
                }
              }}
            />

            {/* Main Homepage Content Container */}
            <div className="rh-container space-y-12">
              {/* LIVE INTERACTIVE ORDER STATUS BAR (Only shown when real orders are placed) */}
              <LiveOrderBanner
                orders={activeOrdersForBanner}
                canChangeStatus={user?.role === 'restaurant_owner' || user?.role === 'admin'}
                onStatusChange={async (orderId, newStatus) => {
                  try {
                    const targetOrder = activeOrdersForBanner.find(o => o.id === orderId);
                    const restId = targetOrder?.restaurant_id || 'rest_abdul_ahad';
                    await apiFetch(`/api/owner/restaurants/${restId}/orders/${orderId}/status`, {
                      method: 'PUT',
                      body: JSON.stringify({ status: newStatus })
                    });
                    await refreshLiveOrders();
                    if (user) await loadCustomerDashboard();
                  } catch (err: any) {
                    alert(err?.message || 'Could not update order status');
                  }
                }}
                onViewAllOrders={() => {
                  setView('account');
                  setAccountTab('orders');
                }}
              />

              {/* 1. FIRST SCROLL: Top restaurants (clean list, one restaurant per row) */}
              <section>
                <div className="rh-section-header">
                  <div>
                    <h2 className="text-xl font-extrabold">Top Restaurants</h2>
                    <p className="text-xs rh-text-muted">
                      Handpicked places to order from right now
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSearchSortBy('recommended');
                      setView('best-restaurants');
                    }}
                    className="text-xs font-extrabold text-[#7C3AED] hover:underline"
                  >
                    See all restaurants →
                  </button>
                </div>

                {loadingHome ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(n => (
                      <div key={n} className="h-44 rounded-2xl rh-surface-muted animate-pulse"></div>
                    ))}
                  </div>
                ) : topRatedWithDistance.length === 0 ? (
                  <div className="rh-surface rounded-2xl p-12 text-center space-y-3">
                    <i className="fas fa-store text-3xl text-[#7C3AED]"></i>
                    <p className="text-base font-extrabold">No restaurants available yet</p>
                    <p className="text-xs rh-text-muted max-w-md mx-auto">
                      Restaurants will appear here as soon as they join Restaurant Hub. Check back soon.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topRatedWithDistance.slice(0, 5).map((rest, idx) => (
                      <RankedRestaurantRow
                        key={`top_row_${rest.id}`}
                        restaurant={rest}
                        rank={idx + 1}
                        onClick={handleOpenRestaurant}
                        isFavourite={homeData.favouriteIds.includes(rest.id)}
                        onToggleFavourite={handleToggleFavourite}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* 2. Trending Food Items Across Restaurants */}
              <section className="rh-surface-muted p-6 sm:p-8 rounded-3xl">
                <div className="rh-section-header">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F97316]">
                      Most Ordered Right Now
                    </span>
                    <h2 className="text-xl font-extrabold">Trending Food</h2>
                    <p className="text-xs rh-text-muted">
                      Compare signature dishes and order directly from top kitchens
                    </p>
                  </div>
                  <button
                    onClick={() => setView('trending-food')}
                    className="rh-btn-primary px-4 py-2 rounded-xl text-xs font-extrabold"
                  >
                    Explore All Trending Food →
                  </button>
                </div>

                <div className="rh-grid-foods">
                  {homeData.trendingFood.map(item => (
                    <MenuCard
                      key={`tf_${item.id}`}
                      item={item}
                      showRestaurantBadge={true}
                      onClick={it => handleSelectMenuItem(it)}
                      onRestaurantClick={rid => handleOpenRestaurant(rid)}
                    />
                  ))}
                </div>
              </section>

              {/* 3. Nearest Restaurants (Based on User Location) */}
              <section>
                <div className="rh-section-header">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F97316]">
                      <i className="fas fa-location-arrow mr-1"></i> {userLocation.label}
                    </span>
                    <h2 className="text-xl font-extrabold">Nearest Restaurants</h2>
                    <p className="text-xs rh-text-muted">
                      Sorted by proximity to your current location & fastest delivery
                    </p>
                  </div>
                  <button
                    onClick={() => setView('nearest-restaurants')}
                    className="text-xs font-extrabold text-[#F97316] hover:underline"
                  >
                    View Nearest Map & List →
                  </button>
                </div>
                <div className="rh-grid-restaurants">
                  {nearestSortedRestaurants.slice(0, 3).map(rest => (
                    <RestaurantCard
                      key={`near_${rest.id}`}
                      restaurant={rest}
                      onClick={handleOpenRestaurant}
                      isFavourite={homeData.favouriteIds.includes(rest.id)}
                      onToggleFavourite={handleToggleFavourite}
                    />
                  ))}
                </div>
              </section>

              {/* 4. Popular Cuisines */}
              <section>
                <div className="rh-section-header">
                  <div>
                    <h2 className="text-xl font-extrabold">Popular Cuisines</h2>
                    <p className="text-xs rh-text-muted">Explore authentic kitchens by culinary tradition</p>
                  </div>
                </div>

                <div className="rh-grid-cuisines">
                  {homeData.popularCuisines.map(c => (
                    <div
                      key={c.name}
                      onClick={() => {
                        setSearchCuisine(c.name);
                        setView('best-restaurants');
                      }}
                      className="rh-card p-3 flex flex-col items-center text-center cursor-pointer group"
                    >
                      <div className="w-16 h-16 rounded-2xl overflow-hidden mb-2.5 rh-surface-muted">
                        <SmartImage
                          src={c.image}
                          alt={c.name}
                          fallbackLabel={c.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      </div>
                      <h3 className="text-xs font-extrabold group-hover:text-[#F97316] line-clamp-1">
                        {c.name}
                      </h3>
                      <span className="text-[11px] rh-text-muted font-semibold mt-0.5">
                        {c.count} {c.count === 1 ? 'Restaurant' : 'Restaurants'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. Featured & Sponsored Spotlight */}
              {sponsoredWithDistance.length > 0 && (
                <section>
                  <div className="rh-section-header">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-extrabold">Featured Partners</h2>
                        <span className="bg-[#FFF7ED] text-[#EA580C] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md border border-[#F97316]/30">
                          Sponsored
                        </span>
                      </div>
                      <p className="text-xs rh-text-muted">
                        Promoted and verified dining destinations
                      </p>
                    </div>
                  </div>

                  <div className="rh-grid-restaurants">
                    {sponsoredWithDistance.slice(0, 3).map(rest => (
                      <RestaurantCard
                        key={`spon_${rest.id}`}
                        restaurant={rest}
                        onClick={handleOpenRestaurant}
                        isFavourite={homeData.favouriteIds.includes(rest.id)}
                        onToggleFavourite={handleToggleFavourite}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 6. Special Offers Banner */}
              {homeData.specialOffers.length > 0 && (
                <section>
                  <div className="rh-section-header">
                    <div>
                      <h2 className="text-xl font-extrabold">Special Offers & Deals</h2>
                      <p className="text-xs rh-text-muted">Apply verified promo codes at checkout</p>
                    </div>
                    <button
                      onClick={() => setView('offers')}
                      className="text-xs font-extrabold text-[#F97316] hover:underline"
                    >
                      All Offers →
                    </button>
                  </div>

                  <div className="rh-grid-foods">
                    {homeData.specialOffers.map(off => (
                      <div
                        key={off.id}
                        onClick={() => handleOpenRestaurant(off.restaurant_id)}
                        className="rh-card p-5 cursor-pointer flex flex-col justify-between space-y-3 border-[#F97316]/30"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="bg-[#F97316] text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md">
                              Code: {off.code}
                            </span>
                            <span className="text-xs font-extrabold text-[#EA580C]">
                              Min ${Number(off.min_order_amount).toFixed(0)}
                            </span>
                          </div>
                          <h3 className="text-base font-extrabold mt-2.5">{off.title}</h3>
                          <p className="text-xs rh-text-muted mt-1">{off.description}</p>
                        </div>
                        <p className="text-xs font-extrabold text-[#F97316] pt-2 border-t border-gray-200 dark:border-zinc-700">
                          <i className="fas fa-store mr-1.5"></i> {off.restaurant_name} →
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: RESTAURANTS LIST (customer view: search, filter, one restaurant per row) */}
        {view === 'best-restaurants' && (
          <div className="rh-container py-8 space-y-6 pb-20">
            <div className="rh-surface rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold">Restaurants</h1>
                  <p className="text-xs rh-text-muted">
                    Browse every restaurant. Filter by cuisine, price, rating, or dining services.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchCuisine('All');
                    setSearchPrice('All');
                    setSearchMinRating(0);
                    setSearchService('');
                    setSearchSortBy('recommended');
                  }}
                  className="text-xs font-bold text-[#7C3AED] hover:underline"
                >
                  Reset All Filters
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                <div className="lg:col-span-2 relative">
                  <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 rh-text-muted"></i>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search restaurants, cuisines, or dishes..."
                    className="w-full rh-surface-muted rounded-xl pl-9 pr-4 py-2.5 font-semibold outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <select
                  value={searchCuisine}
                  onChange={e => setSearchCuisine(e.target.value)}
                  className="rh-surface-muted rounded-xl px-3 py-2.5 font-bold"
                >
                  <option value="All">All Cuisines</option>
                  <option value="Pakistani & Mughal">Pakistani & Mughal</option>
                  <option value="Burgers & American">Burgers & American</option>
                  <option value="Italian & Pizza">Italian & Pizza</option>
                  <option value="Pan-Asian & Sushi">Pan-Asian & Sushi</option>
                  <option value="Middle Eastern & Arabian">Middle Eastern & Arabian</option>
                  <option value="Cafe & Healthy">Cafe & Healthy</option>
                </select>

                <select
                  value={searchPrice}
                  onChange={e => setSearchPrice(e.target.value)}
                  className="rh-surface-muted rounded-xl px-3 py-2.5 font-bold"
                >
                  <option value="All">Any Price Range</option>
                  <option value="$">$ (Budget)</option>
                  <option value="$$">$$ (Moderate)</option>
                  <option value="$$$">$$$ (Premium)</option>
                </select>

                <select
                  value={searchMinRating}
                  onChange={e => setSearchMinRating(Number(e.target.value))}
                  className="rh-surface-muted rounded-xl px-3 py-2.5 font-bold"
                >
                  <option value={0}>Any Rating</option>
                  <option value={4.5}>4.5★ & Above</option>
                  <option value={4.0}>4.0★ & Above</option>
                </select>

                <select
                  value={searchSortBy}
                  onChange={e => setSearchSortBy(e.target.value)}
                  className="rh-surface-muted rounded-xl px-3 py-2.5 font-bold"
                >
                  <option value="recommended">Sort: Recommended</option>
                  <option value="rating">Sort: Highest Rated</option>
                  <option value="delivery_time">Sort: Fastest Delivery</option>
                  <option value="price_low">Sort: Price Low to High</option>
                </select>
              </div>

              {/* Service Filter Pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { id: '', label: 'All Services' },
                  { id: 'delivery', label: 'Delivery' },
                  { id: 'dineIn', label: 'Dine In' },
                  { id: 'familySeating', label: 'Family Seating' },
                  { id: 'voiceOrdering', label: 'Voice AI Enabled' }
                ].map(srv => (
                  <button
                    key={srv.id}
                    onClick={() => setSearchService(srv.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                      searchService === srv.id
                        ? 'bg-[#7C3AED] text-white'
                        : 'rh-surface-muted rh-text-muted hover:text-[#7C3AED]'
                    }`}
                  >
                    {srv.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingSearch ? (
              <div className="py-16 text-center text-xs font-bold rh-text-muted">
                Searching restaurants...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="rh-surface rounded-2xl p-12 text-center space-y-3">
                <p className="text-base font-extrabold">
                  No restaurants match your exact filters
                </p>
                <p className="text-xs rh-text-muted">
                  Try clearing some filters or ask our AI Assistant for recommendations.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {enrichWithDistance(searchResults).map((rest, idx) => (
                  <RankedRestaurantRow
                    key={rest.id}
                    restaurant={rest}
                    rank={idx + 1}
                    onClick={handleOpenRestaurant}
                    isFavourite={homeData.favouriteIds.includes(rest.id)}
                    onToggleFavourite={handleToggleFavourite}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2B: TOP RATED (organic reviews only, separate low priority page) */}
        {view === 'top-rated' && (
          <div className="rh-container py-8 space-y-6 pb-20">
            <div className="rh-surface rounded-2xl p-6">
              <h1 className="text-2xl font-extrabold">Top Rated</h1>
              <p className="text-xs rh-text-muted">
                Restaurants ordered purely by customer reviews
              </p>
            </div>

            {topRatedList.length === 0 ? (
              <div className="rh-surface rounded-2xl p-12 text-center space-y-2">
                <p className="text-base font-extrabold">No rated restaurants yet</p>
                <p className="text-xs rh-text-muted">
                  Ratings appear after customers review the restaurants they ordered from.
                </p>
              </div>
            ) : (
              <div className="rh-grid-restaurants">
                {enrichWithDistance(topRatedList).map(rest => (
                  <RestaurantCard
                    key={`rated_${rest.id}`}
                    restaurant={rest}
                    onClick={handleOpenRestaurant}
                    isFavourite={homeData.favouriteIds.includes(rest.id)}
                    onToggleFavourite={handleToggleFavourite}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: TRENDING FOOD */}
        {view === 'trending-food' && (
          <div className="rh-container py-8 space-y-6 pb-20">
            <div className="rh-surface rounded-2xl p-6 space-y-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F97316]">
                  Dish-First Search & Price Comparison
                </span>
                <h1 className="text-2xl font-extrabold">Trending Food Across Restaurants</h1>
                <p className="text-xs rh-text-muted">
                  Compare prices, portions, and ratings for dishes across all verified kitchens
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <input
                  type="text"
                  value={foodQuery}
                  onChange={e => setFoodQuery(e.target.value)}
                  placeholder="Search dish e.g. Biryani, Smash Burger, Pizza..."
                  className="rh-surface-muted rounded-xl px-4 py-2.5 font-semibold outline-none focus:border-[#F97316]"
                />
                <select
                  value={foodCuisine}
                  onChange={e => setFoodCuisine(e.target.value)}
                  className="rh-surface-muted rounded-xl px-3.5 py-2.5 font-bold"
                >
                  <option value="All">All Cuisines</option>
                  <option value="Pakistani & Mughal">Pakistani & Mughal</option>
                  <option value="Burgers & American">Burgers & American</option>
                  <option value="Italian & Pizza">Italian & Pizza</option>
                  <option value="Pan-Asian & Sushi">Pan-Asian & Sushi</option>
                  <option value="Middle Eastern & Arabian">Middle Eastern & Arabian</option>
                  <option value="Cafe & Healthy">Cafe & Healthy</option>
                </select>
                <select
                  value={foodMaxPrice}
                  onChange={e => setFoodMaxPrice(Number(e.target.value))}
                  className="rh-surface-muted rounded-xl px-3.5 py-2.5 font-bold"
                >
                  <option value={0}>Any Dish Price</option>
                  <option value={10}>Under $10</option>
                  <option value={15}>Under $15</option>
                  <option value={20}>Under $20</option>
                </select>
                <select
                  value={foodSortBy}
                  onChange={e => setFoodSortBy(e.target.value)}
                  className="rh-surface-muted rounded-xl px-3.5 py-2.5 font-bold"
                >
                  <option value="popular">Sort: Most Trending</option>
                  <option value="price_low">Sort: Lowest Price First</option>
                  <option value="price_high">Sort: Highest Price First</option>
                  <option value="rating">Sort: Restaurant Rating</option>
                </select>
              </div>
            </div>

            {loadingFoods ? (
              <div className="py-16 text-center text-xs font-bold rh-text-muted">
                Loading trending food...
              </div>
            ) : (
              <div className="rh-grid-foods">
                {discoveredFoods.map(item => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    showRestaurantBadge={true}
                    onClick={it => handleSelectMenuItem(it)}
                    onRestaurantClick={rid => handleOpenRestaurant(rid)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: NEAREST RESTAURANTS (Default User Location + Maps Ready) */}
        {view === 'nearest-restaurants' && (
          <div className="rh-container py-8 space-y-6 pb-20">
            <div className="rh-surface rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#F97316]">
                  <i className="fas fa-location-arrow"></i>
                  <span>Active GPS Location: {userLocation.label}</span>
                  <span className="text-[11px] rh-text-muted font-semibold">
                    ({userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)})
                  </span>
                </div>
                <h1 className="text-2xl font-extrabold">Nearest Restaurants Around You</h1>
                <p className="text-xs rh-text-muted">
                  Automatically sorted by distance from your location. Maps API ready for live turn-by-turn routing.
                </p>
              </div>
              <button
                onClick={async () => {
                  const coords = await requestUserGeolocation();
                  setUserLocation(coords);
                  setSelectedCity('NearMe');
                }}
                className="rh-btn-primary px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2"
              >
                <i className="fas fa-crosshairs"></i>
                <span>Refresh My GPS Location</span>
              </button>
            </div>

            <div className="rh-grid-restaurants">
              {nearestSortedRestaurants.map(rest => (
                <RestaurantCard
                  key={`nearest_tab_${rest.id}`}
                  restaurant={rest}
                  onClick={handleOpenRestaurant}
                  isFavourite={homeData.favouriteIds.includes(rest.id)}
                  onToggleFavourite={handleToggleFavourite}
                />
              ))}
            </div>
          </div>
        )}

        {/* VIEW 5: SPECIAL OFFERS */}
        {view === 'offers' && (
          <div className="rh-container py-8 space-y-6 pb-20">
            <div className="rh-hero-gradient rounded-2xl p-8 text-white">
              <h1 className="text-3xl font-extrabold">Verified Restaurant Offers & Promo Codes</h1>
              <p className="text-sm text-white/90 mt-1">
                Copy any promo code below and apply it in your cart for instant server-validated savings.
              </p>
            </div>

            <div className="rh-grid-restaurants">
              {homeData.specialOffers.map(off => (
                <div
                  key={off.id}
                  className="rh-surface rounded-2xl p-6 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="bg-[#FFF7ED] text-[#EA580C] text-xs font-extrabold px-3 py-1 rounded-lg border border-[#F97316]/30">
                        CODE: {off.code}
                      </span>
                      <span className="text-xs font-bold rh-text-muted">
                        Min Order ${Number(off.min_order_amount).toFixed(2)}
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold mt-3">{off.title}</h3>
                    <p className="text-xs rh-text-muted mt-1">{off.description}</p>
                  </div>
                  <div className="pt-4 border-t border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                    <span className="text-xs font-extrabold">{off.restaurant_name}</span>
                    <button
                      onClick={() => handleOpenRestaurant(off.restaurant_id)}
                      className="rh-btn-primary px-4 py-2 rounded-xl text-xs font-extrabold"
                    >
                      Order Now →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 6: RESTAURANT DETAIL PAGE */}
        {view === 'restaurant-detail' && (
          <RestaurantDetailView
            restaurantIdOrSlug={selectedRestaurantId}
            user={user}
            onBack={() => setView('home')}
            onSelectMenuItem={(it, rest) => handleSelectMenuItem(it, rest)}
            onOpenVoiceAgent={(rest, menu) => {
              setVoiceContextRestaurant(rest);
              setVoiceContextMenu(menu);
              setIsChatOpen(true);
            }}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {/* VIEW 7: CUSTOMER ACCOUNT & CART/ORDERS */}
        {view === 'account' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 pb-20">
            <div className="rh-surface rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] text-[#F97316] flex items-center justify-center text-xl font-extrabold">
                  <i className="fas fa-user"></i>
                </div>
                <div>
                  <h1 className="text-xl font-extrabold">
                    {user ? user.name : 'Your Cart & Live Orders'}
                  </h1>
                  <p className="text-xs rh-text-muted">
                    {user ? `${user.email} • ${user.city}` : 'Track live order status or sign in to sync your history'}
                  </p>
                </div>
              </div>

              {user ? (
                <button
                  onClick={handleLogout}
                  className="text-xs font-extrabold text-[#D92D20] bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="rh-btn-primary px-4 py-2 rounded-xl text-xs font-extrabold"
                >
                  Sign In / Register
                </button>
              )}
            </div>

            {/* Account Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-zinc-700 pb-3">
              {[
                { id: 'orders', label: `Cart & Orders (${activeOrdersForBanner.length})`, icon: 'fa-receipt' },
                { id: 'favourites', label: `Saved Restaurants (${customerDashboard.favourites.length})`, icon: 'fa-heart' },
                { id: 'reviews', label: `My Reviews (${customerDashboard.reviews.length})`, icon: 'fa-star' },
                { id: 'notifications', label: `Notifications (${unreadNotifications})`, icon: 'fa-bell' },
                { id: 'profile', label: 'Profile', icon: 'fa-id-card' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setAccountTab(t.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                    accountTab === t.id
                      ? 'bg-[#F97316] text-white'
                      : 'rh-surface rh-text-muted'
                  }`}
                >
                  <i className={`fas ${t.icon}`}></i>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {accountTab === 'orders' && (
              <OrdersView
                orders={activeOrdersForBanner}
                cart={cart}
                user={user}
                onConfirm={handleConfirmManualOrder}
                onRemoveFromCart={handleRemoveFromCart}
                onUpdateCartQty={handleUpdateCartQty}
                onCancelOrder={handleCancelOrder}
                onRequestVoiceFormFill={onFill => openVoiceFormFiller('checkout', onFill)}
              />
            )}

            {accountTab === 'favourites' && (
              <div className="rh-grid-restaurants">
                {customerDashboard.favourites.length === 0 ? (
                  <div className="col-span-full rh-surface rounded-2xl p-12 text-center text-xs font-bold rh-text-muted">
                    No saved restaurants yet. Click the heart icon on any restaurant card to save it here.
                  </div>
                ) : (
                  customerDashboard.favourites.map(rest => (
                    <RestaurantCard
                      key={rest.id}
                      restaurant={rest}
                      onClick={handleOpenRestaurant}
                      isFavourite={true}
                      onToggleFavourite={handleToggleFavourite}
                    />
                  ))
                )}
              </div>
            )}

            {accountTab === 'reviews' && (
              <div className="space-y-3">
                {customerDashboard.reviews.length === 0 ? (
                  <div className="rh-surface rounded-2xl p-12 text-center text-xs font-bold rh-text-muted">
                    You haven't written any reviews yet.
                  </div>
                ) : (
                  customerDashboard.reviews.map((rv: any) => (
                    <div key={rv.id} className="rh-surface rounded-2xl p-5 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span
                          onClick={() => handleOpenRestaurant(rv.restaurant_id)}
                          className="font-extrabold text-[#F97316] cursor-pointer hover:underline text-sm"
                        >
                          {rv.restaurant_name}
                        </span>
                        <span className="font-extrabold">{rv.rating}★</span>
                      </div>
                      <p>{rv.comment}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {accountTab === 'notifications' && (
              <div className="rh-surface rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-extrabold">Activity & Alerts</h3>
                  {user && (
                    <button
                      onClick={async () => {
                        await apiFetch('/api/notifications/read-all', { method: 'POST' });
                        setUnreadNotifications(0);
                        loadCustomerDashboard();
                      }}
                      className="text-xs font-bold text-[#F97316] hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="space-y-2.5">
                  {customerDashboard.notifications.length === 0 ? (
                    <p className="text-xs rh-text-muted py-8 text-center">No notifications yet.</p>
                  ) : (
                    customerDashboard.notifications.map((n: any) => (
                      <div
                        key={n.id}
                        className={`p-4 rounded-xl border text-xs ${
                          n.is_read ? 'rh-surface-muted' : 'bg-[#FFF7ED] dark:bg-[#2E1A0F] border-[#F97316]'
                        }`}
                      >
                        <div className="flex justify-between font-extrabold">
                          <span>{n.title}</span>
                          <span className="text-[10px] rh-text-muted">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="rh-text-muted mt-1">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {accountTab === 'profile' && user && (
              <form
                onSubmit={handleSaveCustomerProfile}
                className="rh-surface rounded-2xl p-6 space-y-4 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-extrabold">Personal Information & Preferences</h3>
                  <button
                    type="button"
                    onClick={() =>
                      openVoiceFormFiller('profile', fields => {
                        setProfileEdit(prev => ({
                          name: fields.name || prev.name,
                          phone: fields.phone || prev.phone,
                          city:
                            fields.city && ['Karachi', 'Lahore', 'Islamabad'].includes(fields.city)
                              ? fields.city
                              : prev.city,
                          address: fields.address || prev.address
                        }));
                      })
                    }
                    className="rh-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <i className="fas fa-microphone"></i>
                    <span>AI Fill with Voice</span>
                  </button>
                </div>
                {profileSavedToast && (
                  <p className="p-3 rounded-xl bg-[#FFF7ED] text-[#EA580C] font-bold">{profileSavedToast}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={profileEdit.name}
                      onChange={e => setProfileEdit({ ...profileEdit, name: e.target.value })}
                      className="w-full rh-surface-muted rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={profileEdit.phone}
                      onChange={e => setProfileEdit({ ...profileEdit, phone: e.target.value })}
                      className="w-full rh-surface-muted rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Default City</label>
                    <select
                      value={profileEdit.city}
                      onChange={e => setProfileEdit({ ...profileEdit, city: e.target.value })}
                      className="w-full rh-surface-muted rounded-xl px-3.5 py-2.5 font-bold"
                    >
                      <option value="Karachi">Karachi</option>
                      <option value="Lahore">Lahore</option>
                      <option value="Islamabad">Islamabad</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Default Delivery Address</label>
                    <input
                      type="text"
                      value={profileEdit.address}
                      onChange={e => setProfileEdit({ ...profileEdit, address: e.target.value })}
                      className="w-full rh-surface-muted rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                </div>
                <button type="submit" className="rh-btn-primary px-6 py-3 rounded-xl font-extrabold">
                  Save Account Settings
                </button>
              </form>
            )}
          </div>
        )}

        {/* VIEW 8: RESTAURANT OWNER APPLICATION */}
        {view === 'owner' && (
          user && (user.role === 'restaurant_owner' || user.role === 'admin') ? (
            <OwnerDashboardView
              user={user}
              ownedRestaurants={ownedRestaurants}
              onRefreshAuth={async () => {
                await loadAuthSession();
                await refreshLiveOrders();
              }}
            />
          ) : (
            <div className="max-w-xl mx-auto px-4 py-16 text-center">
              <div className="rh-surface rounded-2xl p-8 space-y-4">
                <i className="fas fa-store text-3xl text-[#F97316]"></i>
                <h2 className="text-xl font-extrabold">Restaurant Owner Portal</h2>
                <p className="text-xs rh-text-muted">
                  Sign in with a Restaurant Owner account (or register your restaurant) to manage menus, update live order statuses, use the AI Menu Architect, and participate in paid ranking auctions.
                </p>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="rh-btn-primary px-6 py-3 rounded-xl text-xs font-extrabold"
                >
                  Sign In as Restaurant Owner
                </button>
              </div>
            </div>
          )
        )}

        {/* VIEW 9: PLATFORM ADMINISTRATION APPLICATION */}
        {view === 'admin' && user?.role === 'admin' && (
          <AdminView onClose={() => setView('home')} />
        )}

        {/* VIEW 10: DEDICATED LIVE BIDDING & PAID RANKING PAGE (RESTAURANT OWNER & ADMIN ONLY) */}
        {view === 'live-bidding' && (user?.role === 'restaurant_owner' || user?.role === 'admin') && (
          <div className="rh-container py-8 space-y-8 pb-20">
            <LiveBiddingShowcase
              biddingOverview={homeData.biddingOverview}
              onSelectRestaurant={handleOpenRestaurant}
              selectableRestaurantIds={
                user?.role === 'restaurant_owner' ? ownedRestaurants.map((r: any) => r.id) : undefined
              }
              onBidSuccess={async () => {
                await loadHomeData();
                await runRestaurantSearch();
              }}
              compact={false}
            />

            <section className="space-y-4">
              <div className="rh-section-header">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500">
                    <i className="fas fa-trophy mr-1"></i> Live Ranking Standings
                  </span>
                  <h2 className="text-xl font-extrabold">Where each restaurant stands</h2>
                  <p className="text-xs rh-text-muted">
                    Customers see this same order as a plain restaurant list, without any bid amounts. Bid higher to move up.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {(searchResults.length > 0 ? enrichWithDistance(searchResults) : topRatedWithDistance).map((rest, idx) => {
                  const bidInfo = homeData.biddingOverview?.allRestaurants?.find(
                    (b: any) => b.id === rest.id
                  );
                  return (
                    <RankedRestaurantRow
                      key={`bid_page_${rest.id}`}
                      restaurant={rest}
                      rank={idx + 1}
                      showRank={true}
                      onClick={handleOpenRestaurant}
                      showBidMoneyForOwner={true}
                      ownerBidAmount={Number(bidInfo?.activeBid || 0)}
                    />
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* VIEW 11: DEDICATED WHY US PAGE (ZERO DASHES) */}
        {view === 'why-us' && (
          <WhyRestaurantHubView
            onSelectTab={tab => {
              if (tab === 'best-restaurants') {
                setSearchSortBy('recommended');
              }
              setView(tab);
            }}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}
      </main>
      )}

      {/* ===================================================================
          MODALS & DRAWERS (BOTTOM-RIGHT AI WIDGET + FULLSCREEN VOICE, ITEM MODAL, AUTH)
         =================================================================== */}
      {user && (
        <ChatInterface
          isOpen={isChatOpen}
          onOpen={() => {
            setVoiceFormType(null);
            voiceFormCallbackRef.current = null;
            setIsChatOpen(true);
          }}
          onClose={() => {
            setIsChatOpen(false);
            setVoiceFormType(null);
          }}
          onOrderPlaced={handleAIAgentOrder}
          activeRestaurant={voiceContextRestaurant}
          activeMenuItems={voiceContextMenu}
          selectedCity={apiCityFilter}
          onSelectRestaurant={rid => handleOpenRestaurant(rid)}
          voiceFormType={voiceFormType}
          startInVoiceMode={Boolean(voiceFormType)}
          isDemoUser={isDemoUser}
          initialDemoAiRemaining={demoAiRemaining}
          onPromptSignIn={() => {
            handleLogout();
          }}
          onFormFilled={fields => {
            if (voiceFormCallbackRef.current) {
              voiceFormCallbackRef.current(fields);
            }
          }}
        />
      )}

      <ItemModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAdd={handleAddToCart}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onOpenWhyUs={() => setView('why-us')}
        onRequestVoiceFormFill={onFill => openVoiceFormFiller('register', onFill)}
        onSuccess={async (loggedInUser, owned) => {
          setUser(loggedInUser);
          setOwnedRestaurants(owned);
          await loadAuthSession();
          await loadHomeData();
          if (loggedInUser.role === 'restaurant_owner') {
            setView('owner');
          } else if (loggedInUser.role === 'admin') {
            setView('admin');
          }
        }}
      />

      {/* ===================================================================
          FOOTER (role aware, shown after sign in)
         =================================================================== */}
      {user && (
        <footer className="rh-surface-muted border-t border-gray-200 dark:border-zinc-800 py-12 px-4 sm:px-6 mt-auto">
          <div className="rh-container grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white font-extrabold">
                  <i className="fas fa-utensils"></i>
                </div>
                <div>
                  <span className="text-base font-extrabold block leading-none">
                    Restaurant <span className="text-[#7C3AED]">Hub</span>
                  </span>
                  <span className="text-[10px] font-bold text-[#7C3AED]">Everything's here</span>
                </div>
              </div>
              <p className="rh-text-muted leading-relaxed">
                {user.role === 'restaurant_owner'
                  ? 'Manage your orders, menu and visibility in one place. Zero commission on every order.'
                  : 'Discover restaurants, order your favorite dishes, and track every order in real time.'}
              </p>
            </div>

            {user.role !== 'restaurant_owner' && (
              <div className="space-y-2">
                <h4 className="font-extrabold uppercase tracking-wider">Explore</h4>
                <ul className="space-y-1.5 rh-text-muted font-semibold">
                  <li>
                    <button onClick={() => setView('best-restaurants')} className="hover:text-[#7C3AED]">
                      Restaurants
                    </button>
                  </li>
                  {user.role === 'customer' && (
                    <>
                      <li>
                        <button onClick={() => setView('top-rated')} className="hover:text-[#7C3AED]">
                          Top Rated
                        </button>
                      </li>
                      <li>
                        <button onClick={() => setView('trending-food')} className="hover:text-[#7C3AED]">
                          Trending Food
                        </button>
                      </li>
                      <li>
                        <button onClick={() => setView('nearest-restaurants')} className="hover:text-[#7C3AED]">
                          Nearest Restaurants
                        </button>
                      </li>
                      <li>
                        <button onClick={() => setView('offers')} className="hover:text-[#7C3AED]">
                          Special Offers
                        </button>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            )}

            {(user.role === 'restaurant_owner' || user.role === 'admin') && (
              <div className="space-y-2">
                <h4 className="font-extrabold uppercase tracking-wider">Restaurant Partners</h4>
                <ul className="space-y-1.5 rh-text-muted font-semibold">
                  <li>
                    <button onClick={() => setView('owner')} className="hover:text-[#7C3AED]">
                      Orders, Menu & Store
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setView('live-bidding')} className="hover:text-[#7C3AED]">
                      Bidding & Rank
                    </button>
                  </li>
                  {user.role === 'admin' && (
                    <li>
                      <button onClick={() => setView('admin')} className="hover:text-[#7C3AED]">
                        Admin Console
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;
