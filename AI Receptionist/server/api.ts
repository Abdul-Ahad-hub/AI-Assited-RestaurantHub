import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb, recalculateRestaurantRating } from './db';
import { ensureSeeded, SEED_USER_IDS, SEED_RESTAURANT_IDS } from './seed';
import { getMinNextBid, roundMoney } from './bidding';
import {
  getAuthUserFromRequest,
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  logAudit,
  createNotification,
  type AuthUser
} from './auth';
import {
  generateMenuDraftFromPrompt,
  runCustomerDiscoveryAI,
  runRestaurantOwnerAssistant,
  processVoiceCommandAI
} from './ai';
import { getNeonStatus, mirrorOrderToNeon } from './neonDb';

function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export const DUMMY_AI_MESSAGE_LIMIT = 5;
const dummyAiUsageBySession = new Map<string, number>();

function isRealNonDummyUser(user: AuthUser | null): boolean {
  return Boolean(user && !SEED_USER_IDS.has(user.id));
}

function getDummyAiSessionKey(req: IncomingMessage): string {
  const authHeader = String(req.headers['authorization'] || '');
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return `tok:${token}`;
  }
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const remoteIp = forwarded || req.socket?.remoteAddress || 'anon';
  return `ip:${remoteIp}`;
}

function getDummyAiUsage(req: IncomingMessage, user: AuthUser | null) {
  if (isRealNonDummyUser(user)) {
    return { isDemo: false, used: 0, limit: null as number | null, remaining: null as number | null };
  }
  const key = getDummyAiSessionKey(req);
  const used = dummyAiUsageBySession.get(key) || 0;
  return {
    isDemo: true,
    used,
    limit: DUMMY_AI_MESSAGE_LIMIT,
    remaining: Math.max(0, DUMMY_AI_MESSAGE_LIMIT - used)
  };
}

function consumeDummyAiQuota(req: IncomingMessage, user: AuthUser | null) {
  if (isRealNonDummyUser(user)) {
    return { allowed: true, isDemo: false, used: 0, limit: null as number | null, remaining: null as number | null };
  }
  const key = getDummyAiSessionKey(req);
  const used = dummyAiUsageBySession.get(key) || 0;
  if (used >= DUMMY_AI_MESSAGE_LIMIT) {
    return {
      allowed: false,
      isDemo: true,
      used,
      limit: DUMMY_AI_MESSAGE_LIMIT,
      remaining: 0
    };
  }
  const nextUsed = used + 1;
  dummyAiUsageBySession.set(key, nextUsed);
  return {
    allowed: true,
    isDemo: true,
    used: nextUsed,
    limit: DUMMY_AI_MESSAGE_LIMIT,
    remaining: Math.max(0, DUMMY_AI_MESSAGE_LIMIT - nextUsed)
  };
}

function formatPublicRestaurant(row: any, activeBidAmount?: number | null, bidRank?: number) {
  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    cuisine: row.cuisine,
    secondary_cuisines: safeJsonParse<string[]>(row.secondary_cuisines, []),
    price_range: row.price_range,
    city: row.city,
    area: row.area,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    email: row.email,
    opening_hours: safeJsonParse<Record<string, string>>(row.opening_hours_json, {}),
    services: safeJsonParse<Record<string, boolean>>(row.services_json, {}),
    logo_url: row.logo_url,
    cover_url: row.cover_url,
    gallery: safeJsonParse<string[]>(row.gallery_json, []),
    rating_avg: Number(row.rating_avg || 0),
    review_count: Number(row.review_count || 0),
    verification_status: row.verification_status,
    approval_status: row.approval_status,
    is_featured: Boolean(row.is_featured),
    is_trending: Boolean(row.is_trending),
    is_sponsored: Boolean(activeBidAmount && activeBidAmount > 0),
    bid_rank: bidRank,
    delivery_fee: Number(row.delivery_fee || 0),
    min_order: Number(row.min_order || 0),
    delivery_time_min: Number(row.delivery_time_min || 25),
    delivery_time_max: Number(row.delivery_time_max || 40),
    created_at: row.created_at
  };
}

