import React from 'react';
import { NavTabId } from './HeaderBar';

interface WhyRestaurantHubViewProps {
  onSelectTab: (tab: NavTabId) => void;
  onOpenAuth: () => void;
}

export const WhyRestaurantHubView: React.FC<WhyRestaurantHubViewProps> = ({
  onSelectTab,
  onOpenAuth
}) => {
  const pillars = [
    {
      icon: 'fa-hand-holding-usd',
      badge: '100% Order Revenue Kept',
      title: 'Zero Commission Marketplace',
      description:
        'Traditional food apps take up to 30% commission on every order, forcing kitchens to inflate prices. Restaurant Hub takes zero commission on food orders so restaurants protect their profit margins and customers pay authentic kitchen menu prices.'
    },
    {
      icon: 'fa-gavel',
      badge: 'Fair & Transparent Spotlight',
      title: 'Live Bidding for #1 Best Restaurant',
      description:
        'Instead of opaque algorithms, restaurants choose their own budget in a live auction that starts at just a few cents. Raises grow gradually, so small kitchens can compete and the top spot goes to whoever values it most.'
    },
    {
      icon: 'fa-microphone',
      badge: 'Hands Free Speed',
      title: 'Voice & Chat AI Ecosystem',
      description:
        'Customers can talk to the AI Assistant to discover food, auto fill checkout forms by voice, and track live kitchen status updates. Restaurant partners use the AI Menu Architect to turn plain text into published menus in seconds.'
    }
  ];

  return (
    <div className="rh-container py-10 space-y-10 pb-20">
      {/* Hero Banner */}
      <div className="rh-hero-gradient rounded-3xl p-8 sm:p-12 text-white space-y-4">
        <span className="inline-block bg-white/20 px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider">
          Why Restaurant Hub Exists
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight max-w-3xl">
          Built for Customers Who Want Real Menu Prices and Restaurants That Refuse to Lose 30% Commission
        </h1>
        <p className="text-sm sm:text-base text-white/90 max-w-2xl leading-relaxed">
          We replaced per order commissions with transparent live ranking auctions and an intelligent voice and chat AI ordering experience.
        </p>
        <div className="pt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onSelectTab('best-restaurants')}
            className="bg-white text-[#7c3aed] px-5 py-3 rounded-xl text-xs sm:text-sm font-extrabold shadow-md hover:opacity-95"
          >
            Explore Restaurants
          </button>
          <button
            type="button"
            onClick={onOpenAuth}
            className="bg-black/25 hover:bg-black/35 text-white border border-white/30 px-5 py-3 rounded-xl text-xs sm:text-sm font-extrabold"
          >
            Partner Your Restaurant
          </button>
        </div>
      </div>

      {/* 3 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {pillars.map(p => (
          <div key={p.title} className="rh-card p-6 sm:p-7 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-[#f5f3ff] dark:bg-[#7c3aed]/20 text-[#7c3aed] dark:text-[#a78bfa] flex items-center justify-center text-xl">
                  <i className={`fas ${p.icon}`}></i>
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider bg-[#f5f3ff] dark:bg-[#7c3aed]/20 text-[#7c3aed] dark:text-[#a78bfa] px-3 py-1 rounded-full">
                  {p.badge}
                </span>
              </div>
              <h2 className="text-lg font-extrabold">{p.title}</h2>
              <p className="text-xs sm:text-sm rh-text-muted leading-relaxed">{p.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Table: Restaurant Hub vs Legacy Aggregators */}
      <div className="rh-surface rounded-3xl p-6 sm:p-8 space-y-5">
        <div>
          <h3 className="text-xl font-extrabold">How Restaurant Hub Compares</h3>
          <p className="text-xs rh-text-muted mt-1">
            Why kitchens and diners are switching to our direct marketplace model
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 rh-text-muted uppercase text-[11px]">
                <th className="py-3.5 px-4">Feature</th>
                <th className="py-3.5 px-4 text-[#7c3aed] dark:text-[#a78bfa] font-extrabold">
                  Restaurant Hub
                </th>
                <th className="py-3.5 px-4">Traditional Delivery Apps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              <tr>
                <td className="py-3.5 px-4 font-bold">Order Commission</td>
                <td className="py-3.5 px-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                  0% Commission on Food Orders
                </td>
                <td className="py-3.5 px-4 rh-text-muted">25% to 35% per order</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold">Best Restaurant Ranking</td>
                <td className="py-3.5 px-4 font-extrabold text-[#7c3aed] dark:text-[#a78bfa]">
                  Transparent Live Bidding (start from cents)
                </td>
                <td className="py-3.5 px-4 rh-text-muted">Hidden ad fees & opaque algorithms</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold">Voice & Chat AI Ordering</td>
                <td className="py-3.5 px-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                  Built in Voice Form Fill & AI Concierge
                </td>
                <td className="py-3.5 px-4 rh-text-muted">Manual typing only</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold">Live Order Status Bar</td>
                <td className="py-3.5 px-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                  Instant Kitchen to Customer Status Stepper
                </td>
                <td className="py-3.5 px-4 rh-text-muted">Delayed third party status</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
