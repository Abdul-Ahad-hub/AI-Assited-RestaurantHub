import pg from 'pg';

const { Pool } = pg;

let neonPool: pg.Pool | null = null;
let neonStatus: {
  connected: boolean;
  database: string;
  host: string;
  mode: string;
  lastChecked: string;
  error?: string;
} = {
  connected: false,
  database: 'neondb',
  host: 'ep-icy-tooth-b3qcakop-pooler.c-4.ap-southeast-1.aws.neon.tech',
  mode: 'hybrid_seed_active',
  lastChecked: ''
};

export function getNeonPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!neonPool) {
    neonPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000
    });
  }
  return neonPool;
}

export async function initNeonConnection(): Promise<typeof neonStatus> {
  const pool = getNeonPool();
  if (!pool) {
    neonStatus = {
      ...neonStatus,
      connected: false,
      lastChecked: new Date().toISOString(),
      error: 'DATABASE_URL not set in environment'
    };
    return neonStatus;
  }

  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT current_database() AS db, version() AS ver;');
      // Initialize core tables on Neon PostgreSQL so it is ready for full production cutover
      await client.query(`
        CREATE TABLE IF NOT EXISTS rh_restaurants (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          cuisine TEXT NOT NULL,
          price_range TEXT NOT NULL DEFAULT '$$',
          city TEXT NOT NULL DEFAULT 'Karachi',
          area TEXT NOT NULL DEFAULT '',
          address TEXT NOT NULL,
          latitude DOUBLE PRECISION DEFAULT 24.8607,
          longitude DOUBLE PRECISION DEFAULT 67.0011,
          rating_avg DOUBLE PRECISION DEFAULT 4.8,
          review_count INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS rh_orders (
          id TEXT PRIMARY KEY,
          order_number TEXT NOT NULL,
          restaurant_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          delivery_address TEXT NOT NULL,
          total DOUBLE PRECISION NOT NULL,
          status TEXT NOT NULL DEFAULT 'Pending',
          items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      neonStatus = {
        connected: true,
        database: res.rows?.[0]?.db || 'neondb',
        host: 'ep-icy-tooth-b3qcakop-pooler.c-4.ap-southeast-1.aws.neon.tech',
        mode: 'connected_with_seeded_test_data',
        lastChecked: new Date().toISOString()
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    neonStatus = {
      ...neonStatus,
      connected: false,
      lastChecked: new Date().toISOString(),
      error: err?.message || 'Neon connection error'
    };
  }
  return neonStatus;
}

export async function mirrorOrderToNeon(order: {
  id: string;
  orderNumber: string;
  restaurantId: string;
  customerName: string;
  phone: string;
  address: string;
  total: number;
  status: string;
  items: any[];
}) {
  const pool = getNeonPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO rh_orders (id, order_number, restaurant_id, customer_name, customer_phone, delivery_address, total, status, items_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [
        order.id,
        order.orderNumber,
        order.restaurantId,
        order.customerName,
        order.phone,
        order.address,
        order.total,
        order.status,
        JSON.stringify(order.items || [])
      ]
    );
  } catch {
    // Non-blocking mirror while hardcoded/local test data is active
  }
}

export function getNeonStatus() {
  return neonStatus;
}
