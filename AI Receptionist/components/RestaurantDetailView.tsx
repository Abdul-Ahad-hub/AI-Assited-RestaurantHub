import React, { useState, useEffect } from 'react';
import { MenuItem, Restaurant, RestaurantOffer, RestaurantReview, UserProfile } from '../types';
import { MenuCard } from './MenuCard';
import { apiFetch } from '../services/apiClient';

interface RestaurantDetailViewProps {
  restaurantIdOrSlug: string;
  user: UserProfile | null;
  onBack: () => void;
  onSelectMenuItem: (item: MenuItem, restaurant: Restaurant) => void;
  onOpenVoiceAgent: (restaurant: Restaurant, menuItems: MenuItem[]) => void;
  onOpenAuth: () => void;
}

export const RestaurantDetailView: React.FC<RestaurantDetailViewProps> = ({
  restaurantIdOrSlug,
  user,
  onBack,
  onSelectMenuItem,
  onOpenVoiceAgent,
  onOpenAuth
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string; description: string }[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [offers, setOffers] = useState<RestaurantOffer[]>([]);
  const [reviews, setReviews] = useState<RestaurantReview[]>([]);
  const [isFavourite, setIsFavourite] = useState(false);

  const [activeTab, setActiveTab] = useState<'menu' | 'reviews' | 'info'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [menuSearch, setMenuSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  // Review Form State
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewImageUrl, setReviewImageUrl] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedbackMsg, setReviewFeedbackMsg] = useState('');

  const loadDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/restaurants/${encodeURIComponent(restaurantIdOrSlug)}`);
      setRestaurant(data.restaurant);
      setCategories(data.categories || []);
      setMenuItems(data.menuItems || []);
      setBranches(data.branches || []);
      setOffers(data.offers || []);
      setReviews(data.reviews || []);
      setIsFavourite(Boolean(data.isFavourite));
    } catch (err: any) {
      setError(err?.message || 'Failed to load restaurant details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [restaurantIdOrSlug]);

  const handleToggleFav = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!restaurant) return;
    try {
      const res = await apiFetch('/api/customer/favourites/toggle', {
        method: 'POST',
        body: JSON.stringify({ restaurantId: restaurant.id })
      });
      setIsFavourite(res.isFavourite);
    } catch {}
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!restaurant || !reviewComment.trim()) return;
    setSubmittingReview(true);
    setReviewFeedbackMsg('');
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          restaurantId: restaurant.id,
          rating: reviewRating,
          comment: reviewComment.trim(),
          images: reviewImageUrl.trim() ? [reviewImageUrl.trim()] : []
        })
      });
      setReviewComment('');
      setReviewImageUrl('');
      setReviewFeedbackMsg('Thank you! Your verified review has been published.');
      await loadDetails();
    } catch (err: any) {
      setReviewFeedbackMsg(err?.message || 'Could not submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleHelpful = async (reviewId: string) => {
    try {
      await apiFetch(`/api/reviews/${reviewId}/helpful`, { method: 'POST' });
      setReviews(prev =>
        prev.map(r => (r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r))
      );
    } catch {}
  };

  const handleReportReview = async (reviewId: string) => {
    const reason = window.prompt('Why are you reporting this review? (e.g. Spam, Fake review, Offensive language)');
    if (!reason) return;
    try {
      await apiFetch(`/api/reviews/${reviewId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      alert('Review reported to Platform Moderation.');
    } catch {}
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <i className="fas fa-circle-notch fa-spin text-3xl text-[#00A86B] mb-3"></i>
        <p className="text-sm font-bold text-[#68736D]">Loading restaurant profile & live menu...</p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-white p-8 rounded-2xl border border-[#E4EBE6]">
          <p className="text-base font-extrabold text-[#D92D20] mb-4">{error || 'Restaurant not found'}</p>
          <button onClick={onBack} className="rh-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold">
            ← Back to Discovery
          </button>
        </div>
      </div>
    );
  }

  const filteredMenu = menuItems.filter(item => {
    if (selectedCategory !== 'All' && item.category_id !== selectedCategory && item.category_name !== selectedCategory) {
      return false;
    }
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    return true;
  });

  const popularDishes = menuItems.filter(m => m.is_popular).slice(0, 4);

  return (
    <div className="pb-20">
      {/* Cover Banner */}
      <div className="relative h-64 md:h-80 w-full bg-[#17231E] overflow-hidden">
        <img
          src={restaurant.cover_url}
          alt={restaurant.name}
          className="w-full h-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#17231E]/90 via-[#17231E]/40 to-transparent"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex flex-col justify-between py-6 relative z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="bg-white/95 hover:bg-white text-[#17231E] px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm"
            >
              <i className="fas fa-arrow-left"></i> Back to Restaurants
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleFav}
                className="bg-white/95 hover:bg-white text-[#17231E] px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <i className={`${isFavourite ? 'fas text-[#D92D20]' : 'far'} fa-heart`}></i>
                <span>{isFavourite ? 'Saved' : 'Save'}</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  alert(`Link to ${restaurant.name} copied to clipboard!`);
                }}
                className="bg-white/95 hover:bg-white text-[#17231E] px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <i className="fas fa-share-alt"></i> Share
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 text-white">
            <div className="flex items-center gap-4">
              {restaurant.logo_url && (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border-4 border-white shadow-lg bg-white"
                />
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {restaurant.is_sponsored && (
                    <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md">
                      Sponsored Partner
                    </span>
                  )}
                  <span className="bg-[#00A86B] text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md">
                    {restaurant.cuisine}
                  </span>
                  <span className="text-xs font-bold text-white/90">{restaurant.price_range}</span>
                </div>
                <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2">
                  {restaurant.name}
                  {restaurant.verification_status === 'verified' && (
                    <i className="fas fa-check-circle text-orange-400 text-lg" title="Verified Restaurant"></i>
                  )}
                </h1>
                <p className="text-xs md:text-sm text-white/85 mt-1 max-w-2xl">
                  <i className="fas fa-map-marker-alt text-orange-400 mr-1.5"></i>
                  {restaurant.address} • {restaurant.delivery_time_min}-{restaurant.delivery_time_max} mins • ${restaurant.delivery_fee.toFixed(2)} delivery
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white text-[#17231E] px-4 py-2.5 rounded-xl shadow-md text-center">
                <div className="text-lg font-extrabold text-[#00A86B] flex items-center justify-center gap-1">
                  <i className="fas fa-star text-sm"></i>
                  <span>{restaurant.rating_avg > 0 ? restaurant.rating_avg.toFixed(1) : 'New'}</span>
                </div>
                <p className="text-[10px] font-bold text-[#68736D] uppercase">
                  {restaurant.review_count} Reviews
                </p>
              </div>

              <button
                onClick={() => onOpenVoiceAgent(restaurant, menuItems)}
                className="rh-btn-primary px-5 py-3.5 rounded-xl text-xs md:text-sm font-extrabold shadow-lg flex items-center gap-2.5"
              >
                <i className="fas fa-microphone text-base"></i>
                <span>AI Assistant</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Active Offers Strip */}
        {offers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.map(off => (
              <div
                key={off.id}
                className="bg-[#E8F7F0] border border-[#00A86B]/30 rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#00A86B] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md">
                      Promo Offer
                    </span>
                    <h4 className="text-sm font-extrabold text-[#087A50]">{off.title}</h4>
                  </div>
                  <p className="text-xs text-[#17231E] mt-1">{off.description}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(off.code);
                    setCopiedCode(off.code);
                    setTimeout(() => setCopiedCode(''), 2000);
                  }}
                  className="bg-white border border-[#00A86B] text-[#087A50] px-3 py-2 rounded-xl text-xs font-extrabold shrink-0 hover:bg-[#00A86B] hover:text-white transition-colors"
                >
                  {copiedCode === off.code ? 'Copied!' : off.code}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex items-center justify-between border-b border-[#E4EBE6] gap-4 flex-wrap">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-5 py-3 text-sm font-extrabold border-b-2 transition-colors ${
                activeTab === 'menu'
                  ? 'border-[#00A86B] text-[#00A86B]'
                  : 'border-transparent text-[#68736D] hover:text-[#17231E]'
              }`}
            >
              <i className="fas fa-book-open mr-2"></i>
              Full Menu ({menuItems.length})
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-5 py-3 text-sm font-extrabold border-b-2 transition-colors ${
                activeTab === 'reviews'
                  ? 'border-[#00A86B] text-[#00A86B]'
                  : 'border-transparent text-[#68736D] hover:text-[#17231E]'
              }`}
            >
              <i className="fas fa-star mr-2"></i>
              Reviews ({reviews.length})
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`px-5 py-3 text-sm font-extrabold border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-[#00A86B] text-[#00A86B]'
                  : 'border-transparent text-[#68736D] hover:text-[#17231E]'
              }`}
            >
              <i className="fas fa-info-circle mr-2"></i>
              Hours, Branches & Info
            </button>
          </div>

          {activeTab === 'menu' && (
            <div className="relative w-full sm:w-72 mb-2 sm:mb-0">
              <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#68736D] text-xs"></i>
              <input
                type="text"
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                placeholder={`Search in ${restaurant.name}...`}
                className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:border-[#00A86B] outline-none"
              />
            </div>
          )}
        </div>

        {/* TAB 1: MENU */}
        {activeTab === 'menu' && (
          <div className="space-y-8">
            {/* Popular Dishes Highlight */}
            {popularDishes.length > 0 && selectedCategory === 'All' && !menuSearch && (
              <div>
                <h3 className="text-lg font-extrabold text-[#17231E] mb-4 flex items-center gap-2">
                  <i className="fas fa-fire text-[#00A86B]"></i> Most Popular Dishes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {popularDishes.map(item => (
                    <MenuCard
                      key={`pop_${item.id}`}
                      item={item}
                      onClick={it => onSelectMenuItem(it, restaurant)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setSelectedCategory('All')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                  selectedCategory === 'All'
                    ? 'bg-[#00A86B] text-white'
                    : 'bg-[#F5F8F6] text-[#68736D] hover:text-[#17231E] border border-[#E4EBE6]'
                }`}
              >
                All Categories ({menuItems.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-[#00A86B] text-white'
                      : 'bg-[#F5F8F6] text-[#68736D] hover:text-[#17231E] border border-[#E4EBE6]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            {filteredMenu.length === 0 ? (
              <div className="bg-[#F5F8F6] rounded-2xl p-12 text-center border border-[#E4EBE6]">
                <p className="text-sm font-bold text-[#68736D]">No dishes match your filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredMenu.map(item => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    onClick={it => onSelectMenuItem(it, restaurant)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Write a Review Form */}
            <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] h-fit space-y-4">
              <h3 className="text-base font-extrabold text-[#17231E]">Write a Customer Review</h3>
              <p className="text-xs text-[#68736D]">
                Share your honest experience with {restaurant.name}. Customers with completed orders receive a Verified Order badge.
              </p>

              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#17231E] block mb-1.5">Your Rating</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className={`w-10 h-10 rounded-xl font-extrabold text-sm border transition-all ${
                          reviewRating >= star
                            ? 'bg-[#00A86B] text-white border-[#00A86B]'
                            : 'bg-[#F5F8F6] text-[#68736D] border-[#E4EBE6]'
                        }`}
                      >
                        {star}★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#17231E] block mb-1.5">Your Review *</label>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder="What did you order and how was the taste, portion, and delivery?"
                    className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl p-3.5 text-xs h-28 resize-none focus:border-[#00A86B] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#17231E] block mb-1.5">
                    Food Photo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={reviewImageUrl}
                    onChange={e => setReviewImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#F5F8F6] border border-[#E4EBE6] rounded-xl px-3.5 py-2.5 text-xs focus:border-[#00A86B] outline-none"
                  />
                </div>

                {reviewFeedbackMsg && (
                  <p className="text-xs font-bold text-[#00A86B] bg-[#E8F7F0] p-3 rounded-xl">
                    {reviewFeedbackMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full rh-btn-primary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider"
                >
                  {submittingReview ? 'Submitting...' : user ? 'Publish Review' : 'Sign In to Publish Review'}
                </button>
              </form>
            </div>

            {/* Reviews List */}
            <div className="lg:col-span-2 space-y-4">
              {reviews.length === 0 ? (
                <div className="bg-[#F5F8F6] rounded-2xl p-10 text-center border border-[#E4EBE6]">
                  <p className="text-sm font-bold text-[#68736D]">No reviews yet. Be the first to review!</p>
                </div>
              ) : (
                reviews.map(rev => (
                  <div key={rev.id} className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-[#17231E]">{rev.customer_name}</span>
                          {rev.is_verified_order && (
                            <span className="bg-[#E8F7F0] text-[#087A50] text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                              <i className="fas fa-check-circle mr-1"></i> Verified Order
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#68736D]">
                          {new Date(rev.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="bg-[#E8F7F0] text-[#087A50] px-2.5 py-1 rounded-lg text-xs font-extrabold">
                        {'★'.repeat(rev.rating)} {rev.rating}.0
                      </div>
                    </div>

                    <p className="text-sm text-[#17231E] leading-relaxed">{rev.comment}</p>

                    {rev.images && rev.images.length > 0 && (
                      <div className="flex gap-2 pt-1">
                        {rev.images.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt="Review attachment"
                            className="w-24 h-24 rounded-xl object-cover border border-[#E4EBE6]"
                          />
                        ))}
                      </div>
                    )}

                    {rev.owner_reply && (
                      <div className="bg-[#F5F8F6] border-l-4 border-[#00A86B] p-3.5 rounded-r-xl mt-2">
                        <p className="text-[11px] font-extrabold text-[#087A50] mb-1">
                          Response from {restaurant.name}
                        </p>
                        <p className="text-xs text-[#17231E]">{rev.owner_reply}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-[#E4EBE6] flex items-center justify-between text-xs text-[#68736D]">
                      <button
                        onClick={() => handleHelpful(rev.id)}
                        className="font-semibold hover:text-[#00A86B] flex items-center gap-1.5"
                      >
                        <i className="far fa-thumbs-up"></i> Helpful ({rev.helpful_count})
                      </button>
                      <button
                        onClick={() => handleReportReview(rev.id)}
                        className="font-semibold hover:text-[#D92D20] flex items-center gap-1"
                      >
                        <i className="far fa-flag"></i> Report
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: RESTAURANT INFO, GALLERY, HOURS & BRANCHES */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6] space-y-4">
              <h3 className="text-base font-extrabold text-[#17231E]">About {restaurant.name}</h3>
              <p className="text-sm text-[#68736D] leading-relaxed">{restaurant.description}</p>

              <div className="space-y-2 pt-2 border-t border-[#E4EBE6] text-xs">
                <p className="flex items-center justify-between py-1">
                  <span className="text-[#68736D] font-semibold">Primary Cuisine</span>
                  <span className="font-bold text-[#17231E]">{restaurant.cuisine}</span>
                </p>
                <p className="flex items-center justify-between py-1">
                  <span className="text-[#68736D] font-semibold">Address</span>
                  <span className="font-bold text-[#17231E]">{restaurant.address}</span>
                </p>
                <p className="flex items-center justify-between py-1">
                  <span className="text-[#68736D] font-semibold">Contact Phone</span>
                  <span className="font-bold text-[#00A86B]">{restaurant.phone}</span>
                </p>
                <p className="flex items-center justify-between py-1">
                  <span className="text-[#68736D] font-semibold">Available Services</span>
                  <span className="font-bold text-[#17231E] capitalize">
                    {Object.entries(restaurant.services || {})
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ')}
                  </span>
                </p>
              </div>

              {restaurant.gallery && restaurant.gallery.length > 0 && (
                <div className="pt-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#68736D] mb-2.5">
                    Restaurant Photo Gallery
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {restaurant.gallery.map((g, idx) => (
                      <img
                        key={idx}
                        src={g}
                        alt={`${restaurant.name} gallery ${idx + 1}`}
                        className="h-24 w-full object-cover rounded-xl border border-[#E4EBE6]"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Opening Hours */}
              <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6]">
                <h3 className="text-base font-extrabold text-[#17231E] mb-4">
                  <i className="far fa-clock text-[#00A86B] mr-2"></i> Opening Hours
                </h3>
                <div className="space-y-2 text-xs">
                  {Object.entries(restaurant.opening_hours || {}).map(([day, hrs]) => (
                    <div key={day} className="flex justify-between py-1 border-b border-[#F5F8F6]">
                      <span className="capitalize font-bold text-[#17231E]">{day}</span>
                      <span className="text-[#68736D] font-semibold">{hrs}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Branches */}
              {branches.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-[#E4EBE6]">
                  <h3 className="text-base font-extrabold text-[#17231E] mb-4">
                    <i className="fas fa-code-branch text-[#00A86B] mr-2"></i> Branches ({branches.length})
                  </h3>
                  <div className="space-y-3">
                    {branches.map(b => (
                      <div key={b.id} className="p-3.5 rounded-xl bg-[#F5F8F6] border border-[#E4EBE6] text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-[#17231E]">{b.name}</span>
                          {b.is_main ? (
                            <span className="text-[10px] font-bold bg-[#E8F7F0] text-[#087A50] px-2 py-0.5 rounded-md">
                              Flagship
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[#68736D] mt-1">{b.address}</p>
                        <p className="text-[#00A86B] font-semibold mt-1">
                          {b.phone} • {b.opening_hours}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