function formatFoodItem(row: any) {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    restaurant_name: row.restaurant_name || undefined,
    restaurant_slug: row.restaurant_slug || undefined,
    restaurant_city: row.restaurant_city || undefined,
    restaurant_rating: row.restaurant_rating !== undefined ? Number(row.restaurant_rating) : undefined,
    category_id: row.category_id,
    category_name: row.category_name || undefined,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    discounted_price: row.discounted_price !== null && row.discounted_price !== undefined ? Number(row.discounted_price) : null,
    image_url: row.image_url,
    cuisine: row.cuisine,
    tags: safeJsonParse<string[]>(row.tags_json, []),
    variations: safeJsonParse<{ name: string; priceDelta: number }[]>(row.variations_json, []),
    addons: safeJsonParse<{ name: string; price: number }[]>(row.addons_json, []),
    is_available: Boolean(row.is_available),
    is_popular: Boolean(row.is_popular),
    is_trending: Boolean(row.is_trending),
    order_count: Number(row.order_count || 0),
    sort_order: Number(row.sort_order || 0)
  };
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const rawUrl = req.url || '';
  if (!rawUrl.startsWith('/api/')) {
    return false;
  }

  ensureSeeded();
  const db = getDb();
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();
  const user = getAuthUserFromRequest(req);

  try {
    // =========================================================================
    // 1. AUTHENTICATION & SESSION ENDPOINTS
    // =========================================================================
    if (pathname === '/api/auth/me' && method === 'GET') {
      if (!user) {
        sendJson(res, 200, { user: null, ownedRestaurants: [], unreadNotifications: 0 });
        return true;
      }
      const ownedRestaurants = user.role === 'restaurant_owner' || user.role === 'admin'
        ? db.prepare(`SELECT id, name, slug, approval_status, verification_status, city, cuisine, rating_avg FROM restaurants WHERE owner_id = ? ORDER BY created_at ASC`).all(user.id)
        : [];
      const unreadRow = db.prepare(`
        SELECT COUNT(*) as cnt FROM notifications
        WHERE (user_id = ? OR (role_target != '' AND role_target = ?)) AND is_read = 0
      `).get(user.id, user.role) as { cnt: number };

      sendJson(res, 200, {
        user,
        ownedRestaurants,
        unreadNotifications: Number(unreadRow?.cnt || 0),
        isDemoUser: SEED_USER_IDS.has(user.id),
        demoAiUsage: getDummyAiUsage(req, user)
      });
      return true;
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      const row = db.prepare(`SELECT * FROM users WHERE LOWER(email) = ?`).get(email) as any;
      if (!row || !verifyPassword(password, row.password_hash)) {
        sendJson(res, 401, { error: 'Invalid email or password.' });
        return true;
      }
      if (row.status === 'suspended') {
        sendJson(res, 403, { error: 'This account has been suspended by platform administration.' });
        return true;
      }

      const token = createSession(row.id);
      logAudit(row.id, row.role, 'USER_LOGIN', 'user', row.id, { email: row.email });

      const ownedRestaurants = row.role === 'restaurant_owner' || row.role === 'admin'
        ? db.prepare(`SELECT id, name, slug, approval_status, verification_status, city, cuisine, rating_avg FROM restaurants WHERE owner_id = ?`).all(row.id)
        : [];

      sendJson(res, 200, {
        token,
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          phone: row.phone,
          city: row.city,
          address: row.address,
          avatar_url: row.avatar_url,
          status: row.status,
          preferences: safeJsonParse(row.preferences_json, {})
        },
        ownedRestaurants
      });
      return true;
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const role = body.role === 'restaurant_owner' ? 'restaurant_owner' : 'customer';
      const phone = String(body.phone || '').trim();
      const city = String(body.city || 'Karachi').trim();
      const address = String(body.address || '').trim();

      if (!name || !email || password.length < 6) {
        sendJson(res, 400, { error: 'Name, valid email, and password (min 6 chars) are required.' });
        return true;
      }

      const existing = db.prepare(`SELECT id FROM users WHERE LOWER(email) = ?`).get(email);
      if (existing) {
        sendJson(res, 409, { error: 'An account with this email already exists.' });
        return true;
      }

      const userId = `usr_${crypto.randomUUID().slice(0, 10)}`;
      const now = new Date().toISOString();
      const passHash = hashPassword(password);

      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, phone, city, address, avatar_url, status, preferences_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 'active', '{}', ?, ?)
      `).run(userId, name, email, passHash, role, phone, city, address, now, now);

      // If registering as restaurant owner and restaurant details are provided, onboard restaurant too
      let createdRestaurantId: string | null = null;
      if (role === 'restaurant_owner' && body.restaurantName) {
        const restName = String(body.restaurantName).trim();
        const slug = `${restName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
        createdRestaurantId = `rest_${crypto.randomUUID().slice(0, 10)}`;
        const cuisine = String(body.cuisine || 'Pakistani & Mughal').trim();
        const restAddress = String(body.restaurantAddress || address || `${city} Central`).trim();

        db.prepare(`
          INSERT INTO restaurants (
            id, owner_id, name, slug, description, cuisine, secondary_cuisines, price_range,
            city, area, address, phone, email, opening_hours_json, services_json,
            logo_url, cover_url, verification_status, approval_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)
        `).run(
          createdRestaurantId,
          userId,
          restName,
          slug,
          String(body.restaurantDescription || `Welcome to ${restName}, serving fresh ${cuisine} specialties.`),
          cuisine,
          String(body.priceRange || '$$'),
          city,
          String(body.area || 'Main Commercial'),
          restAddress,
          phone || '+92 300 0000000',
          email,
          JSON.stringify({ monday: '11:00 AM - 11:00 PM', friday: '12:00 PM - 12:00 AM' }),
          JSON.stringify({ delivery: true, pickup: true, dineIn: true, halal: true }),
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
          now,
          now
        );

        // Default categories
        db.prepare(`INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at) VALUES (?, ?, 'Main Course', 'Signature dishes', 1, 1, ?)`).run(`cat_${crypto.randomUUID().slice(0, 8)}`, createdRestaurantId, now);
        db.prepare(`INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at) VALUES (?, ?, 'Appetizers & Sides', 'Starters and accompaniments', 2, 1, ?)`).run(`cat_${crypto.randomUUID().slice(0, 8)}`, createdRestaurantId, now);

        createNotification({
          roleTarget: 'admin',
          restaurantId: createdRestaurantId,
          type: 'restaurant_onboarding',
          title: `New Restaurant Onboarding: ${restName}`,
          message: `${name} registered "${restName}" in ${city}. Please verify and approve.`,
          linkView: 'admin'
        });
      }

      const token = createSession(userId);
      logAudit(userId, role, 'USER_REGISTER', 'user', userId, { email, role, createdRestaurantId });

      const ownedRestaurants = role === 'restaurant_owner'
        ? db.prepare(`SELECT id, name, slug, approval_status, verification_status, city, cuisine, rating_avg FROM restaurants WHERE owner_id = ?`).all(userId)
        : [];

      sendJson(res, 201, {
        token,
        user: { id: userId, name, email, role, phone, city, address, avatar_url: '', status: 'active', preferences: {} },
        ownedRestaurants
      });
      return true;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        deleteSession(authHeader.slice(7).trim());
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (pathname === '/api/auth/profile' && method === 'PUT') {
      if (!user) return sendJson(res, 401, { error: 'Authentication required' }), true;
      const body = await parseBody(req);
      const name = String(body.name || user.name).trim();
      const phone = String(body.phone ?? user.phone).trim();
      const city = String(body.city || user.city).trim();
      const address = String(body.address ?? user.address).trim();
      const preferences = body.preferences || user.preferences || {};

      db.prepare(`
        UPDATE users
        SET name = ?, phone = ?, city = ?, address = ?, preferences_json = ?, updated_at = ?
        WHERE id = ?
      `).run(name, phone, city, address, JSON.stringify(preferences), new Date().toISOString(), user.id);

      sendJson(res, 200, {
        user: { ...user, name, phone, city, address, preferences }
      });
      return true;
    }

    // =========================================================================
    // 2. CUSTOMER HOMEPAGE & DISCOVERY ENDPOINTS
    // =========================================================================
    if (pathname === '/api/discovery/home' && method === 'GET') {
      const city = parsedUrl.searchParams.get('city') || 'All';
      const hideDummyData = isRealNonDummyUser(user);

      // Get all approved restaurants with their active campaign bid (for ranking order only)
      const allRows = db.prepare(`
        SELECT r.*,
          (
            SELECT MAX(b.amount)
            FROM bids b
            JOIN ranking_campaigns c ON c.id = b.campaign_id
            WHERE b.restaurant_id = r.id
              AND c.status = 'active'
              AND b.status IN ('leading', 'active_runner_up')
          ) as active_bid_amount
        FROM restaurants r
        WHERE r.approval_status = 'approved'
        ORDER BY r.rating_avg DESC, r.review_count DESC
      `).all() as any[];

      const rows = hideDummyData
        ? allRows.filter(r => !SEED_RESTAURANT_IDS.has(r.id))
        : allRows;

      // Sort all rows by highest active bid first, then rating
      const bidSortedRows = [...rows].sort((a, b) => {
        const bidDiff = Number(b.active_bid_amount || 0) - Number(a.active_bid_amount || 0);
        if (bidDiff !== 0) return bidDiff;
        return Number(b.rating_avg) - Number(a.rating_avg);
      });

      const formattedAll = bidSortedRows.map((r, index) => {
        return formatPublicRestaurant(r, r.active_bid_amount, index + 1);
      });

      const cityFiltered = city && city !== 'All'
        ? formattedAll.filter(r => r.city.toLowerCase() === city.toLowerCase())
        : formattedAll;
      const pool = (cityFiltered.length > 0 ? cityFiltered : formattedAll).map((r, idx) => ({
        ...r,
        bid_rank: idx + 1
      }));

      // Sponsored / Bidding Leaderboard Restaurants (Ranked strictly by active bid descending)
      const sponsoredRestaurants = pool.filter(r => r.is_sponsored || r.is_featured);

      // Best Restaurants (Ranked 1 per row by highest active bid first, then merit)
      const topRated = pool.slice(0, 8);

      // Nearby Restaurants
      const nearby = [...pool].sort((a, b) => a.delivery_time_min - b.delivery_time_min).slice(0, 6);

      // Trending Restaurants
      const trendingRestaurants = pool.filter(r => r.is_trending).concat(pool.filter(r => !r.is_trending)).slice(0, 6);

      // Recently Added
      const recentlyAdded = [...pool].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4);

      // Trending Food Items across restaurants
      const allFoodRows = db.prepare(`
        SELECT f.*, r.name as restaurant_name, r.slug as restaurant_slug, r.city as restaurant_city, r.rating_avg as restaurant_rating
        FROM food_items f
        JOIN restaurants r ON r.id = f.restaurant_id
        WHERE r.approval_status = 'approved' AND f.is_available = 1
        ORDER BY f.is_trending DESC, f.order_count DESC
        LIMIT 24
      `).all() as any[];

      const foodRows = hideDummyData
        ? allFoodRows.filter(f => !SEED_RESTAURANT_IDS.has(f.restaurant_id))
        : allFoodRows;

      const trendingFood = foodRows
        .filter(f => city === 'All' || f.restaurant_city.toLowerCase() === city.toLowerCase() || foodRows.length <= 4)
        .slice(0, 8)
        .map(formatFoodItem);

      // Popular Cuisines aggregation
      const cuisineMap = new Map<string, { name: string; count: number; image: string }>();
      const cuisineImages: Record<string, string> = {
        'Pakistani & Mughal': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80',
        'Burgers & American': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
        'Italian & Pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80',
        'Pan-Asian & Sushi': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80',
        'Middle Eastern & Arabian': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=400&q=80',
        'Cafe & Healthy': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80'
      };

      formattedAll.forEach(r => {
        const existing = cuisineMap.get(r.cuisine);
        if (existing) {
          existing.count += 1;
        } else {
          cuisineMap.set(r.cuisine, {
            name: r.cuisine,
            count: 1,
            image: cuisineImages[r.cuisine] || r.cover_url
          });
        }
      });

      // Active Special Offers
      const allOfferRows = db.prepare(`
        SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug, r.cover_url as restaurant_cover, r.city as restaurant_city
        FROM offers o
        JOIN restaurants r ON r.id = o.restaurant_id
        WHERE o.is_active = 1 AND r.approval_status = 'approved'
        ORDER BY o.discount_value DESC
      `).all() as any[];

      const offerRows = hideDummyData
        ? allOfferRows.filter(o => !SEED_RESTAURANT_IDS.has(o.restaurant_id))
        : allOfferRows;

      // Favourite IDs for current user
      let favouriteIds: string[] = [];
      if (user) {
        const favs = db.prepare(`SELECT restaurant_id FROM favourites WHERE user_id = ?`).all(user.id) as { restaurant_id: string }[];
        favouriteIds = favs.map(f => f.restaurant_id);
      }

      // Live Orders for the currently logged in user only (no hardcoded orders!)
      let liveOrders: any[] = [];
      if (user) {
        const recentOrderRows = user.role === 'restaurant_owner'
          ? db.prepare(`
              SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug, r.logo_url as restaurant_logo
              FROM orders o
              JOIN restaurants r ON r.id = o.restaurant_id
              WHERE r.owner_id = ?
              ORDER BY o.created_at DESC LIMIT 10
            `).all(user.id) as any[]
          : db.prepare(`
              SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug, r.logo_url as restaurant_logo
              FROM orders o
              JOIN restaurants r ON r.id = o.restaurant_id
              WHERE o.customer_id = ?
              ORDER BY o.created_at DESC LIMIT 10
            `).all(user.id) as any[];

        const getOrderItemsStmt = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`);
        liveOrders = recentOrderRows.map(o => ({
          ...o,
          address: o.delivery_address,
          phone: o.customer_phone,
          timestamp: o.created_at,
          items: (getOrderItemsStmt.all(o.id) as any[]).map(it => ({
            id: it.id,
            name: it.name,
            quantity: it.quantity,
            price: it.unit_price,
            lineTotal: it.line_total
          }))
        }));
      }

      // Bidding Overview is ONLY returned to restaurant_owner or admin (never to customers!)
      let biddingOverview: any = undefined;
      if (user && (user.role === 'restaurant_owner' || user.role === 'admin')) {
        const activeCampaign = db.prepare(`
          SELECT * FROM ranking_campaigns WHERE status = 'active' ORDER BY created_at DESC LIMIT 1
        `).get() as any;

        const recentBids = db.prepare(`
          SELECT b.*, r.name as restaurant_name, r.cuisine as restaurant_cuisine, r.city as restaurant_city
          FROM bids b
          JOIN restaurants r ON r.id = b.restaurant_id
          ORDER BY b.amount DESC, b.created_at DESC
          LIMIT 10
        `).all() as any[];

        const highestBid = recentBids.length > 0 ? Number(recentBids[0].amount) : 0;
        const stepFloor = Number(activeCampaign?.min_bid_increment || 0);
        const openingBid = Number(activeCampaign?.min_opening_bid || 0);
        const minNextBid = getMinNextBid(highestBid, { openingBid, stepFloor });
        const minIncrement = highestBid > 0 ? roundMoney(minNextBid - highestBid) : minNextBid;

        biddingOverview = {
          campaignTitle: activeCampaign?.title || 'Homepage & Best Restaurants #1 Placement Auction',
          slotCount: Number(activeCampaign?.slot_count || 3),
          highestBid,
          minIncrement,
          minNextBid,
          leadingRestaurant: formattedAll[0] || null,
          recentBids,
          allRestaurants: bidSortedRows.map((r, idx) => ({
            id: r.id,
            name: r.name,
            city: r.city,
            cuisine: r.cuisine,
            activeBid: Number(r.active_bid_amount || 0),
            bidRank: idx + 1
          }))
        };
      }

      sendJson(res, 200, {
        sponsoredRestaurants,
        topRated,
        nearby,
        trendingRestaurants,
        recentlyAdded,
        trendingFood,
        popularCuisines: Array.from(cuisineMap.values()),
        specialOffers: offerRows,
        favouriteIds,
        liveOrders,
        biddingOverview,
        neonStatus: getNeonStatus(),
        cities: ['All', 'Karachi', 'Lahore', 'Islamabad']
      });
      return true;
    }

    // Quick Live Bid Placement from the Bidding screen (restaurant owners and admins only)
    if (pathname === '/api/bidding/public-bid' && method === 'POST') {
      if (!user) return sendJson(res, 401, { error: 'Authentication required' }), true;
      if (user.role !== 'restaurant_owner' && user.role !== 'admin') {
        return sendJson(res, 403, { error: 'Bidding is available to restaurant accounts only.' }), true;
      }
      const body = await parseBody(req);
      const restaurantId = String(body.restaurantId || '').trim();
      const amount = Math.round(Number(body.amount) * 100) / 100;
      const notes = String(body.notes || 'Live Spotlight Bid').trim();

      const restaurant = db.prepare(`SELECT * FROM restaurants WHERE id = ?`).get(restaurantId) as any;
      if (!restaurant) {
        return sendJson(res, 404, { error: 'Restaurant not found.' }), true;
      }
      if (user.role !== 'admin' && restaurant.owner_id !== user.id) {
        return sendJson(res, 403, { error: 'You can only bid for your own restaurant.' }), true;
      }

      const campaign = db.prepare(`SELECT * FROM ranking_campaigns WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`).get() as any;
      if (!campaign) {
        return sendJson(res, 400, { error: 'No active ranking campaign found.' }), true;
      }

      db.exec('BEGIN IMMEDIATE;');
      try {
        const leadingRow = db.prepare(`
          SELECT id, restaurant_id, amount
          FROM bids
          WHERE campaign_id = ? AND status IN ('leading', 'active_runner_up')
          ORDER BY amount DESC LIMIT 1
        `).get(campaign.id) as { id: string; restaurant_id: string; amount: number } | undefined;

        const currentLeadingBid = leadingRow ? Number(leadingRow.amount) : 0;
        const bidOpts = {
          openingBid: Number(campaign.min_opening_bid || 0),
          stepFloor: Number(campaign.min_bid_increment || 0)
        };
        const minRequired = getMinNextBid(currentLeadingBid, bidOpts);

        if (isNaN(amount) || amount < minRequired) {
          db.exec('ROLLBACK;');
          return sendJson(res, 400, {
            error: `Bid must be at least $${minRequired.toFixed(2)} (current top bid is $${currentLeadingBid.toFixed(2)}).`
          }), true;
        }

        const now = new Date().toISOString();
        const bidId = `bid_${crypto.randomUUID().slice(0, 10)}`;

        db.prepare(`UPDATE bids SET status = 'active_runner_up' WHERE campaign_id = ? AND status = 'leading'`).run(campaign.id);
        db.prepare(`
          INSERT INTO bids (id, campaign_id, restaurant_id, amount, status, payment_status, placed_by_user_id, notes, created_at)
          VALUES (?, ?, ?, ?, 'leading', 'paid', ?, ?, ?)
        `).run(bidId, campaign.id, restaurantId, amount, user.id, notes, now);

        db.prepare(`UPDATE restaurants SET is_featured = 1, updated_at = ? WHERE id = ?`).run(now, restaurantId);
        db.exec('COMMIT;');

        return sendJson(res, 201, {
          ok: true,
          bidId,
          amount,
          restaurantName: restaurant.name,
          nextMinimumBid: getMinNextBid(amount, bidOpts)
        }), true;
      } catch (err: any) {
        try {
          db.exec('ROLLBACK;');
        } catch {}
        return sendJson(res, 500, { error: err?.message || 'Failed to place bid' }), true;
      }
    }

    // =========================================================================
    // 3. RESTAURANT SEARCH & FILTER ENDPOINT
    // =========================================================================
    if (pathname === '/api/restaurants' && method === 'GET') {
      const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
      const city = parsedUrl.searchParams.get('city') || 'All';
      const cuisine = parsedUrl.searchParams.get('cuisine') || 'All';
      const priceRange = parsedUrl.searchParams.get('priceRange') || 'All';
      const minRating = Number(parsedUrl.searchParams.get('minRating') || 0);
      const service = parsedUrl.searchParams.get('service') || '';
      const sortBy = parsedUrl.searchParams.get('sortBy') || 'recommended';
      const hideDummyData = isRealNonDummyUser(user);

      const allRows = db.prepare(`
        SELECT r.*,
          (
            SELECT MAX(b.amount)
            FROM bids b
            JOIN ranking_campaigns c ON c.id = b.campaign_id
            WHERE b.restaurant_id = r.id
              AND c.status = 'active'
              AND b.status IN ('leading', 'active_runner_up')
          ) as active_bid_amount
        FROM restaurants r
        WHERE r.approval_status = 'approved'
      `).all() as any[];

      const rows = hideDummyData
        ? allRows.filter(r => !SEED_RESTAURANT_IDS.has(r.id))
        : allRows;

      // Also match food item names if query is provided
      let matchingRestaurantIdsByFood = new Set<string>();
      if (q) {
        const foodMatches = db.prepare(`
          SELECT DISTINCT restaurant_id FROM food_items
          WHERE is_available = 1 AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(cuisine) LIKE ?)
        `).all(`%${q}%`, `%${q}%`, `%${q}%`) as { restaurant_id: string }[];
        matchingRestaurantIdsByFood = new Set(foodMatches.map(f => f.restaurant_id));
      }

      let results = rows.filter(r => {
        if (city !== 'All' && r.city.toLowerCase() !== city.toLowerCase()) return false;
        if (cuisine !== 'All' && r.cuisine.toLowerCase() !== cuisine.toLowerCase()) {
          const sec = safeJsonParse<string[]>(r.secondary_cuisines, []);
          if (!sec.some(s => s.toLowerCase().includes(cuisine.toLowerCase()))) return false;
        }
        if (priceRange !== 'All' && r.price_range !== priceRange) return false;
        if (minRating > 0 && Number(r.rating_avg) < minRating) return false;
        if (service) {
          const srv = safeJsonParse<Record<string, boolean>>(r.services_json, {});
          if (!srv[service]) return false;
        }
        if (q) {
          const hay = `${r.name} ${r.description} ${r.cuisine} ${r.secondary_cuisines} ${r.city} ${r.area}`.toLowerCase();
          if (!hay.includes(q) && !matchingRestaurantIdsByFood.has(r.id)) return false;
        }
        return true;
      });

      // Sort
      results.sort((a, b) => {
        if (sortBy === 'rating') return Number(b.rating_avg) - Number(a.rating_avg);
        if (sortBy === 'delivery_time') return Number(a.delivery_time_min) - Number(b.delivery_time_min);
        if (sortBy === 'price_low') return a.price_range.length - b.price_range.length;
        // 'recommended' / 'bidding': Highest bidding restaurants first, then rating
        const bidDiff = Number(b.active_bid_amount || 0) - Number(a.active_bid_amount || 0);
        if (bidDiff !== 0) return bidDiff;
        return Number(b.rating_avg) - Number(a.rating_avg);
      });

      // Increment search_appearances for matched restaurants
      const updateSearchStmt = db.prepare(`UPDATE restaurants SET search_appearances = search_appearances + 1 WHERE id = ?`);
      results.forEach(r => updateSearchStmt.run(r.id));

      sendJson(res, 200, {
        restaurants: results.map((r, index) => formatPublicRestaurant(r, r.active_bid_amount, index + 1)),
        total: results.length
      });
      return true;
    }

    // =========================================================================
    // 4. RESTAURANT DETAIL PAGE ENDPOINT
    // =========================================================================
    const restDetailMatch = pathname.match(/^\/api\/restaurants\/([^/]+)$/);
    if (restDetailMatch && method === 'GET') {
      const idOrSlug = decodeURIComponent(restDetailMatch[1]);
      const row = db.prepare(`
        SELECT r.*,
          (
            SELECT MAX(b.amount)
            FROM bids b
            JOIN ranking_campaigns c ON c.id = b.campaign_id
            WHERE b.restaurant_id = r.id
              AND c.status = 'active'
              AND b.status IN ('leading', 'active_runner_up')
          ) as active_bid_amount
        FROM restaurants r
        WHERE r.id = ? OR r.slug = ?
      `).get(idOrSlug, idOrSlug) as any;

      if (!row) {
        sendJson(res, 404, { error: 'Restaurant not found' });
        return true;
      }

      // Increment profile_views and menu_views
      db.prepare(`UPDATE restaurants SET profile_views = profile_views + 1, menu_views = menu_views + 1 WHERE id = ?`).run(row.id);

      const categories = db.prepare(`
        SELECT * FROM menu_categories WHERE restaurant_id = ? AND is_active = 1 ORDER BY sort_order ASC, created_at ASC
      `).all(row.id) as any[];

      const foodRows = db.prepare(`
        SELECT f.*, c.name as category_name
        FROM food_items f
        JOIN menu_categories c ON c.id = f.category_id
        WHERE f.restaurant_id = ?
        ORDER BY f.sort_order ASC, f.created_at ASC
      `).all(row.id) as any[];

      const branches = db.prepare(`
        SELECT * FROM restaurant_branches WHERE restaurant_id = ? AND status = 'active' ORDER BY is_main DESC
      `).all(row.id) as any[];

      const offers = db.prepare(`
        SELECT * FROM offers WHERE restaurant_id = ? AND is_active = 1
      `).all(row.id) as any[];

      const reviews = db.prepare(`
        SELECT * FROM reviews WHERE restaurant_id = ? AND status = 'published' ORDER BY created_at DESC
      `).all(row.id) as any[];

      let isFavourite = false;
      if (user) {
        const fav = db.prepare(`SELECT id FROM favourites WHERE user_id = ? AND restaurant_id = ?`).get(user.id, row.id);
        isFavourite = Boolean(fav);
      }

      sendJson(res, 200, {
        restaurant: formatPublicRestaurant(row, row.active_bid_amount),
        categories,
        menuItems: foodRows.map(formatFoodItem),
        branches,
        offers,
        reviews: reviews.map(rv => ({
          ...rv,
          images: safeJsonParse<string[]>(rv.images_json, []),
          is_verified_order: Boolean(rv.is_verified_order)
        })),
        isFavourite
      });
      return true;
    }

    // =========================================================================
    // 5. INDEPENDENT FOOD DISCOVERY ENDPOINT
    // =========================================================================
    if (pathname === '/api/foods' && method === 'GET') {
      const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
      const cuisine = parsedUrl.searchParams.get('cuisine') || 'All';
      const city = parsedUrl.searchParams.get('city') || 'All';
      const maxPrice = Number(parsedUrl.searchParams.get('maxPrice') || 0);
      const sortBy = parsedUrl.searchParams.get('sortBy') || 'popular';
      const hideDummyData = isRealNonDummyUser(user);

      const allRows = db.prepare(`
        SELECT f.*, c.name as category_name, r.name as restaurant_name, r.slug as restaurant_slug,
               r.city as restaurant_city, r.rating_avg as restaurant_rating, r.delivery_time_min, r.delivery_time_max
        FROM food_items f
        JOIN menu_categories c ON c.id = f.category_id
        JOIN restaurants r ON r.id = f.restaurant_id
        WHERE r.approval_status = 'approved' AND f.is_available = 1
      `).all() as any[];

      const rows = hideDummyData
        ? allRows.filter(f => !SEED_RESTAURANT_IDS.has(f.restaurant_id))
        : allRows;

      let filtered = rows.filter(f => {
        if (city !== 'All' && f.restaurant_city.toLowerCase() !== city.toLowerCase()) return false;
        if (cuisine !== 'All' && f.cuisine.toLowerCase() !== cuisine.toLowerCase()) return false;
        const effectivePrice = f.discounted_price !== null ? Number(f.discounted_price) : Number(f.price);
        if (maxPrice > 0 && effectivePrice > maxPrice) return false;
        if (q) {
          const hay = `${f.name} ${f.description} ${f.cuisine} ${f.restaurant_name} ${f.tags_json}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      filtered.sort((a, b) => {
        const pa = a.discounted_price !== null ? Number(a.discounted_price) : Number(a.price);
        const pb = b.discounted_price !== null ? Number(b.discounted_price) : Number(b.price);
        if (sortBy === 'price_low') return pa - pb;
        if (sortBy === 'price_high') return pb - pa;
        if (sortBy === 'rating') return Number(b.restaurant_rating) - Number(a.restaurant_rating);
        return Number(b.order_count) - Number(a.order_count);
      });

      sendJson(res, 200, {
        foods: filtered.map(formatFoodItem)
      });
      return true;
    }

    // =========================================================================
    // 6. AI DISCOVERY ENDPOINT (CONVERSATIONAL SEARCH)
    // =========================================================================
    if (pathname === '/api/ai/discovery' && method === 'POST') {
      const body = await parseBody(req);
      const query = String(body.query || '').trim();
      const city = String(body.city || 'All').trim();
      if (!query) {
        sendJson(res, 400, { error: 'Please provide a discovery question.' });
        return true;
      }
      const quota = consumeDummyAiQuota(req, user);
      if (!quota.allowed) {
        sendJson(res, 429, {
          error: 'You have reached the 5 message demo limit. Sign in to see more and continue using AI.',
          code: 'DEMO_AI_LIMIT_REACHED',
          requiresSignIn: true,
          limit: quota.limit,
          used: quota.used,
          remaining: 0
        });
        return true;
      }
      const result = await runCustomerDiscoveryAI({
        query,
        city,
        userId: user?.id || null
      });
      sendJson(res, 200, {
        ...result,
        demoAiUsage: quota.isDemo
          ? { used: quota.used, limit: quota.limit, remaining: quota.remaining }
          : undefined
      });
      return true;
    }

    if (pathname === '/api/ai/voice-command' && method === 'POST') {
      const body = await parseBody(req);
      const transcript = String(body.transcript || '').trim();
      const formType = body.formType || null;
      const city = String(body.city || 'All').trim();
      const restaurantId = String(body.restaurantId || 'rest_abdul_ahad').trim();
      if (!transcript) {
        sendJson(res, 400, { error: 'Please speak or provide a voice transcript.' });
        return true;
      }
      const quota = consumeDummyAiQuota(req, user);
      if (!quota.allowed) {
        sendJson(res, 429, {
          error: 'You have reached the 5 message demo limit. Sign in to see more and continue using AI.',
          code: 'DEMO_AI_LIMIT_REACHED',
          requiresSignIn: true,
          limit: quota.limit,
          used: quota.used,
          remaining: 0
        });
        return true;
      }
      const result = await processVoiceCommandAI({
        transcript,
        formType,
        city,
        restaurantId,
        userId: user?.id || null
      });
      sendJson(res, 200, {
        ...result,
        demoAiUsage: quota.isDemo
          ? { used: quota.used, limit: quota.limit, remaining: quota.remaining }
          : undefined
      });
      return true;
    }

    // =========================================================================
    // 7. ORDERS CREATION & MANAGEMENT (SERVER-SIDE VALIDATED TOTALS)
    // =========================================================================
    if (pathname === '/api/orders/live' && method === 'GET') {
      if (!user) {
        sendJson(res, 200, { orders: [] });
        return true;
      }
      const rows = user.role === 'restaurant_owner'
        ? db.prepare(`
            SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug, r.logo_url as restaurant_logo
            FROM orders o
            JOIN restaurants r ON r.id = o.restaurant_id
            WHERE r.owner_id = ?
            ORDER BY o.created_at DESC LIMIT 20
          `).all(user.id) as any[]
        : db.prepare(`
            SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug, r.logo_url as restaurant_logo
            FROM orders o
            JOIN restaurants r ON r.id = o.restaurant_id
            WHERE o.customer_id = ?
            ORDER BY o.created_at DESC LIMIT 20
          `).all(user.id) as any[];

      const getItemsStmt = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`);
      const orders = rows.map(o => ({
        ...o,
        address: o.delivery_address,
        phone: o.customer_phone,
        timestamp: o.created_at,
        items: (getItemsStmt.all(o.id) as any[]).map(it => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          price: it.unit_price,
          lineTotal: it.line_total
        }))
      }));
      sendJson(res, 200, { orders });
      return true;
    }

    if (pathname === '/api/orders' && method === 'POST') {
      const body = await parseBody(req);
      const restaurantId = String(body.restaurantId || 'rest_abdul_ahad').trim();
      const rawItems = Array.isArray(body.items) ? body.items : [];
      const address = String(body.address || user?.address || '').trim();
      const phone = String(body.phone || user?.phone || '').trim();
      const customerName = String(body.customerName || user?.name || 'Guest Customer').trim();
      const orderType = ['delivery', 'pickup', 'dine_in'].includes(body.orderType) ? body.orderType : 'delivery';
      const offerCode = String(body.offerCode || '').trim().toUpperCase();
      const notes = String(body.notes || '').trim();
      const source = ['web', 'voice_ai', 'chat_ai'].includes(body.source) ? body.source : 'web';

      if (rawItems.length === 0) {
        sendJson(res, 400, { error: 'Order must contain at least one item.' });
        return true;
      }
      if (orderType === 'delivery' && address.length < 5) {
        sendJson(res, 400, { error: 'Please provide a complete delivery address.' });
        return true;
      }
      if (phone.length < 6) {
        sendJson(res, 400, { error: 'Please provide a valid contact phone number.' });
        return true;
      }

      const restaurant = db.prepare(`SELECT * FROM restaurants WHERE id = ?`).get(restaurantId) as any;
      if (!restaurant || restaurant.approval_status !== 'approved') {
        sendJson(res, 400, { error: 'Selected restaurant is not currently accepting orders.' });
        return true;
      }

      // Fetch restaurant's menu items from DB to compute authoritative server-side prices
      const dbMenuItems = db.prepare(`SELECT * FROM food_items WHERE restaurant_id = ? AND is_available = 1`).all(restaurantId) as any[];

      const verifiedOrderItems: {
        foodItemId: string | null;
        name: string;
        quantity: number;
        unitPrice: number;
        selectedVariation: any;
        selectedAddons: any[];
        lineTotal: number;
      }[] = [];

      for (const reqItem of rawItems) {
        const qty = Math.max(1, Math.min(99, Math.round(Number(reqItem.quantity) || 1)));
        let matchedDbItem = dbMenuItems.find(m => m.id === reqItem.foodItemId);
        if (!matchedDbItem && reqItem.name) {
          const cleanReq = String(reqItem.name).toLowerCase().trim();
          matchedDbItem = dbMenuItems.find(m => m.name.toLowerCase() === cleanReq || m.name.toLowerCase().includes(cleanReq) || cleanReq.includes(m.name.toLowerCase()));
        }

        if (!matchedDbItem) {
          sendJson(res, 400, { error: `Menu item "${reqItem.name || reqItem.foodItemId}" is unavailable at ${restaurant.name}.` });
          return true;
        }

        const basePrice = matchedDbItem.discounted_price !== null && matchedDbItem.discounted_price !== undefined
          ? Number(matchedDbItem.discounted_price)
          : Number(matchedDbItem.price);

        let variationDelta = 0;
        let selectedVariation = null;
        const dbVariations = safeJsonParse<{ name: string; priceDelta: number }[]>(matchedDbItem.variations_json, []);
        if (reqItem.variationName) {
          const foundVar = dbVariations.find(v => v.name.toLowerCase() === String(reqItem.variationName).toLowerCase());
          if (foundVar) {
            variationDelta = Number(foundVar.priceDelta || 0);
            selectedVariation = foundVar;
          }
        }

        let addonsTotal = 0;
        const selectedAddons: { name: string; price: number }[] = [];
        const dbAddons = safeJsonParse<{ name: string; price: number }[]>(matchedDbItem.addons_json, []);
        if (Array.isArray(reqItem.addonNames)) {
          for (const aName of reqItem.addonNames) {
            const foundAddon = dbAddons.find(a => a.name.toLowerCase() === String(aName).toLowerCase());
            if (foundAddon) {
              addonsTotal += Number(foundAddon.price || 0);
              selectedAddons.push(foundAddon);
            }
          }
        }

        const unitPrice = Math.round((basePrice + variationDelta + addonsTotal) * 100) / 100;
        const lineTotal = Math.round(unitPrice * qty * 100) / 100;

        verifiedOrderItems.push({
          foodItemId: matchedDbItem.id,
          name: matchedDbItem.name,
          quantity: qty,
          unitPrice,
          selectedVariation,
          selectedAddons,
          lineTotal
        });
      }

      const subtotal = Math.round(verifiedOrderItems.reduce((acc, item) => acc + item.lineTotal, 0) * 100) / 100;

      // Validate offer code if provided
      let discountAmount = 0;
      if (offerCode) {
        const offer = db.prepare(`
          SELECT * FROM offers WHERE restaurant_id = ? AND UPPER(code) = ? AND is_active = 1
        `).get(restaurantId, offerCode) as any;
        if (offer && subtotal >= Number(offer.min_order_amount || 0)) {
          if (offer.discount_type === 'percentage') {
            discountAmount = Math.round(subtotal * (Number(offer.discount_value) / 100) * 100) / 100;
          } else {
            discountAmount = Math.min(subtotal, Number(offer.discount_value));
          }
        }
      }

      const deliveryFee = orderType === 'delivery' ? Number(restaurant.delivery_fee || 0) : 0;
      const taxable = Math.max(0, subtotal - discountAmount);
      const taxAmount = Math.round(taxable * 0.08 * 100) / 100;
      const total = Math.round((taxable + deliveryFee + taxAmount) * 100) / 100;

      const orderId = `ord_${crypto.randomUUID().slice(0, 10)}`;
      const orderNumber = `RH-${Math.floor(10000 + Math.random() * 90000)}`;
      const now = new Date().toISOString();

      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO orders (
            id, order_number, customer_id, restaurant_id, branch_id, customer_name, customer_phone,
            delivery_address, order_type, subtotal, discount_amount, delivery_fee, tax_amount, total,
            offer_code, payment_method, payment_status, status, notes, source, cancel_reason, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'pending', 'Pending', ?, ?, '', ?, ?)
        `).run(
          orderId,
          orderNumber,
          user?.id || null,
          restaurantId,
          customerName,
          phone,
          orderType === 'delivery' ? address : `${restaurant.name} (${orderType.toUpperCase()})`,
          orderType,
          subtotal,
          discountAmount,
          deliveryFee,
          taxAmount,
          total,
          offerCode,
          notes,
          source,
          now,
          now
        );

        const insertItemStmt = db.prepare(`
          INSERT INTO order_items (id, order_id, food_item_id, name, quantity, unit_price, selected_variation_json, selected_addons_json, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updateFoodCountStmt = db.prepare(`
          UPDATE food_items SET order_count = order_count + ? WHERE id = ?
        `);

        for (const vi of verifiedOrderItems) {
          insertItemStmt.run(
            `oi_${crypto.randomUUID().slice(0, 10)}`,
            orderId,
            vi.foodItemId,
            vi.name,
            vi.quantity,
            vi.unitPrice,
            JSON.stringify(vi.selectedVariation),
            JSON.stringify(vi.selectedAddons),
            vi.lineTotal
          );
          if (vi.foodItemId) {
            updateFoodCountStmt.run(vi.quantity, vi.foodItemId);
          }
        }

        // Create payment record (10% platform commission tracked)
        const platformFee = Math.round(total * 0.10 * 100) / 100;
        db.prepare(`
          INSERT INTO payments (id, reference, user_id, restaurant_id, related_type, related_id, amount, platform_fee, currency, provider, status, metadata_json, created_at)
          VALUES (?, ?, ?, ?, 'order', ?, ?, ?, 'USD', 'cod', 'pending', ?, ?)
        `).run(
          `pay_${crypto.randomUUID().slice(0, 10)}`,
          `TXN-${orderNumber}`,
          user?.id || null,
          restaurantId,
          orderId,
          total,
          platformFee,
          JSON.stringify({ orderNumber, source }),
          now
        );

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      // Notify restaurant owner
      createNotification({
        userId: restaurant.owner_id,
        restaurantId,
        type: 'new_order',
        title: `New Order ${orderNumber} ($${total.toFixed(2)})`,
        message: `${customerName} placed a ${source === 'voice_ai' ? 'Voice AI ' : ''}order for ${verifiedOrderItems.length} item(s).`,
        linkView: 'owner'
      });

      if (user) {
        createNotification({
          userId: user.id,
          restaurantId,
          type: 'order_confirmed',
          title: `Order ${orderNumber} Placed`,
          message: `Your order with ${restaurant.name} ($${total.toFixed(2)}) has been sent to the kitchen.`,
          linkView: 'account'
        });
      }

      logAudit(user?.id || null, user?.role || 'guest', 'CREATE_ORDER', 'order', orderId, {
        orderNumber,
        restaurantId,
        total,
        source
      });

      mirrorOrderToNeon({
        id: orderId,
        orderNumber,
        restaurantId,
        customerName,
        phone,
        address,
        total,
        status: 'Pending',
        items: verifiedOrderItems
      }).catch(() => {});

      sendJson(res, 201, {
        order: {
          id: orderId,
          order_number: orderNumber,
          restaurant_id: restaurantId,
          restaurant_name: restaurant.name,
          customer_name: customerName,
          customer_phone: phone,
          delivery_address: address,
          order_type: orderType,
          subtotal,
          discount_amount: discountAmount,
          delivery_fee: deliveryFee,
          tax_amount: taxAmount,
          total,
          status: 'Pending',
          source,
          created_at: now,
          items: verifiedOrderItems.map(vi => ({
            name: vi.name,
            quantity: vi.quantity,
            price: vi.unitPrice,
            selectedVariation: vi.selectedVariation,
            selectedAddons: vi.selectedAddons,
            lineTotal: vi.lineTotal
          }))
        }
      });
      return true;
    }

    // Cancel Order
    const cancelOrderMatch = pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/);
    if (cancelOrderMatch && method === 'POST') {
      const orderId = cancelOrderMatch[1];
      const body = await parseBody(req);
      const order = db.prepare(`SELECT o.*, r.owner_id FROM orders o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.id = ?`).get(orderId) as any;
      if (!order) return sendJson(res, 404, { error: 'Order not found' }), true;

      const isOwnerOrAdmin = user && (user.role === 'admin' || user.id === order.owner_id);
      const isCustomer = user && user.id === order.customer_id;

      if (!isOwnerOrAdmin && !isCustomer) {
        return sendJson(res, 403, { error: 'Unauthorized to cancel this order' }), true;
      }

      if (!isOwnerOrAdmin && !['Pending', 'Confirmed'].includes(order.status)) {
        return sendJson(res, 400, { error: 'Orders already being prepared cannot be self-cancelled. Please contact the restaurant.' }), true;
      }

      const reason = String(body.reason || 'Cancelled by user').trim();
      db.prepare(`UPDATE orders SET status = 'Cancelled', cancel_reason = ?, updated_at = ? WHERE id = ?`).run(reason, new Date().toISOString(), orderId);
      sendJson(res, 200, { ok: true, status: 'Cancelled' });
      return true;
    }

    // =========================================================================
    // 8. CUSTOMER ACCOUNT, FAVOURITES & REVIEWS
    // =========================================================================
    if (pathname === '/api/customer/dashboard' && method === 'GET') {
      if (!user) return sendJson(res, 401, { error: 'Sign in required' }), true;

      const orders = db.prepare(`
        SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug, r.logo_url as restaurant_logo
        FROM orders o
        JOIN restaurants r ON r.id = o.restaurant_id
        WHERE o.customer_id = ?
        ORDER BY o.created_at DESC
      `).all(user.id) as any[];

      const getItemsStmt = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`);
      const hydratedOrders = orders.map(o => ({
        ...o,
        items: (getItemsStmt.all(o.id) as any[]).map(it => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          price: it.unit_price,
          lineTotal: it.line_total,
          selectedVariation: safeJsonParse(it.selected_variation_json, null),
          selectedAddons: safeJsonParse(it.selected_addons_json, [])
        }))
      }));

      const favRows = db.prepare(`
        SELECT r.* FROM favourites f
        JOIN restaurants r ON r.id = f.restaurant_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
      `).all(user.id) as any[];

      const myReviews = db.prepare(`
        SELECT rv.*, r.name as restaurant_name, r.slug as restaurant_slug
        FROM reviews rv
        JOIN restaurants r ON r.id = rv.restaurant_id
        WHERE rv.customer_id = ?
        ORDER BY rv.created_at DESC
      `).all(user.id) as any[];

      const notifications = db.prepare(`
        SELECT * FROM notifications
        WHERE user_id = ? OR (role_target != '' AND role_target = ?)
        ORDER BY created_at DESC LIMIT 30
      `).all(user.id, user.role) as any[];

      sendJson(res, 200, {
        orders: hydratedOrders,
        favourites: favRows.map(r => formatPublicRestaurant(r)),
        reviews: myReviews,
        notifications
      });
      return true;
    }

    if (pathname === '/api/customer/favourites/toggle' && method === 'POST') {
      if (!user) return sendJson(res, 401, { error: 'Please sign in to save favourite restaurants.' }), true;
      const body = await parseBody(req);
      const restaurantId = String(body.restaurantId || '').trim();
      const existing = db.prepare(`SELECT id FROM favourites WHERE user_id = ? AND restaurant_id = ?`).get(user.id, restaurantId) as any;

      if (existing) {
        db.prepare(`DELETE FROM favourites WHERE id = ?`).run(existing.id);
        sendJson(res, 200, { isFavourite: false });
      } else {
        db.prepare(`INSERT INTO favourites (id, user_id, restaurant_id, created_at) VALUES (?, ?, ?, ?)`).run(
          `fav_${crypto.randomUUID().slice(0, 10)}`,
          user.id,
          restaurantId,
          new Date().toISOString()
        );
        sendJson(res, 200, { isFavourite: true });
      }
      return true;
    }

    if (pathname === '/api/reviews' && method === 'POST') {
      if (!user) return sendJson(res, 401, { error: 'Please sign in to write a review.' }), true;
      const body = await parseBody(req);
      const restaurantId = String(body.restaurantId || '').trim();
      const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating) || 5)));
      const comment = String(body.comment || '').trim();
      const images = Array.isArray(body.images) ? body.images.filter((u: any) => typeof u === 'string' && u.trim()) : [];

      if (!restaurantId || comment.length < 5) {
        return sendJson(res, 400, { error: 'Please provide a rating and a written review (at least 5 characters).' }), true;
      }

      // Check if user has a past order with this restaurant for verified badge
      const pastOrder = db.prepare(`
        SELECT id FROM orders WHERE customer_id = ? AND restaurant_id = ? AND status != 'Cancelled' LIMIT 1
      `).get(user.id, restaurantId) as any;

      const revId = `rev_${crypto.randomUUID().slice(0, 10)}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO reviews (
          id, restaurant_id, customer_id, order_id, customer_name, rating, comment,
          images_json, owner_reply, owner_reply_at, helpful_count, is_verified_order, status, report_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', 0, ?, 'published', '', ?)
      `).run(
        revId,
        restaurantId,
        user.id,
        pastOrder?.id || null,
        user.name,
        rating,
        comment,
        JSON.stringify(images),
        pastOrder ? 1 : 0,
        now
      );

      recalculateRestaurantRating(db, restaurantId);

      const rest = db.prepare(`SELECT owner_id, name FROM restaurants WHERE id = ?`).get(restaurantId) as any;
      if (rest) {
        createNotification({
          userId: rest.owner_id,
          restaurantId,
          type: 'new_review',
          title: `New ${rating}★ Review for ${rest.name}`,
          message: `${user.name}: "${comment.slice(0, 80)}"`,
          linkView: 'owner'
        });
      }

      sendJson(res, 201, { ok: true, reviewId: revId });
      return true;
    }

    const revHelpfulMatch = pathname.match(/^\/api\/reviews\/([^/]+)\/helpful$/);
    if (revHelpfulMatch && method === 'POST') {
      db.prepare(`UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?`).run(revHelpfulMatch[1]);
      sendJson(res, 200, { ok: true });
      return true;
    }

    const revReportMatch = pathname.match(/^\/api\/reviews\/([^/]+)\/report$/);
    if (revReportMatch && method === 'POST') {
      const body = await parseBody(req);
      const reason = String(body.reason || 'Inappropriate content').trim();
      db.prepare(`UPDATE reviews SET status = 'reported', report_reason = ? WHERE id = ?`).run(reason, revReportMatch[1]);
      createNotification({
        roleTarget: 'admin',
        type: 'review_reported',
        title: 'Review Flagged for Moderation',
        message: `Reason: ${reason}`,
        linkView: 'admin'
      });
      sendJson(res, 200, { ok: true });
      return true;
    }

    // =========================================================================
    // 9. NOTIFICATIONS ENDPOINTS
    // =========================================================================
    if (pathname === '/api/notifications/read-all' && method === 'POST') {
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' }), true;
      db.prepare(`
        UPDATE notifications SET is_read = 1
        WHERE user_id = ? OR (role_target != '' AND role_target = ?)
      `).run(user.id, user.role);
      sendJson(res, 200, { ok: true });
      return true;
    }

    // =========================================================================
    // 10. RESTAURANT OWNER DASHBOARD, MENU, AI & BIDDING ENDPOINTS
    // =========================================================================
    if (pathname === '/api/owner/restaurants' && method === 'GET') {
      if (!user || (user.role !== 'restaurant_owner' && user.role !== 'admin')) {
        return sendJson(res, 403, { error: 'Restaurant Owner access required.' }), true;
      }
      const list = user.role === 'admin'
        ? db.prepare(`SELECT * FROM restaurants ORDER BY created_at DESC`).all()
        : db.prepare(`SELECT * FROM restaurants WHERE owner_id = ? ORDER BY created_at DESC`).all(user.id);
      sendJson(res, 200, { restaurants: (list as any[]).map(r => formatPublicRestaurant(r)) });
      return true;
    }

    if (pathname === '/api/owner/restaurants' && method === 'POST') {
      if (!user || (user.role !== 'restaurant_owner' && user.role !== 'admin')) {
        return sendJson(res, 403, { error: 'Restaurant Owner access required.' }), true;
      }
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      const cuisine = String(body.cuisine || 'Pakistani & Mughal').trim();
      const city = String(body.city || 'Karachi').trim();
      const area = String(body.area || 'Main Commercial').trim();
      const address = String(body.address || '').trim();
      const phone = String(body.phone || user.phone || '').trim();
      const priceRange = ['$', '$$', '$$$', '$$$$'].includes(body.priceRange) ? body.priceRange : '$$';
      const description = String(body.description || '').trim();

      if (!name || !address) {
        return sendJson(res, 400, { error: 'Restaurant name and address are required.' }), true;
      }

      const id = `rest_${crypto.randomUUID().slice(0, 10)}`;
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO restaurants (
          id, owner_id, name, slug, description, cuisine, secondary_cuisines, price_range,
          city, area, address, phone, email, opening_hours_json, services_json,
          logo_url, cover_url, verification_status, approval_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)
      `).run(
        id,
        user.id,
        name,
        slug,
        description || `Authentic ${cuisine} kitchen in ${area}, ${city}.`,
        cuisine,
        priceRange,
        city,
        area,
        address,
        phone,
        user.email,
        JSON.stringify({ monday: '11:00 AM - 11:00 PM', friday: '12:00 PM - 12:00 AM' }),
        JSON.stringify({ delivery: true, pickup: true, dineIn: true, halal: true }),
        body.logoUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
        body.coverUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
        now,
        now
      );

      db.prepare(`INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at) VALUES (?, ?, 'Main Course', 'Signature mains', 1, 1, ?)`).run(`cat_${crypto.randomUUID().slice(0, 8)}`, id, now);
      db.prepare(`INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at) VALUES (?, ?, 'Appetizers', 'Starters & sides', 2, 1, ?)`).run(`cat_${crypto.randomUUID().slice(0, 8)}`, id, now);

      logAudit(user.id, user.role, 'CREATE_RESTAURANT', 'restaurant', id, { name, city });
      sendJson(res, 201, { restaurantId: id });
      return true;
    }

    // Owner Restaurant Dashboard & Tenant-Isolated Operations
    const ownerRestMatch = pathname.match(/^\/api\/owner\/restaurants\/([^/]+)(?:\/(.*))?$/);
    if (ownerRestMatch) {
      if (!user || (user.role !== 'restaurant_owner' && user.role !== 'admin')) {
        return sendJson(res, 403, { error: 'Restaurant Owner authorization required.' }), true;
      }
      const restaurantId = ownerRestMatch[1];
      const subPath = ownerRestMatch[2] || '';

      const restaurant = db.prepare(`SELECT * FROM restaurants WHERE id = ?`).get(restaurantId) as any;
      if (!restaurant) {
        return sendJson(res, 404, { error: 'Restaurant not found.' }), true;
      }
      // STRICT TENANT ISOLATION: Verify ownership unless platform admin
      if (user.role !== 'admin' && restaurant.owner_id !== user.id) {
        logAudit(user.id, user.role, 'UNAUTHORIZED_TENANT_ACCESS_BLOCKED', 'restaurant', restaurantId, {});
        return sendJson(res, 403, { error: 'Tenant isolation violation: You do not own this restaurant.' }), true;
      }

      // GET /api/owner/restaurants/:id/dashboard
      if (subPath === 'dashboard' && method === 'GET') {
        const categories = db.prepare(`SELECT * FROM menu_categories WHERE restaurant_id = ? ORDER BY sort_order ASC`).all(restaurantId) as any[];
        const foodRows = db.prepare(`
          SELECT f.*, c.name as category_name
          FROM food_items f
          JOIN menu_categories c ON c.id = f.category_id
          WHERE f.restaurant_id = ?
          ORDER BY f.sort_order ASC, f.created_at DESC
        `).all(restaurantId) as any[];

        const orders = db.prepare(`SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 50`).all(restaurantId) as any[];
        const getItemsStmt = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`);
        const hydratedOrders = orders.map(o => ({
          ...o,
          items: (getItemsStmt.all(o.id) as any[]).map(it => ({
            id: it.id,
            name: it.name,
            quantity: it.quantity,
            price: it.unit_price,
            lineTotal: it.line_total,
            selectedVariation: safeJsonParse(it.selected_variation_json, null),
            selectedAddons: safeJsonParse(it.selected_addons_json, [])
          }))
        }));

        const reviews = db.prepare(`SELECT * FROM reviews WHERE restaurant_id = ? AND status = 'published' ORDER BY created_at DESC`).all(restaurantId) as any[];
        const branches = db.prepare(`SELECT * FROM restaurant_branches WHERE restaurant_id = ? ORDER BY is_main DESC`).all(restaurantId) as any[];
        const offers = db.prepare(`SELECT * FROM offers WHERE restaurant_id = ? ORDER BY created_at DESC`).all(restaurantId) as any[];

        // Bidding & Ranking Status (Strictly Authorized View: Own bid history + current leading bid amount + min next qualifying bid)
        const activeCampaign = db.prepare(`SELECT * FROM ranking_campaigns WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`).get() as any;
        let biddingStatus: any = null;
        if (activeCampaign) {
          const allCampaignBids = db.prepare(`
            SELECT restaurant_id, MAX(amount) as max_amount
            FROM bids
            WHERE campaign_id = ? AND status IN ('leading', 'active_runner_up')
            GROUP BY restaurant_id
            ORDER BY max_amount DESC
          `).all(activeCampaign.id) as { restaurant_id: string; max_amount: number }[];

          const highestBidRow = allCampaignBids[0];
          const currentLeadingBid = highestBidRow ? Number(highestBidRow.max_amount) : 0;
          const minOpening = Number(activeCampaign.min_opening_bid || 0);
          const minNextEligibleBid = getMinNextBid(currentLeadingBid, {
            openingBid: minOpening,
            stepFloor: Number(activeCampaign.min_bid_increment || 0)
          });
          const minIncrement = currentLeadingBid > 0 ? roundMoney(minNextEligibleBid - currentLeadingBid) : minNextEligibleBid;

          const myRankIndex = allCampaignBids.findIndex(b => b.restaurant_id === restaurantId);
          const myCurrentRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
          const myHighestBid = myRankIndex >= 0 ? Number(allCampaignBids[myRankIndex].max_amount) : 0;

          // Only return THIS restaurant's own bid history (never expose competitor identities/histories!)
          const myBidHistory = db.prepare(`
            SELECT id, amount, status, payment_status, notes, created_at
            FROM bids
            WHERE campaign_id = ? AND restaurant_id = ?
            ORDER BY created_at DESC
          `).all(activeCampaign.id, restaurantId);

          biddingStatus = {
            campaign: {
              id: activeCampaign.id,
              title: activeCampaign.title,
              slotCount: activeCampaign.slot_count,
              minOpeningBid: minOpening,
              minBidIncrement: minIncrement,
              endsAt: activeCampaign.ends_at,
              rules: safeJsonParse(activeCampaign.rules_json, {})
            },
            currentLeadingBid,
            minNextEligibleBid,
            myCurrentRank,
            myHighestBid,
            isLeading: myCurrentRank === 1,
            myBidHistory
          };
        }

        const validOrders = orders.filter(o => o.status !== 'Cancelled');
        const totalRevenue = Math.round(validOrders.reduce((s, o) => s + Number(o.total || 0), 0) * 100) / 100;

        sendJson(res, 200, {
          restaurant: formatPublicRestaurant(restaurant),
          metrics: {
            profileViews: Number(restaurant.profile_views || 0),
            menuViews: Number(restaurant.menu_views || 0),
            searchAppearances: Number(restaurant.search_appearances || 0),
            ratingAvg: Number(restaurant.rating_avg || 0),
            reviewCount: Number(restaurant.review_count || 0),
            totalOrders: validOrders.length,
            activeOrdersCount: orders.filter(o => ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery'].includes(o.status)).length,
            totalRevenue
          },
          categories,
          menuItems: foodRows.map(formatFoodItem),
          orders: hydratedOrders,
          reviews,
          branches,
          offers,
          biddingStatus
        });
        return true;
      }

      // PUT /api/owner/restaurants/:id (Update Restaurant Profile)
      if (subPath === '' && method === 'PUT') {
        const body = await parseBody(req);
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE restaurants
          SET name = ?, description = ?, cuisine = ?, price_range = ?, city = ?, area = ?,
              address = ?, phone = ?, email = ?, logo_url = ?, cover_url = ?,
              delivery_fee = ?, min_order = ?, opening_hours_json = ?, services_json = ?, updated_at = ?
          WHERE id = ?
        `).run(
          String(body.name || restaurant.name).trim(),
          String(body.description || restaurant.description).trim(),
          String(body.cuisine || restaurant.cuisine).trim(),
          ['$', '$$', '$$$', '$$$$'].includes(body.price_range) ? body.price_range : restaurant.price_range,
          String(body.city || restaurant.city).trim(),
          String(body.area || restaurant.area).trim(),
          String(body.address || restaurant.address).trim(),
          String(body.phone || restaurant.phone).trim(),
          String(body.email || restaurant.email).trim(),
          String(body.logo_url ?? restaurant.logo_url).trim(),
          String(body.cover_url ?? restaurant.cover_url).trim(),
          Number(body.delivery_fee ?? restaurant.delivery_fee),
          Number(body.min_order ?? restaurant.min_order),
          body.opening_hours ? JSON.stringify(body.opening_hours) : restaurant.opening_hours_json,
          body.services ? JSON.stringify(body.services) : restaurant.services_json,
          now,
          restaurantId
        );
        logAudit(user.id, user.role, 'UPDATE_RESTAURANT_PROFILE', 'restaurant', restaurantId, {});
        sendJson(res, 200, { ok: true });
        return true;
      }

      // POST /api/owner/restaurants/:id/categories
      if (subPath === 'categories' && method === 'POST') {
        const body = await parseBody(req);
        const name = String(body.name || '').trim();
        const description = String(body.description || '').trim();
        if (!name) return sendJson(res, 400, { error: 'Category name is required.' }), true;
        const catId = `cat_${crypto.randomUUID().slice(0, 8)}`;
        db.prepare(`
          INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(catId, restaurantId, name, description, Number(body.sortOrder || 10), new Date().toISOString());
        sendJson(res, 201, { categoryId: catId });
        return true;
      }

      // POST /api/owner/restaurants/:id/items (Create Food Item)
      if (subPath === 'items' && method === 'POST') {
        const body = await parseBody(req);
        const name = String(body.name || '').trim();
        const categoryId = String(body.categoryId || '').trim();
        const price = Number(body.price);
        if (!name || !categoryId || isNaN(price) || price < 0) {
          return sendJson(res, 400, { error: 'Valid item name, category, and price are required.' }), true;
        }
        const itemId = `food_${crypto.randomUUID().slice(0, 10)}`;
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO food_items (
            id, restaurant_id, category_id, name, description, price, discounted_price,
            image_url, cuisine, tags_json, variations_json, addons_json,
            is_available, is_popular, is_trending, order_count, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 0, 1, ?, ?)
        `).run(
          itemId,
          restaurantId,
          categoryId,
          name,
          String(body.description || `Freshly prepared ${name}.`).trim(),
          price,
          body.discountedPrice ? Number(body.discountedPrice) : null,
          String(body.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80').trim(),
          String(body.cuisine || restaurant.cuisine),
          JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
          JSON.stringify(Array.isArray(body.variations) ? body.variations : []),
          JSON.stringify(Array.isArray(body.addons) ? body.addons : []),
          body.isPopular ? 1 : 0,
          now,
          now
        );
        logAudit(user.id, user.role, 'CREATE_FOOD_ITEM', 'food_item', itemId, { restaurantId, name, price });
        sendJson(res, 201, { itemId });
        return true;
      }

      // POST /api/owner/restaurants/:id/ai-menu-draft (Extract Structured Menu Draft via AI)
      if (subPath === 'ai-menu-draft' && method === 'POST') {
        const body = await parseBody(req);
        const prompt = String(body.prompt || '').trim();
        if (!prompt) {
          return sendJson(res, 400, { error: 'Please enter or speak menu instructions.' }), true;
        }
        const quota = consumeDummyAiQuota(req, user);
        if (!quota.allowed) {
          return sendJson(res, 429, {
            error: 'You have reached the 5 message demo limit. Sign in to see more and continue using AI.',
            code: 'DEMO_AI_LIMIT_REACHED',
            requiresSignIn: true,
            limit: quota.limit,
            used: quota.used,
            remaining: 0
          }), true;
        }
        const draft = await generateMenuDraftFromPrompt(
          prompt,
          restaurant.name,
          restaurant.cuisine,
          user.id,
          restaurantId
        );
        sendJson(res, 200, {
          ...draft,
          demoAiUsage: quota.isDemo
            ? { used: quota.used, limit: quota.limit, remaining: quota.remaining }
            : undefined
        });
        return true;
      }

      // POST /api/owner/restaurants/:id/ai-menu-publish (Confirm & Save Reviewed AI Menu Draft)
      if (subPath === 'ai-menu-publish' && method === 'POST') {
        const body = await parseBody(req);
        const draftItems = Array.isArray(body.items) ? body.items : [];
        if (draftItems.length === 0) {
          return sendJson(res, 400, { error: 'No draft items provided to publish.' }), true;
        }

        const now = new Date().toISOString();
        let createdCount = 0;

        db.exec('BEGIN IMMEDIATE;');
        try {
          const existingCats = db.prepare(`SELECT id, name FROM menu_categories WHERE restaurant_id = ?`).all(restaurantId) as { id: string; name: string }[];
          const catMap = new Map<string, string>();
          existingCats.forEach(c => catMap.set(c.name.toLowerCase(), c.id));

          const insertCatStmt = db.prepare(`
            INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at)
            VALUES (?, ?, ?, 'Created via AI Menu Architect', 10, 1, ?)
          `);

          const insertFoodStmt = db.prepare(`
            INSERT INTO food_items (
              id, restaurant_id, category_id, name, description, price, discounted_price,
              image_url, cuisine, tags_json, variations_json, addons_json,
              is_available, is_popular, is_trending, order_count, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, '["AI Curated"]', ?, ?, 1, 0, 0, 0, 10, ?, ?)
          `);

          for (const item of draftItems) {
            const catName = String(item.categoryName || 'Main Course').trim();
            const itemName = String(item.name || '').trim();
            const price = Math.max(0, Number(item.price) || 0);
            if (!itemName) continue;

            let catId = catMap.get(catName.toLowerCase());
            if (!catId) {
              catId = `cat_${crypto.randomUUID().slice(0, 8)}`;
              insertCatStmt.run(catId, restaurantId, catName, now);
              catMap.set(catName.toLowerCase(), catId);
            }

            insertFoodStmt.run(
              `food_${crypto.randomUUID().slice(0, 10)}`,
              restaurantId,
              catId,
              itemName,
              String(item.description || `Freshly prepared ${itemName}.`).trim(),
              price,
              String(item.imageUrl || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80'),
              restaurant.cuisine,
              JSON.stringify(Array.isArray(item.variations) ? item.variations : []),
              JSON.stringify(Array.isArray(item.addons) ? item.addons : []),
              now,
              now
            );
            createdCount++;
          }

          db.exec('COMMIT;');
        } catch (err) {
          db.exec('ROLLBACK;');
          throw err;
        }

        logAudit(user.id, user.role, 'PUBLISH_AI_MENU_DRAFT', 'restaurant', restaurantId, { createdCount });
        sendJson(res, 201, { ok: true, createdCount });
        return true;
      }

      // POST /api/owner/restaurants/:id/ai-assistant
      if (subPath === 'ai-assistant' && method === 'POST') {
        const body = await parseBody(req);
        const prompt = String(body.prompt || '').trim();
        if (!prompt) return sendJson(res, 400, { error: 'Prompt is required' }), true;
        const quota = consumeDummyAiQuota(req, user);
        if (!quota.allowed) {
          return sendJson(res, 429, {
            error: 'You have reached the 5 message demo limit. Sign in to see more and continue using AI.',
            code: 'DEMO_AI_LIMIT_REACHED',
            requiresSignIn: true,
            limit: quota.limit,
            used: quota.used,
            remaining: 0
          }), true;
        }
        const result = await runRestaurantOwnerAssistant({
          restaurantId,
          userId: user.id,
          prompt
        });
        sendJson(res, 200, {
          ...result,
          demoAiUsage: quota.isDemo
            ? { used: quota.used, limit: quota.limit, remaining: quota.remaining }
            : undefined
        });
        return true;
      }

      // POST /api/owner/restaurants/:id/offers
      if (subPath === 'offers' && method === 'POST') {
        const body = await parseBody(req);
        const title = String(body.title || '').trim();
        const code = String(body.code || '').trim().toUpperCase();
        const discountType = body.discountType === 'fixed' ? 'fixed' : 'percentage';
        const discountValue = Number(body.discountValue || 10);
        const minOrderAmount = Number(body.minOrderAmount || 0);
        if (!title || !code || discountValue <= 0) {
          return sendJson(res, 400, { error: 'Offer title, code, and discount value are required.' }), true;
        }
        const offerId = `off_${crypto.randomUUID().slice(0, 8)}`;
        const validUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
        db.prepare(`
          INSERT INTO offers (id, restaurant_id, title, description, code, discount_type, discount_value, min_order_amount, valid_until, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).run(offerId, restaurantId, title, String(body.description || title), code, discountType, discountValue, minOrderAmount, validUntil, new Date().toISOString());
        sendJson(res, 201, { offerId });
        return true;
      }

      // POST /api/owner/restaurants/:id/branches
      if (subPath === 'branches' && method === 'POST') {
        const body = await parseBody(req);
        const name = String(body.name || '').trim();
        const city = String(body.city || restaurant.city).trim();
        const area = String(body.area || '').trim();
        const address = String(body.address || '').trim();
        const phone = String(body.phone || restaurant.phone).trim();
        if (!name || !address) return sendJson(res, 400, { error: 'Branch name and address required' }), true;
        const branchId = `br_${crypto.randomUUID().slice(0, 8)}`;
        db.prepare(`
          INSERT INTO restaurant_branches (id, restaurant_id, name, city, area, address, phone, opening_hours, is_main, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?)
        `).run(branchId, restaurantId, name, city, area, address, phone, String(body.openingHours || '11:30 AM - 11:30 PM'), new Date().toISOString());
        sendJson(res, 201, { branchId });
        return true;
      }

      // POST /api/owner/restaurants/:id/bids (ATOMIC PAID RANKING BIDDING ENGINE)
      if (subPath === 'bids' && method === 'POST') {
        if (restaurant.approval_status !== 'approved' || restaurant.verification_status !== 'verified') {
          return sendJson(res, 403, {
            error: 'Only verified and approved restaurants can participate in paid ranking auctions.'
          }), true;
        }

        const body = await parseBody(req);
        const amount = Math.round(Number(body.amount) * 100) / 100;
        const notes = String(body.notes || '').trim();

        const campaign = db.prepare(`SELECT * FROM ranking_campaigns WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`).get() as any;
        if (!campaign) {
          return sendJson(res, 400, { error: 'No active ranking campaign is currently open for bidding.' }), true;
        }

        db.exec('BEGIN IMMEDIATE;');
        try {
          const leadingRow = db.prepare(`
            SELECT id, restaurant_id, amount
            FROM bids
            WHERE campaign_id = ? AND status IN ('leading', 'active_runner_up')
            ORDER BY amount DESC LIMIT 1
          `).get(campaign.id) as { id: string; restaurant_id: string; amount: number } | undefined;

          const currentLeadingBid = leadingRow ? Number(leadingRow.amount) : 0;
          const minRequired = getMinNextBid(currentLeadingBid, {
            openingBid: Number(campaign.min_opening_bid || 0),
            stepFloor: Number(campaign.min_bid_increment || 0)
          });
          const minIncrement = currentLeadingBid > 0 ? roundMoney(minRequired - currentLeadingBid) : minRequired;

          if (isNaN(amount) || amount < minRequired) {
            db.exec('ROLLBACK;');
            return sendJson(res, 400, {
              error: `Qualifying bid must be at least $${minRequired.toFixed(2)} (current leading bid is $${currentLeadingBid.toFixed(2)}).`
            }), true;
          }

          const now = new Date().toISOString();
          const bidId = `bid_${crypto.randomUUID().slice(0, 10)}`;

          // Demote previous leading bids to active_runner_up
          db.prepare(`
            UPDATE bids SET status = 'active_runner_up'
            WHERE campaign_id = ? AND status = 'leading'
          `).run(campaign.id);

          // Insert new leading bid
          db.prepare(`
            INSERT INTO bids (id, campaign_id, restaurant_id, amount, status, payment_status, placed_by_user_id, notes, created_at)
            VALUES (?, ?, ?, ?, 'leading', 'paid', ?, ?, ?)
          `).run(bidId, campaign.id, restaurantId, amount, user.id, notes, now);

          // Mark restaurant as featured
          db.prepare(`UPDATE restaurants SET is_featured = 1, updated_at = ? WHERE id = ?`).run(now, restaurantId);

          // Record payment transaction
          db.prepare(`
            INSERT INTO payments (id, reference, user_id, restaurant_id, related_type, related_id, amount, platform_fee, currency, provider, status, metadata_json, created_at)
            VALUES (?, ?, ?, ?, 'bid', ?, ?, ?, 'USD', 'manual_invoice', 'completed', ?, ?)
          `).run(
            `pay_${crypto.randomUUID().slice(0, 10)}`,
            `TXN-BID-${bidId.slice(-6).toUpperCase()}`,
            user.id,
            restaurantId,
            bidId,
            amount,
            amount,
            JSON.stringify({ campaignId: campaign.id, previousLeading: currentLeadingBid }),
            now
          );

          db.exec('COMMIT;');

          // Notify previous leading restaurant owner if it was a different restaurant
          if (leadingRow && leadingRow.restaurant_id !== restaurantId) {
            const prevRest = db.prepare(`SELECT owner_id, name FROM restaurants WHERE id = ?`).get(leadingRow.restaurant_id) as any;
            if (prevRest) {
              createNotification({
                userId: prevRest.owner_id,
                restaurantId: leadingRow.restaurant_id,
                type: 'outbid_alert',
                title: `Outbid Alert in ${campaign.title}`,
                message: `Your restaurant ${prevRest.name} was outbid for Rank #1. New leading bid is $${amount.toFixed(2)} (next minimum bid: $${getMinNextBid(amount, { openingBid: Number(campaign.min_opening_bid || 0), stepFloor: Number(campaign.min_bid_increment || 0) }).toFixed(2)}).`,
                linkView: 'owner'
              });
            }
          }

          logAudit(user.id, user.role, 'PLACE_RANKING_BID', 'bid', bidId, {
            restaurantId,
            campaignId: campaign.id,
            amount,
            previousLeading: currentLeadingBid
          });

          sendJson(res, 201, {
            ok: true,
            bidId,
            amount,
            newMinNextBid: getMinNextBid(amount, { openingBid: Number(campaign.min_opening_bid || 0), stepFloor: Number(campaign.min_bid_increment || 0) })
          });
          return true;
        } catch (err) {
          db.exec('ROLLBACK;');
          throw err;
        }
      }
    }

    // Owner Item Update / Delete & Order Status Update & Review Reply
    const ownerItemMatch = pathname.match(/^\/api\/owner\/items\/([^/]+)$/);
    if (ownerItemMatch) {
      if (!user || (user.role !== 'restaurant_owner' && user.role !== 'admin')) {
        return sendJson(res, 403, { error: 'Unauthorized' }), true;
      }
      const itemId = ownerItemMatch[1];
      const itemRow = db.prepare(`
        SELECT f.*, r.owner_id FROM food_items f JOIN restaurants r ON r.id = f.restaurant_id WHERE f.id = ?
      `).get(itemId) as any;
      if (!itemRow) return sendJson(res, 404, { error: 'Menu item not found' }), true;
      if (user.role !== 'admin' && itemRow.owner_id !== user.id) {
        return sendJson(res, 403, { error: 'Tenant isolation violation' }), true;
      }

      if (method === 'PUT') {
        const body = await parseBody(req);
        db.prepare(`
          UPDATE food_items
          SET name = ?, description = ?, price = ?, discounted_price = ?, image_url = ?,
              is_available = ?, is_popular = ?, variations_json = ?, addons_json = ?, updated_at = ?
          WHERE id = ?
        `).run(
          String(body.name ?? itemRow.name).trim(),
          String(body.description ?? itemRow.description).trim(),
          Number(body.price ?? itemRow.price),
          body.discounted_price !== undefined ? (body.discounted_price ? Number(body.discounted_price) : null) : itemRow.discounted_price,
          String(body.image_url ?? itemRow.image_url).trim(),
          body.is_available !== undefined ? (body.is_available ? 1 : 0) : itemRow.is_available,
          body.is_popular !== undefined ? (body.is_popular ? 1 : 0) : itemRow.is_popular,
          body.variations ? JSON.stringify(body.variations) : itemRow.variations_json,
          body.addons ? JSON.stringify(body.addons) : itemRow.addons_json,
          new Date().toISOString(),
          itemId
        );
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (method === 'DELETE') {
        db.prepare(`DELETE FROM food_items WHERE id = ?`).run(itemId);
        logAudit(user.id, user.role, 'DELETE_FOOD_ITEM', 'food_item', itemId, { name: itemRow.name });
        sendJson(res, 200, { ok: true });
        return true;
      }
    }

    const ownerOrderStatusMatch = pathname.match(/^\/api\/owner\/orders\/([^/]+)\/status$/);
    if (ownerOrderStatusMatch && method === 'PUT') {
      if (!user || (user.role !== 'restaurant_owner' && user.role !== 'admin')) {
        return sendJson(res, 403, { error: 'Unauthorized' }), true;
      }
      const orderId = ownerOrderStatusMatch[1];
      const orderRow = db.prepare(`
        SELECT o.*, r.owner_id, r.name as restaurant_name
        FROM orders o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.id = ?
      `).get(orderId) as any;
      if (!orderRow) return sendJson(res, 404, { error: 'Order not found' }), true;
      if (user.role !== 'admin' && orderRow.owner_id !== user.id) {
        return sendJson(res, 403, { error: 'Tenant isolation violation' }), true;
      }

      const body = await parseBody(req);
      const validStatuses = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
      const newStatus = validStatuses.includes(body.status) ? body.status : orderRow.status;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE orders
        SET status = ?, payment_status = CASE WHEN ? = 'Delivered' THEN 'paid' ELSE payment_status END, updated_at = ?
        WHERE id = ?
      `).run(newStatus, newStatus, now, orderId);

      if (newStatus === 'Delivered') {
        db.prepare(`UPDATE payments SET status = 'completed' WHERE related_type = 'order' AND related_id = ?`).run(orderId);
      }

      if (orderRow.customer_id) {
        createNotification({
          userId: orderRow.customer_id,
          restaurantId: orderRow.restaurant_id,
          type: 'order_status',
          title: `Order ${orderRow.order_number}: ${newStatus}`,
          message: `${orderRow.restaurant_name} updated your order status to "${newStatus}".`,
          linkView: 'account'
        });
      }

      sendJson(res, 200, { ok: true, status: newStatus });
      return true;
    }

    const ownerRevReplyMatch = pathname.match(/^\/api\/owner\/reviews\/([^/]+)\/reply$/);
    if (ownerRevReplyMatch && method === 'POST') {
      if (!user || (user.role !== 'restaurant_owner' && user.role !== 'admin')) {
        return sendJson(res, 403, { error: 'Unauthorized' }), true;
      }
      const reviewId = ownerRevReplyMatch[1];
      const revRow = db.prepare(`
        SELECT rv.*, r.owner_id FROM reviews rv JOIN restaurants r ON r.id = rv.restaurant_id WHERE rv.id = ?
      `).get(reviewId) as any;
      if (!revRow) return sendJson(res, 404, { error: 'Review not found' }), true;
      if (user.role !== 'admin' && revRow.owner_id !== user.id) {
        return sendJson(res, 403, { error: 'Tenant isolation violation' }), true;
      }

      const body = await parseBody(req);
      const reply = String(body.reply || '').trim();
      db.prepare(`UPDATE reviews SET owner_reply = ?, owner_reply_at = ? WHERE id = ?`).run(reply, new Date().toISOString(), reviewId);
      sendJson(res, 200, { ok: true });
      return true;
    }

    // =========================================================================
    // 11. PLATFORM ADMINISTRATION ENDPOINTS
    // =========================================================================
    if (pathname.startsWith('/api/admin/')) {
      if (!user || user.role !== 'admin') {
        return sendJson(res, 403, { error: 'Platform Administrator privileges required.' }), true;
      }

      if (pathname === '/api/admin/overview' && method === 'GET') {
        const users = db.prepare(`SELECT id, name, email, role, phone, city, status, created_at FROM users ORDER BY created_at DESC`).all();
        const restaurants = db.prepare(`
          SELECT r.*, u.name as owner_name, u.email as owner_email
          FROM restaurants r
          JOIN users u ON u.id = r.owner_id
          ORDER BY CASE WHEN r.approval_status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
        `).all() as any[];

        const campaigns = db.prepare(`SELECT * FROM ranking_campaigns ORDER BY created_at DESC`).all() as any[];
        const bids = db.prepare(`
          SELECT b.*, r.name as restaurant_name, u.name as placed_by_name, c.title as campaign_title
          FROM bids b
          JOIN restaurants r ON r.id = b.restaurant_id
          JOIN users u ON u.id = b.placed_by_user_id
          JOIN ranking_campaigns c ON c.id = b.campaign_id
          ORDER BY b.amount DESC, b.created_at DESC
        `).all();

        const reviews = db.prepare(`
          SELECT rv.*, r.name as restaurant_name
          FROM reviews rv
          JOIN restaurants r ON r.id = rv.restaurant_id
          ORDER BY CASE WHEN rv.status = 'reported' THEN 0 ELSE 1 END, rv.created_at DESC
        `).all();

        const payments = db.prepare(`
          SELECT p.*, r.name as restaurant_name, u.name as user_name
          FROM payments p
          LEFT JOIN restaurants r ON r.id = p.restaurant_id
          LEFT JOIN users u ON u.id = p.user_id
          ORDER BY p.created_at DESC
        `).all() as any[];

        const auditLogs = db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 60`).all();
        const aiLogs = db.prepare(`SELECT * FROM ai_logs ORDER BY created_at DESC LIMIT 40`).all();
        const orders = db.prepare(`
          SELECT o.*, r.name as restaurant_name
          FROM orders o
          JOIN restaurants r ON r.id = o.restaurant_id
          ORDER BY o.created_at DESC LIMIT 50
        `).all();

        const completedPayments = payments.filter(p => p.status === 'completed');
        const totalGrossVolume = Math.round(completedPayments.reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100;
        const totalPlatformRevenue = Math.round(completedPayments.reduce((s, p) => s + Number(p.platform_fee || 0), 0) * 100) / 100;

        sendJson(res, 200, {
          stats: {
            totalUsers: users.length,
            totalRestaurants: restaurants.length,
            pendingApprovals: restaurants.filter(r => r.approval_status === 'pending').length,
            reportedReviewsCount: (reviews as any[]).filter(r => r.status === 'reported').length,
            totalGrossVolume,
            totalPlatformRevenue,
            totalAiInteractions: aiLogs.length
          },
          users,
          restaurants: restaurants.map(r => ({
            ...formatPublicRestaurant(r),
            owner_name: r.owner_name,
            owner_email: r.owner_email
          })),
          campaigns,
          bids,
          reviews,
          payments,
          orders,
          auditLogs,
          aiLogs
        });
        return true;
      }

      const adminUserStatus = pathname.match(/^\/api\/admin\/users\/([^/]+)\/status$/);
      if (adminUserStatus && method === 'PUT') {
        const targetId = adminUserStatus[1];
        const body = await parseBody(req);
        const status = body.status === 'suspended' ? 'suspended' : 'active';
        db.prepare(`UPDATE users SET status = ?, updated_at = ? WHERE id = ?`).run(status, new Date().toISOString(), targetId);
        logAudit(user.id, 'admin', 'UPDATE_USER_STATUS', 'user', targetId, { status });
        sendJson(res, 200, { ok: true, status });
        return true;
      }

      const adminRestStatus = pathname.match(/^\/api\/admin\/restaurants\/([^/]+)\/status$/);
      if (adminRestStatus && method === 'PUT') {
        const restId = adminRestStatus[1];
        const body = await parseBody(req);
        const rest = db.prepare(`SELECT * FROM restaurants WHERE id = ?`).get(restId) as any;
        if (!rest) return sendJson(res, 404, { error: 'Restaurant not found' }), true;

        const approvalStatus = body.approvalStatus || rest.approval_status;
        const verificationStatus = body.verificationStatus || rest.verification_status;
        const isFeatured = body.isFeatured !== undefined ? (body.isFeatured ? 1 : 0) : rest.is_featured;
        const isTrending = body.isTrending !== undefined ? (body.isTrending ? 1 : 0) : rest.is_trending;

        db.prepare(`
          UPDATE restaurants
          SET approval_status = ?, verification_status = ?, is_featured = ?, is_trending = ?, updated_at = ?
          WHERE id = ?
        `).run(approvalStatus, verificationStatus, isFeatured, isTrending, new Date().toISOString(), restId);

        createNotification({
          userId: rest.owner_id,
          restaurantId: restId,
          type: 'restaurant_moderation',
          title: `${rest.name} Status Updated`,
          message: `Approval: ${approvalStatus.toUpperCase()} • Verification: ${verificationStatus.toUpperCase()}`,
          linkView: 'owner'
        });

        logAudit(user.id, 'admin', 'MODERATE_RESTAURANT', 'restaurant', restId, { approvalStatus, verificationStatus, isFeatured, isTrending });
        sendJson(res, 200, { ok: true });
        return true;
      }

      const adminRevMod = pathname.match(/^\/api\/admin\/reviews\/([^/]+)\/moderate$/);
      if (adminRevMod && method === 'PUT') {
        const revId = adminRevMod[1];
        const body = await parseBody(req);
        const status = ['published', 'hidden', 'rejected'].includes(body.status) ? body.status : 'hidden';
        const rev = db.prepare(`SELECT restaurant_id FROM reviews WHERE id = ?`).get(revId) as any;
        db.prepare(`UPDATE reviews SET status = ? WHERE id = ?`).run(status, revId);
        if (rev) {
          recalculateRestaurantRating(db, rev.restaurant_id);
        }
        logAudit(user.id, 'admin', 'MODERATE_REVIEW', 'review', revId, { status });
        sendJson(res, 200, { ok: true });
        return true;
      }

      const adminCampRules = pathname.match(/^\/api\/admin\/campaigns\/([^/]+)\/rules$/);
      if (adminCampRules && method === 'PUT') {
        const campId = adminCampRules[1];
        const body = await parseBody(req);
        db.prepare(`
          UPDATE ranking_campaigns
          SET min_bid_increment = ?, min_opening_bid = ?, slot_count = ?, status = ?
          WHERE id = ?
        `).run(
          Math.max(0.01, Number(body.minBidIncrement || 0.01)),
          Math.max(0.01, Number(body.minOpeningBid || 0.1)),
          Math.max(1, Number(body.slotCount || 3)),
          ['active', 'paused', 'completed'].includes(body.status) ? body.status : 'active',
          campId
        );
        logAudit(user.id, 'admin', 'UPDATE_CAMPAIGN_RULES', 'ranking_campaign', campId, body);
        sendJson(res, 200, { ok: true });
        return true;
      }

      const adminPayMod = pathname.match(/^\/api\/admin\/payments\/([^/]+)\/status$/);
      if (adminPayMod && method === 'PUT') {
        const payId = adminPayMod[1];
        const body = await parseBody(req);
        const status = ['completed', 'refunded', 'pending'].includes(body.status) ? body.status : 'completed';
        db.prepare(`UPDATE payments SET status = ? WHERE id = ?`).run(status, payId);
        logAudit(user.id, 'admin', 'UPDATE_PAYMENT_STATUS', 'payment', payId, { status });
        sendJson(res, 200, { ok: true });
        return true;
      }
    }

    sendJson(res, 404, { error: `API endpoint not found: ${method} ${pathname}` });
    return true;
  } catch (err: any) {
    console.error('Server API Error:', err);
    sendJson(res, 500, { error: err?.message || 'Internal Server Error' });
    return true;
  }
}
