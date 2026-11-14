import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { UserLocationState } from '../services/locationService';

export type NavTabId =
  | 'home'
  | 'best-restaurants'
  | 'top-rated'
  | 'live-bidding'
  | 'trending-food'
  | 'nearest-restaurants'
  | 'offers'
  | 'why-us'
  | 'restaurant-detail'
  | 'account'
  | 'owner'
  | 'admin';

interface HeaderBarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  selectedCity: string;
  userLocation: UserLocationState;
  onChangeCity: (city: string) => void;
  onDetectGpsLocation: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  cartCount: number;
  unreadNotifications: number;
  user: UserProfile | null;
  onOpenAiChat?: () => void;
  onOpenAuth: () => void;
  onLogout?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeTab,
  onSelectTab,
  selectedCity,
  userLocation,
  onChangeCity,
  onDetectGpsLocation,
  darkMode,
  onToggleDarkMode,
  cartCount,
  unreadNotifications,
  user,
  onOpenAuth,
  onLogout
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const locRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locRef.current && !locRef.current.contains(e.target as Node)) {
        setLocationMenuOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isRestaurantOwner = user?.role === 'restaurant_owner';
  const isAdmin = user?.role === 'admin';
  const isCustomer = !isRestaurantOwner && !isAdmin;

  // Role based navigation:
  // - Customers: Restaurants, Top Rated, Trending Food, Nearest, Why Us (never any bidding or money)
  // - Restaurant owners: Bidding, Orders and Menu, Why Us
  // - Admins: Admin Console, Bidding, Restaurant Portal, Restaurants, Why Us
  const taskbarLinks: { id: NavTabId; label: string; icon: string }[] = isRestaurantOwner
    ? [
        { id: 'live-bidding', label: 'Bidding & Rank ($)', icon: 'fa-gavel' },
        { id: 'owner', label: 'Orders, Menu & Store', icon: 'fa-store' },
        { id: 'why-us', label: 'Why Us', icon: 'fa-award' }
      ]
    : isAdmin
      ? [
          { id: 'admin', label: 'Admin Console', icon: 'fa-user-shield' },
          { id: 'live-bidding', label: 'Bidding & Rank ($)', icon: 'fa-gavel' },
          { id: 'owner', label: 'Restaurant Portal', icon: 'fa-store' },
          { id: 'best-restaurants', label: 'Restaurants', icon: 'fa-utensils' },
          { id: 'why-us', label: 'Why Us', icon: 'fa-award' }
        ]
      : [
          { id: 'best-restaurants', label: 'Restaurants', icon: 'fa-utensils' },
          { id: 'top-rated', label: 'Top Rated', icon: 'fa-star' },
          { id: 'trending-food', label: 'Trending Food', icon: 'fa-fire' },
          { id: 'nearest-restaurants', label: 'Nearest Restaurants', icon: 'fa-location-arrow' },
          { id: 'why-us', label: 'Why Us', icon: 'fa-award' }
        ];

  const locationOptions = [
    { value: 'NearMe', label: userLocation.label, icon: 'fa-crosshairs' },
    { value: 'Karachi', label: 'Karachi', icon: 'fa-map-marker-alt' },
    { value: 'Lahore', label: 'Lahore', icon: 'fa-map-marker-alt' },
    { value: 'Islamabad', label: 'Islamabad', icon: 'fa-map-marker-alt' },
    { value: 'All', label: 'All Cities', icon: 'fa-globe' }
  ];

  const activeLocationLabel =
    selectedCity === 'NearMe'
      ? userLocation.label
      : selectedCity === 'All'
        ? 'All Cities'
        : selectedCity;

  return (
    <header className="rh-header">
      <div className="rh-container rh-header-inner">
        {/* Brand + Role-Specific Context */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => onSelectTab(isRestaurantOwner ? 'live-bidding' : isAdmin ? 'admin' : 'home')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-10 h-10 rounded-xl google-blue-gradient flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
              <i className="fas fa-utensils"></i>
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight block leading-none">
                Restaurant <span className="text-[#7c3aed] dark:text-[#a78bfa]">Hub</span>
              </span>
              <span className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">
                {isRestaurantOwner ? 'Partner Console' : isAdmin ? 'Admin Console' : "Everything's here"}
              </span>
            </div>
          </button>

          {/* Location Selector ONLY for Customers */}
          {isCustomer && user && (
            <div className="relative hidden sm:block" ref={locRef}>
              <div className="flex items-center rh-surface-box px-3 py-1.5 text-xs gap-2">
                <button
                  type="button"
                  onClick={onDetectGpsLocation}
                  title="Detect my live GPS location"
                  className="text-[#7c3aed] dark:text-[#a78bfa] hover:opacity-80"
                >
                  <i className="fas fa-map-marker-alt"></i>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationMenuOpen(o => !o)}
                  className="font-extrabold flex items-center gap-2 text-[#1e1b2e] dark:text-[#f3f0ff]"
                >
                  <span>{activeLocationLabel}</span>
                  <i
                    className={`fas fa-chevron-down text-[10px] transition-transform ${
                      locationMenuOpen ? 'rotate-180' : ''
                    }`}
                  ></i>
                </button>
              </div>

              {locationMenuOpen && (
                <div className="absolute left-0 mt-2 w-60 rounded-2xl shadow-xl border border-[#e4dff2] dark:border-[#312b46] bg-white dark:bg-[#1d192b] py-1.5 z-50">
                  {locationOptions.map(opt => {
                    const isSelected = selectedCity === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onChangeCity(opt.value);
                          setLocationMenuOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#f5f3ff] dark:bg-[#7c3aed]/25 text-[#7c3aed] dark:text-[#a78bfa]'
                            : 'text-[#1e1b2e] dark:text-[#f3f0ff] hover:bg-[#f8f7fc] dark:hover:bg-[#2a243d]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <i
                            className={`fas ${opt.icon} w-4 text-center text-[#7c3aed] dark:text-[#a78bfa]`}
                          ></i>
                          <span>{opt.label}</span>
                        </span>
                        {isSelected && <i className="fas fa-check text-[10px]"></i>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Role-Based Navigation Bar */}
        {user && (
          <nav className="rh-taskbar">
            {taskbarLinks.map(link => (
              <button
                key={link.id}
                type="button"
                onClick={() => onSelectTab(link.id)}
                className={`rh-taskbar-item ${activeTab === link.id ? 'active' : ''}`}
              >
                <i className={`fas ${link.icon} text-xs`}></i>
                <span>{link.label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* Right Controls: Theme Toggle, Role-Specific Actions, User / Logout */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="px-3 h-10 rounded-xl rh-surface-box flex items-center gap-2 text-xs font-extrabold hover:border-[#7c3aed] transition-colors"
            title={darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle Theme"
          >
            <i className="fas fa-moon text-[#7c3aed] dark:text-[#a78bfa]"></i>
            <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
          </button>

          {/* Customer Cart & Orders Button (Customers Only) */}
          {user && isCustomer && (
            <button
              type="button"
              onClick={() => onSelectTab('account')}
              className="relative px-3 h-10 rounded-xl rh-surface-box flex items-center gap-2 text-xs font-extrabold hover:border-[#7c3aed] transition-colors"
              title="My Cart & Orders"
            >
              <i className="fas fa-shopping-bag text-[#7c3aed] dark:text-[#a78bfa]"></i>
              <span className="hidden md:inline">My Orders</span>
              {cartCount > 0 && (
                <span className="bg-[#7c3aed] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Profile menu (top right): account, dashboard and sign out live here */}
          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                className="relative rh-surface-box px-3 py-2 text-xs font-extrabold flex items-center gap-2 hover:border-[#7c3aed]"
              >
                <span className="w-6 h-6 rounded-full bg-[#7c3aed] text-white flex items-center justify-center text-[11px]">
                  {user.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="hidden md:inline max-w-[110px] truncate">
                  {user.name.split(' ')[0]}
                </span>
                <i
                  className={`fas fa-chevron-down text-[10px] transition-transform ${
                    profileMenuOpen ? 'rotate-180' : ''
                  }`}
                ></i>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600"></span>
                )}
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 rounded-2xl shadow-xl border border-[#e4dff2] dark:border-[#312b46] bg-white dark:bg-[#1d192b] py-2 z-50"
                >
                  <div className="px-4 pb-2 mb-1 border-b border-[#e4dff2] dark:border-[#312b46]">
                    <p className="text-sm font-extrabold truncate">{user.name}</p>
                    <p className="text-[11px] rh-text-muted truncate">{user.email}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#f5f3ff] dark:bg-[#7c3aed]/20 text-[#7c3aed] dark:text-[#a78bfa]">
                      {isRestaurantOwner ? 'Restaurant' : isAdmin ? 'Admin' : 'Customer'}
                    </span>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onSelectTab(isRestaurantOwner ? 'owner' : isAdmin ? 'admin' : 'account');
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-[#f8f7fc] dark:hover:bg-[#2a243d]"
                  >
                    <i
                      className={`fas ${
                        isRestaurantOwner ? 'fa-store' : isAdmin ? 'fa-user-shield' : 'fa-user'
                      } w-4 text-center text-[#7c3aed] dark:text-[#a78bfa]`}
                    ></i>
                    <span>
                      {isRestaurantOwner
                        ? 'Restaurant Dashboard'
                        : isAdmin
                          ? 'Admin Console'
                          : 'My Profile & Orders'}
                    </span>
                    {unreadNotifications > 0 && (
                      <span className="ml-auto text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full">
                        {unreadNotifications}
                      </span>
                    )}
                  </button>

                  {onLogout && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <i className="fas fa-sign-out-alt w-4 text-center"></i>
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rh-btn-primary px-4 py-2.5 text-xs font-extrabold"
            >
              Sign In
            </button>
          )}

          {/* Mobile Menu Toggle */}
          {user && (
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden w-10 h-10 rounded-xl rh-surface-box flex items-center justify-center"
              aria-label="Open Navigation"
            >
              <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'}`}></i>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && user && (
        <div className="lg:hidden border-t border-[#e4dff2] dark:border-[#312b46] px-4 py-4 space-y-3 bg-white dark:bg-[#1d192b]">
          {isCustomer && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold rh-text-muted uppercase">
                Select Location
              </span>
              <div className="flex flex-wrap gap-1.5">
                {locationOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChangeCity(opt.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      selectedCity === opt.value
                        ? 'bg-[#7c3aed] text-white'
                        : 'rh-surface-box'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {taskbarLinks.map(link => (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  onSelectTab(link.id);
                  setMobileOpen(false);
                }}
                className="p-2.5 rounded-xl rh-surface-box text-xs font-extrabold text-left flex items-center gap-2"
              >
                <i className={`fas ${link.icon} text-[#7c3aed] dark:text-[#a78bfa]`}></i>
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
