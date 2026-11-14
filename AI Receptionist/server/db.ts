import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

function resolveDbPath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'restaurant_hub.db');
  }
  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'restaurant_hub.db');
  } catch {
    return path.join(os.tmpdir(), 'restaurant_hub.db');
  }
}

const DB_PATH = resolveDbPath();

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA busy_timeout = 5000;');
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'restaurant_owner', 'admin')),
      phone TEXT DEFAULT '',
      city TEXT DEFAULT 'Karachi',
      address TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
      preferences_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      cuisine TEXT NOT NULL,
      secondary_cuisines TEXT NOT NULL DEFAULT '[]',
      price_range TEXT NOT NULL DEFAULT '$$' CHECK(price_range IN ('$', '$$', '$$$', '$$$$')),
      city TEXT NOT NULL DEFAULT 'Karachi',
      area TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL,
      latitude REAL NOT NULL DEFAULT 24.8607,
      longitude REAL NOT NULL DEFAULT 67.0011,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      opening_hours_json TEXT NOT NULL DEFAULT '{}',
      services_json TEXT NOT NULL DEFAULT '{}',
      logo_url TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      gallery_json TEXT NOT NULL DEFAULT '[]',
      rating_avg REAL NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      profile_views INTEGER NOT NULL DEFAULT 0,
      menu_views INTEGER NOT NULL DEFAULT 0,
      search_appearances INTEGER NOT NULL DEFAULT 0,
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending', 'verified', 'rejected')),
      approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_trending INTEGER NOT NULL DEFAULT 0,
      delivery_fee REAL NOT NULL DEFAULT 1.99,
      min_order REAL NOT NULL DEFAULT 10.00,
      delivery_time_min INTEGER NOT NULL DEFAULT 25,
      delivery_time_max INTEGER NOT NULL DEFAULT 40,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurant_branches (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      area TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      opening_hours TEXT NOT NULL DEFAULT '11:00 AM - 11:30 PM',
      is_main INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS food_items (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL CHECK(price >= 0),
      discounted_price REAL,
      image_url TEXT NOT NULL DEFAULT '',
      cuisine TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      variations_json TEXT NOT NULL DEFAULT '[]',
      addons_json TEXT NOT NULL DEFAULT '[]',
      is_available INTEGER NOT NULL DEFAULT 1,
      is_popular INTEGER NOT NULL DEFAULT 0,
      is_trending INTEGER NOT NULL DEFAULT 0,
      order_count INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      code TEXT NOT NULL,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
      discount_value REAL NOT NULL CHECK(discount_value > 0),
      min_order_amount REAL NOT NULL DEFAULT 0,
      valid_until TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
      branch_id TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      order_type TEXT NOT NULL DEFAULT 'delivery' CHECK(order_type IN ('delivery', 'pickup', 'dine_in')),
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      delivery_fee REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      offer_code TEXT DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'cod' CHECK(payment_method IN ('cod', 'card_boundary', 'wallet')),
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'refunded', 'failed')),
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled')),
      notes TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'web' CHECK(source IN ('web', 'voice_ai', 'chat_ai')),
      cancel_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      food_item_id TEXT,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL,
      selected_variation_json TEXT DEFAULT 'null',
      selected_addons_json TEXT DEFAULT '[]',
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      order_id TEXT,
      customer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      images_json TEXT NOT NULL DEFAULT '[]',
      owner_reply TEXT DEFAULT '',
      owner_reply_at TEXT DEFAULT '',
      helpful_count INTEGER NOT NULL DEFAULT 0,
      is_verified_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published', 'reported', 'hidden', 'rejected')),
      report_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favourites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, restaurant_id)
    );

    CREATE TABLE IF NOT EXISTS ranking_campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT 'All',
      cuisine_scope TEXT NOT NULL DEFAULT 'All',
      slot_count INTEGER NOT NULL DEFAULT 3,
      min_opening_bid REAL NOT NULL DEFAULT 0.10,
      min_bid_increment REAL NOT NULL DEFAULT 0.01,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'scheduled', 'completed', 'paused')),
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      rules_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES ranking_campaigns(id) ON DELETE CASCADE,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      amount REAL NOT NULL CHECK(amount > 0),
      status TEXT NOT NULL DEFAULT 'leading' CHECK(status IN ('leading', 'active_runner_up', 'outbid', 'cancelled', 'expired')),
      payment_status TEXT NOT NULL DEFAULT 'paid' CHECK(payment_status IN ('authorized', 'paid', 'refunded', 'pending')),
      placed_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,
      related_type TEXT NOT NULL CHECK(related_type IN ('order', 'bid', 'subscription')),
      related_id TEXT NOT NULL,
      amount REAL NOT NULL,
      platform_fee REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      provider TEXT NOT NULL DEFAULT 'cod',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'refunded', 'failed')),
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
      role_target TEXT DEFAULT '',
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link_view TEXT DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      restaurant_id TEXT,
      mode TEXT NOT NULL,
      prompt TEXT NOT NULL,
      tools_called_json TEXT NOT NULL DEFAULT '[]',
      response_summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_restaurants_city_status ON restaurants(city, approval_status);
    CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine);
    CREATE INDEX IF NOT EXISTS idx_food_items_restaurant ON food_items(restaurant_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items(name);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews(restaurant_id, status);
    CREATE INDEX IF NOT EXISTS idx_bids_campaign_amount ON bids(campaign_id, amount DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
  `);
}

export function recalculateRestaurantRating(db: DatabaseSync, restaurantId: string) {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt, COALESCE(AVG(rating), 0) as avg_rating
    FROM reviews
    WHERE restaurant_id = ? AND status = 'published'
  `).get(restaurantId) as { cnt: number; avg_rating: number } | undefined;

  const count = row ? Number(row.cnt) : 0;
  const avg = row ? Math.round(Number(row.avg_rating) * 10) / 10 : 0;

  db.prepare(`
    UPDATE restaurants
    SET rating_avg = ?, review_count = ?, updated_at = ?
    WHERE id = ?
  `).run(avg, count, new Date().toISOString(), restaurantId);
}
