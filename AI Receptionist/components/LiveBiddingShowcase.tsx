import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/apiClient';

interface LiveBiddingShowcaseProps {
  biddingOverview?: {
    campaignTitle: string;
    slotCount: number;
    highestBid: number;
    minIncrement: number;
    minNextBid: number;
    leadingRestaurant: any;
    recentBids: any[];
    allRestaurants: {
      id: string;
      name: string;
      city: string;
      cuisine: string;
      activeBid: number;
      bidRank: number | null;
    }[];
  };
  onBidSuccess: () => Promise<void> | void;
  onSelectRestaurant: (id: string) => void;
  /** Restaurants the signed in account may bid for (omit for admins to allow all). */
  selectableRestaurantIds?: string[];
  compact?: boolean;
}

export const LiveBiddingShowcase: React.FC<LiveBiddingShowcaseProps> = ({
  biddingOverview,
  onBidSuccess,
  onSelectRestaurant,
  selectableRestaurantIds,
  compact = false
}) => {
  const allRestaurants = biddingOverview?.allRestaurants || [];
  const biddableRestaurants = selectableRestaurantIds
    ? allRestaurants.filter(r => selectableRestaurantIds.includes(r.id))
    : allRestaurants;
  const minNextBid = biddingOverview?.minNextBid || 0.1;
  const highestBid = biddingOverview?.highestBid || 0;
  const minIncrement = biddingOverview?.minIncrement || 0.01;

  const [selectedRestId, setSelectedRestId] = useState<string>(
    biddableRestaurants[0]?.id || ''
  );
  const [bidAmount, setBidAmount] = useState<string>(String(minNextBid));
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setBidAmount(String(minNextBid));
  }, [minNextBid]);

  useEffect(() => {
    if (biddableRestaurants.length > 0 && !biddableRestaurants.some(r => r.id === selectedRestId)) {
      setSelectedRestId(biddableRestaurants[0].id);
    }
  }, [biddableRestaurants, selectedRestId]);

  if (!biddingOverview) return null;

  const topBidders = allRestaurants
    .filter(r => r.activeBid > 0)
    .sort((a, b) => b.activeBid - a.activeBid)
    .slice(0, 3);

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/bidding/public-bid', {
        method: 'POST',
        body: JSON.stringify({
          restaurantId: selectedRestId,
          amount: Number(bidAmount),
          notes: 'Live Spotlight Ranking Bid'
        })
      });
      setFeedback({
        type: 'ok',
        text: `${res.restaurantName} is now #1 in Best Restaurants with a $${Number(res.amount).toFixed(2)} bid!`
      });
      await onBidSuccess();
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || 'Could not place bid'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rh-surface rounded-3xl p-5 sm:p-7 border-2 border-[#7c3aed]/35 shadow-md space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 bg-[#f5f3ff] dark:bg-[#7c3aed]/20 text-[#7c3aed] dark:text-[#a78bfa] px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
            <i className="fas fa-gavel"></i>
            <span>Live Best Restaurant Bidding Arena</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold">
            Restaurants Bid Live to Claim #1 Best Restaurant Spot
          </h2>
          <p className="text-xs rh-text-muted">
            Zero order commission. Restaurants compete transparently for top discovery placement with bids that start at a few cents and rise gradually as the top bid grows.
          </p>
        </div>

        {/* Live Auction Metrics Pill */}
        <div className="flex items-center gap-3 rh-surface-muted px-4 py-3 rounded-2xl">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider rh-text-muted block">
              Current #1 Bid
            </span>
            <span className="text-xl font-extrabold text-[#7c3aed] dark:text-[#a78bfa]">
              ${highestBid.toFixed(2)}
            </span>
          </div>
          <div className="h-8 w-px bg-gray-300 dark:bg-gray-700"></div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider rh-text-muted block">
              Next Qualifying Bid
            </span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              ${minNextBid.toFixed(2)}+
            </span>
          </div>
        </div>
      </div>

      {/* Top 3 Live Bidding Leaderboard + Instant Bid Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Top 3 Leaderboard Slots */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {topBidders.map((item, index) => {
            const rank = index + 1;
            return (
              <div
                key={item.id}
                onClick={() => onSelectRestaurant(item.id)}
                className={`p-4 rounded-2xl cursor-pointer transition-all flex flex-col justify-between ${
                  rank === 1
                    ? 'bg-[#f5f3ff] dark:bg-[#7c3aed]/20 border-2 border-[#7c3aed]'
                    : 'rh-surface-muted hover:border-[#7c3aed]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold uppercase ${
                        rank === 1
                          ? 'bg-[#7c3aed] text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      <i className={`fas ${rank === 1 ? 'fa-trophy text-amber-300' : 'fa-medal'} mr-1`}></i>
                      Rank #{rank}
                    </span>
                    <span className="text-sm font-extrabold text-[#7c3aed] dark:text-[#a78bfa]">
                      ${item.activeBid.toFixed(2)}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold line-clamp-1">{item.name}</h3>
                  <p className="text-[11px] rh-text-muted line-clamp-1">
                    {item.cuisine} • {item.city}
                  </p>
                </div>

                <span className="text-[11px] font-extrabold text-[#7c3aed] dark:text-[#a78bfa] mt-3 inline-block">
                  Open Restaurant →
                </span>
              </div>
            );
          })}
        </div>

        {/* Instant Live Bid Action Form */}
        <form
          onSubmit={handlePlaceBid}
          className="lg:col-span-5 rh-surface-muted p-4 rounded-2xl flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#7c3aed] dark:text-[#a78bfa]">
              <i className="fas fa-bolt mr-1.5"></i> Place Live Bid for #1 Rank
            </span>
            <span className="text-[11px] font-bold rh-text-muted">
              Min raise ${minIncrement.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="font-bold block mb-1 text-[11px] rh-text-muted">
                Select Restaurant
              </label>
              <select
                value={selectedRestId}
                onChange={e => setSelectedRestId(e.target.value)}
                className="w-full rh-surface rounded-xl px-3 py-2.5 font-extrabold outline-none"
              >
                {allRestaurants.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.activeBid > 0 ? `$${r.activeBid.toFixed(2)}` : 'No bid'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold block mb-1 text-[11px] rh-text-muted">
                Bid Amount (Min ${minNextBid.toFixed(2)})
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  min={minNextBid}
                  value={bidAmount}
                  onChange={e => setBidAmount(e.target.value)}
                  className="w-full rh-surface rounded-xl px-3 py-2.5 font-extrabold outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = Number(bidAmount || minNextBid);
                    const raise = Math.max(0.01, Math.ceil(current * 5) / 100);
                    setBidAmount((Math.round((current + raise) * 100) / 100).toFixed(2));
                  }}
                  className="px-2.5 py-2.5 rounded-xl rh-surface font-extrabold text-[#7c3aed] hover:border-[#7c3aed]"
                  title="Raise by 5%"
                >
                  +5%
                </button>
              </div>
            </div>
          </div>

          {selectableRestaurantIds && biddableRestaurants.length === 0 && (
            <div className="p-2.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              Your restaurant can start bidding once it has been approved.
            </div>
          )}

          {feedback && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold ${
                feedback.type === 'ok'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !selectedRestId}
            className="w-full rh-btn-primary py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider"
          >
            {submitting ? 'Updating Live Rank...' : `Bid $${Number(bidAmount || minNextBid).toFixed(2)} & Take #1 Spot`}
          </button>
        </form>
      </div>

      {/* Optional Extended Bid History when not compact */}
      {!compact && biddingOverview.recentBids && biddingOverview.recentBids.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-2.5">
          <h4 className="text-xs font-extrabold uppercase tracking-wider rh-text-muted">
            Recent Live Auction Activity
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            {biddingOverview.recentBids.slice(0, 4).map((b: any, i: number) => (
              <div key={b.id} className="p-3 rounded-xl rh-surface-muted flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-extrabold truncate">{b.restaurant_name}</p>
                  <p className="text-[10px] rh-text-muted">
                    {i === 0 ? 'Current #1 Leader' : 'Runner Up Bid'}
                  </p>
                </div>
                <span className="font-extrabold text-[#7c3aed] dark:text-[#a78bfa] text-sm">
                  ${Number(b.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
