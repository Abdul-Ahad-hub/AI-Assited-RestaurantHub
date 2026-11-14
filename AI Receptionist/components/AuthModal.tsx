import React, { useState } from 'react';
import { apiFetch, setAuthToken } from '../services/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any, ownedRestaurants: any[]) => void;
  onRequestVoiceFormFill?: (onFill: (fields: Record<string, string>) => void) => void;
  onOpenWhyUs?: () => void;
  fullPage?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onRequestVoiceFormFill,
  onOpenWhyUs,
  fullPage = false
}) => {
  const [tab, setTab] = useState<'login' | 'register-customer' | 'register-owner'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Karachi');
  const [address, setAddress] = useState('');

  // Restaurant owner onboarding fields
  const [restaurantName, setRestaurantName] = useState('');
  const [cuisine, setCuisine] = useState('Pakistani & Mughal');
  const [area, setArea] = useState('');
  const [priceRange, setPriceRange] = useState('$$');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  // Demo roles are for evaluation builds only. Set VITE_DISABLE_DEMO=true in production.
  const demoEnabled = (import.meta as any).env?.VITE_DISABLE_DEMO !== 'true';

  if (!isOpen && !fullPage) return null;

  const handleLogin = async (customEmail?: string, customPass?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: customEmail ?? email,
          password: customPass ?? password
        })
      });
      setAuthToken(res.token);
      onSuccess(res.user, res.ownedRestaurants || []);
      if (!fullPage) onClose();
    } catch (err: any) {
      setError(err?.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const role = tab === 'register-owner' ? 'restaurant_owner' : 'customer';
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          phone,
          city,
          address,
          restaurantName: role === 'restaurant_owner' ? restaurantName : undefined,
          cuisine: role === 'restaurant_owner' ? cuisine : undefined,
          area: role === 'restaurant_owner' ? area : undefined,
          priceRange: role === 'restaurant_owner' ? priceRange : undefined
        })
      });
      setAuthToken(res.token);
      onSuccess(res.user, res.ownedRestaurants || []);
      if (!fullPage) onClose();
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceFillRegister = () => {
    if (!onRequestVoiceFormFill) return;
    onRequestVoiceFormFill(fields => {
      if (fields.name) setName(fields.name);
      if (fields.email) setEmail(fields.email);
      if (fields.phone) setPhone(fields.phone);
      if (fields.city && ['Karachi', 'Lahore', 'Islamabad'].includes(fields.city)) {
        setCity(fields.city);
      }
      if (fields.address) setAddress(fields.address);
      if (fields.restaurantName) setRestaurantName(fields.restaurantName);
      if (fields.cuisine) setCuisine(fields.cuisine);
      if (fields.area) setArea(fields.area);
    });
  };

  const cardContent = (
    <div className="bg-white dark:bg-[#1d192b] text-[#1e1b2e] dark:text-[#f3f0ff] w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-[#e4dff2] dark:border-[#312b46]">
      {/* Header */}
      <div className="p-6 sm:p-8 rh-hero-gradient text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold">
            {tab === 'login' ? 'Sign in' : tab === 'register-owner' ? 'Register your restaurant' : 'Create your account'}
          </h2>
          <p className="text-xs text-white/85 mt-1">
            {tab === 'login'
              ? 'Welcome back. Pick up right where you left off.'
              : tab === 'register-owner'
                ? 'Reach hungry customers with zero order commission.'
                : 'Order from the best restaurants in a few taps.'}
          </p>
        </div>
        {!fullPage && (
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0"
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="grid grid-cols-3 bg-[#f4f2fa] dark:bg-[#14111f] p-1.5 border-b border-[#e4dff2] dark:border-[#312b46] text-xs font-extrabold">
        <button
          type="button"
          onClick={() => {
            setTab('login');
            setError('');
          }}
          className={`py-2.5 rounded-xl transition-all ${
            tab === 'login'
              ? 'bg-white dark:bg-[#1d192b] text-[#7c3aed] dark:text-[#a78bfa] shadow-xs'
              : 'text-[#645d7a] dark:text-[#a39bb8]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('register-customer');
            setError('');
          }}
          className={`py-2.5 rounded-xl transition-all ${
            tab === 'register-customer'
              ? 'bg-white dark:bg-[#1d192b] text-[#7c3aed] dark:text-[#a78bfa] shadow-xs'
              : 'text-[#645d7a] dark:text-[#a39bb8]'
          }`}
        >
          Create Account
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('register-owner');
            setError('');
          }}
          className={`py-2.5 rounded-xl transition-all ${
            tab === 'register-owner'
              ? 'bg-white dark:bg-[#1d192b] text-[#7c3aed] dark:text-[#a78bfa] shadow-xs'
              : 'text-[#645d7a] dark:text-[#a39bb8]'
          }`}
        >
          Register Restaurant
        </button>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[#d93025] dark:text-red-300 p-3 rounded-xl text-xs font-bold">
            {error}
          </div>
        )}

        {tab === 'login' ? (
          <>
            <form
              onSubmit={e => {
                e.preventDefault();
                handleLogin();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-bold block mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rh-surface-muted rounded-xl px-4 py-3 text-sm focus:border-[#7c3aed] outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold block mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rh-surface-muted rounded-xl px-4 py-3 text-sm focus:border-[#7c3aed] outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rh-btn-primary py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            {/* Quiet demo access: explore the app by role without an account */}
            {demoEnabled && (
              <div className="pt-4 border-t border-[#e4dff2] dark:border-[#312b46] text-center">
                {!showDemo ? (
                  <button
                    type="button"
                    onClick={() => setShowDemo(true)}
                    className="text-[11px] font-bold rh-text-muted hover:text-[#7c3aed] dark:hover:text-[#a78bfa] transition-colors"
                  >
                    Just exploring? Try a demo role
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold rh-text-muted">Explore as</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleLogin('customer@restauranthub.com', 'Password123!')}
                        className="px-3.5 py-2 rounded-xl rh-surface-muted text-[11px] font-extrabold hover:text-[#7c3aed] dark:hover:text-[#a78bfa] transition-colors"
                      >
                        <i className="fas fa-user mr-1.5"></i>Customer
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleLogin('owner@abdulahadkitchen.com', 'Password123!')}
                        className="px-3.5 py-2 rounded-xl rh-surface-muted text-[11px] font-extrabold hover:text-[#7c3aed] dark:hover:text-[#a78bfa] transition-colors"
                      >
                        <i className="fas fa-store mr-1.5"></i>Restaurant
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5 text-xs">

            {onRequestVoiceFormFill && (
              <div className="flex items-center justify-between bg-[#f5f3ff] dark:bg-[#7c3aed]/15 p-3 rounded-xl border border-[#7c3aed]/30">
                <span className="text-xs font-bold text-[#7c3aed] dark:text-[#a78bfa]">
                  Speak your details to auto fill this form
                </span>
                <button
                  type="button"
                  onClick={handleVoiceFillRegister}
                  className="rh-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5"
                >
                  <i className="fas fa-microphone"></i>
                  <span>AI Fill</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">Your Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full rh-surface-muted rounded-xl px-3.5 py-2.5"
                  required
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@domain.com"
                  className="w-full rh-surface-muted rounded-xl px-3.5 py-2.5"
                  required
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Password (min 6 chars) *</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rh-surface-muted rounded-xl px-3.5 py-2.5"
                  required
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full rh-surface-muted rounded-xl px-3.5 py-2.5"
                  required
                />
              </div>
              <div>
                <label className="font-bold block mb-1">City</label>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full rh-surface-muted rounded-xl px-3.5 py-2.5 font-bold"
                >
                  <option value="Karachi">Karachi</option>
                  <option value="Lahore">Lahore</option>
                  <option value="Islamabad">Islamabad</option>
                </select>
              </div>
              <div>
                <label className="font-bold block mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Street & Area"
                  className="w-full rh-surface-muted rounded-xl px-3.5 py-2.5"
                />
              </div>
            </div>

            {tab === 'register-owner' && (
              <div className="pt-3 border-t border-[#e4dff2] dark:border-[#312b46] space-y-3">
                <p className="font-extrabold text-[#7c3aed] dark:text-[#a78bfa] uppercase tracking-wider text-[11px]">
                  Restaurant Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={restaurantName}
                    onChange={e => setRestaurantName(e.target.value)}
                    placeholder="Restaurant Brand Name *"
                    className="rh-surface-muted rounded-xl px-3.5 py-2.5"
                    required
                  />
                  <input
                    type="text"
                    value={cuisine}
                    onChange={e => setCuisine(e.target.value)}
                    placeholder="Primary Cuisine *"
                    className="rh-surface-muted rounded-xl px-3.5 py-2.5"
                    required
                  />
                  <input
                    type="text"
                    value={area}
                    onChange={e => setArea(e.target.value)}
                    placeholder="Commercial Area (e.g. DHA Phase 6)"
                    className="rh-surface-muted rounded-xl px-3.5 py-2.5"
                  />
                  <select
                    value={priceRange}
                    onChange={e => setPriceRange(e.target.value)}
                    className="rh-surface-muted rounded-xl px-3.5 py-2.5 font-bold"
                  >
                    <option value="$">$ (Budget Friendly)</option>
                    <option value="$$">$$ (Moderate)</option>
                    <option value="$$$">$$$ (Fine Dining)</option>
                  </select>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rh-btn-primary py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md"
            >
              {loading
                ? 'Creating Account...'
                : tab === 'register-owner'
                  ? 'Register Restaurant'
                  : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-[calc(100vh-80px)] px-4 py-10 sm:py-14">
        <div className="rh-container grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Eye catching intro */}
          <div className="space-y-5 text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Hungry? Just say it.
              <span className="block text-[#7c3aed] dark:text-[#a78bfa]">We'll handle the rest.</span>
            </h1>
            <p className="text-sm sm:text-base rh-text-muted max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Tell our assistant what you feel like and your order is placed. Restaurants keep every
              dollar of their sales, so you get honest menu prices.
            </p>
            {onOpenWhyUs && (
              <button
                type="button"
                onClick={onOpenWhyUs}
                className="inline-flex items-center gap-2 text-sm font-extrabold text-[#7c3aed] dark:text-[#a78bfa] hover:underline"
              >
                <span>See more</span>
                <i className="fas fa-arrow-right text-xs"></i>
              </button>
            )}
          </div>

          <div className="flex justify-center lg:justify-end">{cardContent}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      {cardContent}
    </div>
  );
};
