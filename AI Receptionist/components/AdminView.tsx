import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { apiFetch } from '../services/apiClient';

interface AdminViewProps {
  orders?: Order[];
  onUpdateStatus?: (orderId: string, newStatus: Order['status']) => void;
  onClose: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<
    'restaurants' | 'users' | 'bidding' | 'moderation' | 'finance' | 'system'
  >('restaurants');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [userSearch, setUserSearch] = useState('');
  const [banner, setBanner] = useState('');

  // Campaign config form
  const [minIncrement, setMinIncrement] = useState('0.01');
  const [minOpening, setMinOpening] = useState('0.10');
  const [slotCount, setSlotCount] = useState('3');

  const loadAdminOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/overview');
      setData(res);
      if (res.campaigns?.[0]) {
        setMinIncrement(String(res.campaigns[0].min_bid_increment || 0.01));
        setMinOpening(String(res.campaigns[0].min_opening_bid || 0.1));
        setSlotCount(String(res.campaigns[0].slot_count || 3));
      }
    } catch (err: any) {
      setError(err?.message || 'Administrator authorization required.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminOverview();
  }, []);

  const flash = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(''), 3500);
  };

  const handleRestaurantMod = async (
    restId: string,
    updates: { approvalStatus?: string; verificationStatus?: string; isFeatured?: boolean; isTrending?: boolean }
  ) => {
    try {
      await apiFetch(`/api/admin/restaurants/${restId}/status`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      flash('Restaurant status updated.');
      await loadAdminOverview();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleUserStatus = async (userId: string, status: 'active' | 'suspended') => {
    try {
      await apiFetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      flash(`User account ${status}.`);
      await loadAdminOverview();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleReviewMod = async (revId: string, status: 'published' | 'hidden' | 'rejected') => {
    try {
      await apiFetch(`/api/admin/reviews/${revId}/moderate`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      flash(`Review marked as ${status}.`);
      await loadAdminOverview();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleUpdateCampaignRules = async (e: React.FormEvent) => {
    e.preventDefault();
    const campId = data?.campaigns?.[0]?.id;
    if (!campId) return;
    try {
      await apiFetch(`/api/admin/campaigns/${campId}/rules`, {
        method: 'PUT',
        body: JSON.stringify({
          minBidIncrement: Number(minIncrement),
          minOpeningBid: Number(minOpening),
          slotCount: Number(slotCount),
          status: 'active'
        })
      });
      flash('Bidding campaign rules updated!');
      await loadAdminOverview();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handlePaymentStatus = async (payId: string, status: 'completed' | 'refunded') => {
    try {
      await apiFetch(`/api/admin/payments/${payId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      flash(`Payment record marked ${status}.`);
      await loadAdminOverview();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <i className="fas fa-circle-notch fa-spin text-2xl text-[#00A86B] mb-2"></i>
        <p className="text-xs font-bold text-[#68736D]">Loading Platform Administration Console...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl p-8 border border-[#E4EBE6] space-y-4">
          <i className="fas fa-user-shield text-3xl text-[#D92D20]"></i>
          <h3 className="text-lg font-extrabold text-[#17231E]">Administrator Access Required</h3>
          <p className="text-xs text-[#68736D]">{error}</p>
          <button onClick={onClose} className="rh-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold">
            Return to Customer Discovery
          </button>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const filteredUsers = (data?.users || []).filter((u: any) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {banner && (
        <div className="bg-[#E8F7F0] border border-[#00A86B] text-[#087A50] px-4 py-3 rounded-xl text-xs font-extrabold flex justify-between">
          <span>
            <i className="fas fa-check-circle mr-2"></i> {banner}
          </span>
          <button onClick={() => setBanner('')}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#17231E] text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#00A86B] flex items-center justify-center text-xl">
            <i className="fas fa-user-shield"></i>
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#20C878]">
              Restaurant Hub Governance
            </span>
            <h1 className="text-2xl font-extrabold">Platform Administration Console</h1>
          </div>
        </div>

        <button
          onClick={onClose}
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-extrabold"
        >
          Exit Admin Console
        </button>
      </div>

      {/* Platform KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-[#E4EBE6]">
          <p className="text-[10px] font-bold uppercase text-[#68736D]">Total Restaurants</p>
          <p className="text-xl font-extrabold text-[#17231E] mt-1">{stats.totalRestaurants || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E4EBE6]">
          <p className="text-[10px] font-bold uppercase text-[#68736D]">Pending Approval</p>
          <p className="text-xl font-extrabold text-[#E9A23B] mt-1">{stats.pendingApprovals || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E4EBE6]">
          <p className="text-[10px] font-bold uppercase text-[#68736D]">Registered Users</p>
          <p className="text-xl font-extrabold text-[#17231E] mt-1">{stats.totalUsers || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E4EBE6]">
          <p className="text-[10px] font-bold uppercase text-[#68736D]">Flagged Reviews</p>
          <p className="text-xl font-extrabold text-[#D92D20] mt-1">{stats.reportedReviewsCount || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E4EBE6]">
          <p className="text-[10px] font-bold uppercase text-[#68736D]">Gross Marketplace Vol</p>
          <p className="text-xl font-extrabold text-[#00A86B] mt-1">
            ${Number(stats.totalGrossVolume || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E4EBE6]">
          <p className="text-[10px] font-bold uppercase text-[#68736D]">Platform Revenue</p>
          <p className="text-xl font-extrabold text-[#087A50] mt-1">
            ${Number(stats.totalPlatformRevenue || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E4EBE6] pb-3">
        {[
          { id: 'restaurants', label: 'Restaurants & Marketplace', icon: 'fa-store' },
          { id: 'users', label: 'User Management', icon: 'fa-users' },
          { id: 'bidding', label: 'Bidding & Ranking Rules', icon: 'fa-gavel' },
          { id: 'moderation', label: `Content Moderation (${stats.reportedReviewsCount || 0})`, icon: 'fa-flag' },
          { id: 'finance', label: 'Financials & Refunds', icon: 'fa-credit-card' },
          { id: 'system', label: 'Audit & AI Logs', icon: 'fa-terminal' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
              activeTab === t.id
                ? 'bg-[#00A86B] text-white'
                : 'bg-white text-[#68736D] border border-[#E4EBE6] hover:text-[#17231E]'
            }`}
          >
            <i className={`fas ${t.icon}`}></i>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 1. RESTAURANTS & MARKETPLACE MANAGEMENT */}
      {activeTab === 'restaurants' && (
        <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4">
          <h2 className="text-base font-extrabold text-[#17231E]">
            Restaurant Registrations, Verification & Marketplace Placement
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E4EBE6] text-[#68736D] uppercase text-[10px]">
                  <th className="py-3 px-3">Restaurant</th>
                  <th className="py-3 px-3">Owner</th>
                  <th className="py-3 px-3">City / Cuisine</th>
                  <th className="py-3 px-3">Verification / Approval</th>
                  <th className="py-3 px-3">Marketplace Flags</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4EBE6]">
                {(data?.restaurants || []).map((r: any) => (
                  <tr key={r.id}>
                    <td className="py-3.5 px-3 font-extrabold text-[#17231E]">
                      {r.name}
                      <p className="text-[11px] font-normal text-[#68736D]">★ {r.rating_avg} ({r.review_count})</p>
                    </td>
                    <td className="py-3.5 px-3 text-[#68736D]">
                      <span className="font-bold text-[#17231E]">{r.owner_name}</span>
                      <p className="text-[11px]">{r.owner_email}</p>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold">{r.city}</span> • {r.cuisine}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase mr-1 ${
                          r.approval_status === 'approved'
                            ? 'bg-[#E8F7F0] text-[#087A50]'
                            : r.approval_status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-[#D92D20]'
                        }`}
                      >
                        {r.approval_status}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F5F8F6] text-[#68736D] uppercase">
                        {r.verification_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 space-x-1.5">
                      <button
                        onClick={() => handleRestaurantMod(r.id, { isFeatured: !r.is_featured })}
                        className={`px-2 py-1 rounded-md text-[10px] font-extrabold ${
                          r.is_featured ? 'bg-[#00A86B] text-white' : 'bg-[#F5F8F6] text-[#68736D]'
                        }`}
                      >
                        Featured
                      </button>
                      <button
                        onClick={() => handleRestaurantMod(r.id, { isTrending: !r.is_trending })}
                        className={`px-2 py-1 rounded-md text-[10px] font-extrabold ${
                          r.is_trending ? 'bg-[#17231E] text-white' : 'bg-[#F5F8F6] text-[#68736D]'
                        }`}
                      >
                        Trending
                      </button>
                    </td>
                    <td className="py-3.5 px-3 text-right space-x-2">
                      {r.approval_status !== 'approved' && (
                        <button
                          onClick={() =>
                            handleRestaurantMod(r.id, {
                              approvalStatus: 'approved',
                              verificationStatus: 'verified'
                            })
                          }
                          className="bg-[#00A86B] text-white px-3 py-1.5 rounded-lg text-[11px] font-extrabold"
                        >
                          Approve & Verify
                        </button>
                      )}
                      {r.approval_status !== 'suspended' ? (
                        <button
                          onClick={() => handleRestaurantMod(r.id, { approvalStatus: 'suspended' })}
                          className="text-[#D92D20] hover:underline font-bold text-[11px]"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestaurantMod(r.id, { approvalStatus: 'approved' })}
                          className="text-[#00A86B] hover:underline font-bold text-[11px]"
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-extrabold text-[#17231E]">Platform User Directory</h2>
            <input
              type="text"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Search users by name, email, or role..."
              className="bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2 text-xs w-64"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E4EBE6] text-[#68736D] uppercase text-[10px]">
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">City</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4EBE6]">
                {filteredUsers.map((u: any) => (
                  <tr key={u.id}>
                    <td className="py-3 px-3 font-extrabold text-[#17231E]">{u.name}</td>
                    <td className="py-3 px-3 text-[#68736D]">{u.email}</td>
                    <td className="py-3 px-3">
                      <span className="bg-[#F5F8F6] border border-[#E4EBE6] px-2.5 py-0.5 rounded-md font-bold uppercase text-[10px]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">{u.city}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          u.status === 'active'
                            ? 'bg-[#E8F7F0] text-[#087A50]'
                            : 'bg-red-100 text-[#D92D20]'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {u.role !== 'admin' && (
                        <button
                          onClick={() =>
                            handleUserStatus(u.id, u.status === 'active' ? 'suspended' : 'active')
                          }
                          className={`font-extrabold text-[11px] ${
                            u.status === 'active' ? 'text-[#D92D20]' : 'text-[#00A86B]'
                          } hover:underline`}
                        >
                          {u.status === 'active' ? 'Suspend Account' : 'Restore Account'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. BIDDING & CAMPAIGN MANAGEMENT */}
      {activeTab === 'bidding' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleUpdateCampaignRules}
            className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4 h-fit"
          >
            <h3 className="text-base font-extrabold text-[#17231E]">Configure Auction Rules</h3>
            <div className="text-xs space-y-3">
              <div>
                <label className="font-bold block mb-1">Minimum Raise Floor ($, step grows 5% with the top bid)</label>
                <input
                  type="number"
                  step="1"
                  value={minIncrement}
                  onChange={e => setMinIncrement(e.target.value)}
                  className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 font-extrabold"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Minimum Opening Bid ($)</label>
                <input
                  type="number"
                  step="1"
                  value={minOpening}
                  onChange={e => setMinOpening(e.target.value)}
                  className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 font-extrabold"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Sponsored Slot Count</label>
                <input
                  type="number"
                  value={slotCount}
                  onChange={e => setSlotCount(e.target.value)}
                  className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 font-extrabold"
                />
              </div>
            </div>
            <button type="submit" className="w-full rh-btn-primary py-3 rounded-xl text-xs font-extrabold">
              Save Bidding Rules
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4">
            <h3 className="text-base font-extrabold text-[#17231E]">All Restaurant Bids Audit</h3>
            <div className="space-y-2.5">
              {(data?.bids || []).map((b: any, i: number) => (
                <div
                  key={b.id}
                  className="p-4 rounded-xl bg-[#F5F8F6] border border-[#E4EBE6] flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#17231E] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                        #{i + 1}
                      </span>
                      <span className="font-extrabold text-[#17231E] text-sm">{b.restaurant_name}</span>
                      <span className="text-[#00A86B] font-extrabold text-sm">
                        ${Number(b.amount).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[#68736D] mt-1">
                      Placed by {b.placed_by_name} • {b.notes || 'Sponsored Placement'} •{' '}
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
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. CONTENT MODERATION */}
      {activeTab === 'moderation' && (
        <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4">
          <h2 className="text-base font-extrabold text-[#17231E]">Review & Content Moderation Queue</h2>
          <div className="space-y-3">
            {(data?.reviews || []).map((rv: any) => (
              <div
                key={rv.id}
                className={`p-4 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-4 ${
                  rv.status === 'reported'
                    ? 'bg-red-50/60 border-red-200'
                    : 'bg-[#F5F8F6] border-[#E4EBE6]'
                }`}
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                        rv.status === 'reported'
                          ? 'bg-[#D92D20] text-white'
                          : rv.status === 'published'
                          ? 'bg-[#E8F7F0] text-[#087A50]'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {rv.status}
                    </span>
                    <span className="font-extrabold text-[#17231E]">{rv.customer_name}</span>
                    <span className="text-[#68736D]">on {rv.restaurant_name}</span>
                    <span className="font-bold text-[#00A86B]">{rv.rating}★</span>
                  </div>
                  <p className="text-[#17231E] font-medium">"{rv.comment}"</p>
                  {rv.report_reason && (
                    <p className="text-[#D92D20] font-bold">Flag Reason: {rv.report_reason}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReviewMod(rv.id, 'published')}
                    className="bg-[#00A86B] text-white px-3 py-1.5 rounded-lg font-extrabold text-[11px]"
                  >
                    Approve / Publish
                  </button>
                  <button
                    onClick={() => handleReviewMod(rv.id, 'rejected')}
                    className="bg-[#D92D20] text-white px-3 py-1.5 rounded-lg font-extrabold text-[11px]"
                  >
                    Remove / Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. FINANCIAL TRANSACTIONS & REFUNDS */}
      {activeTab === 'finance' && (
        <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4">
          <h2 className="text-base font-extrabold text-[#17231E]">
            Financial Ledger, Commissions & Refund Controls
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E4EBE6] text-[#68736D] uppercase text-[10px]">
                  <th className="py-3 px-3">Reference</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Restaurant / User</th>
                  <th className="py-3 px-3">Gross Amount</th>
                  <th className="py-3 px-3">Platform Fee</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4EBE6]">
                {(data?.payments || []).map((p: any) => (
                  <tr key={p.id}>
                    <td className="py-3 px-3 font-extrabold text-[#17231E]">{p.reference}</td>
                    <td className="py-3 px-3 uppercase font-bold text-[#68736D]">{p.related_type}</td>
                    <td className="py-3 px-3">{p.restaurant_name || p.user_name || 'Platform'}</td>
                    <td className="py-3 px-3 font-extrabold text-[#17231E]">
                      ${Number(p.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 font-extrabold text-[#00A86B]">
                      ${Number(p.platform_fee).toFixed(2)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          p.status === 'completed'
                            ? 'bg-[#E8F7F0] text-[#087A50]'
                            : p.status === 'refunded'
                            ? 'bg-red-100 text-[#D92D20]'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      {p.status === 'pending' && (
                        <button
                          onClick={() => handlePaymentStatus(p.id, 'completed')}
                          className="text-[#00A86B] font-extrabold hover:underline"
                        >
                          Mark Settled
                        </button>
                      )}
                      {p.status !== 'refunded' && (
                        <button
                          onClick={() => handlePaymentStatus(p.id, 'refunded')}
                          className="text-[#D92D20] font-extrabold hover:underline"
                        >
                          Issue Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. SYSTEM AUDIT & AI LOGS */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-3">
            <h3 className="text-sm font-extrabold text-[#17231E]">Security & Operations Audit Logs</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(data?.auditLogs || []).map((log: any) => (
                <div key={log.id} className="p-3 rounded-xl bg-[#F5F8F6] border border-[#E4EBE6] text-xs">
                  <div className="flex justify-between font-extrabold text-[#17231E]">
                    <span>{log.action}</span>
                    <span className="text-[10px] uppercase text-[#00A86B]">{log.actor_role}</span>
                  </div>
                  <p className="text-[11px] text-[#68736D] mt-0.5">
                    Entity: {log.entity_type} ({log.entity_id}) • {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-3">
            <h3 className="text-sm font-extrabold text-[#17231E]">AI Usage & Tool Execution Telemetry</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(data?.aiLogs || []).map((ai: any) => (
                <div key={ai.id} className="p-3 rounded-xl bg-[#F5F8F6] border border-[#E4EBE6] text-xs">
                  <div className="flex justify-between font-extrabold text-[#087A50]">
                    <span className="uppercase text-[10px]">{ai.mode}</span>
                    <span className="text-[10px] text-[#68736D]">
                      {new Date(ai.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="font-bold text-[#17231E] mt-1">Prompt: "{ai.prompt}"</p>
                  <p className="text-[11px] text-[#68736D] mt-0.5">{ai.response_summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
