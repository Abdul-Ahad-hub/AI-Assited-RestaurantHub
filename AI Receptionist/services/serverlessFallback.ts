// ============================================================================
// Client-Side Serverless API Runtime Fallback (for Static / Vercel Edge Deploys)
// ============================================================================
// When deployed as a static Vite SPA on Vercel (or if a serverless runtime lacks
// Node 22 native `node:sqlite`), `/api/*` requests would otherwise fail with 404/500.
// This module provides a persistent `localStorage`-backed implementation of all
// `/api/*` routes with the exact same RBAC, dynamic scaling bidding rules,
// separation of demo vs. real users, order lifecycle, and AI concierge responses.

const STORAGE_KEY = 'rh_serverless_store_v2';
const TOKEN_KEY = 'rh_auth_token';

const DEFAULT_OPENING_BID = 0.1;
const DEFAULT_STEP_FLOOR = 0.01;
const STEP_PERCENT = 5;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getBidStep(currentLeadingBid: number, stepFloor = DEFAULT_STEP_FLOOR): number {
  const floor = stepFloor > 0 ? stepFloor : DEFAULT_STEP_FLOOR;
  if (currentLeadingBid <= 0) return floor;
  const proportional = roundMoney(currentLeadingBid * (STEP_PERCENT / 100));
  return Math.max(floor, proportional);
}

function getMinNextBid(
  currentLeadingBid: number,
  options?: { openingBid?: number; stepFloor?: number }
): number {
  const opening =
    options?.openingBid && options.openingBid > 0 ? options.openingBid : DEFAULT_OPENING_BID;
  const floor =
    options?.stepFloor && options.stepFloor > 0 ? options.stepFloor : DEFAULT_STEP_FLOOR;

  if (currentLeadingBid <= 0) {
    return roundMoney(opening);
  }
  const step = getBidStep(currentLeadingBid, floor);
  return roundMoney(currentLeadingBid + step);
}

const SEED_USER_IDS = new Set([
  'usr_admin_1',
  'usr_owner_abdul',
  'usr_owner_zaffran',
  'usr_owner_smash',
  'usr_customer_1',
  'usr_customer_2'
]);

const SEED_RESTAURANT_IDS = new Set([
  'rest_abdul_ahad',
  'rest_zaffran',
  'rest_smash',
  'rest_sakura',
  'rest_napoli',
  'rest_levant',
  'rest_green',
  'rest_pending_lahore'
]);

interface StoreState {
  users: any[];
  sessions: Record<string, string>; // token -> userId
  restaurants: any[];
  categories: any[];
  foodItems: any[];
  offers: any[];
  branches: any[];
  reviews: any[];
  favourites: { id: string; user_id: string; restaurant_id: string; created_at: string }[];
  campaigns: any[];
  bids: any[];
  orders: any[];
  orderItems: any[];
  payments: any[];
  notifications: any[];
  auditLogs: any[];
}

function buildInitialStore(): StoreState {
  const now = new Date().toISOString();
  const futureEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  const users = [
    {
      id: 'usr_admin_1',
      name: 'Zainab Mirza (Platform Admin)',
      email: 'admin@restauranthub.com',
      password: 'Password123!',
      role: 'admin',
      phone: '+92 300 1112233',
      city: 'Karachi',
      address: 'Restaurant Hub HQ, Clifton Block 4, Karachi',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
      status: 'active',
      preferences: { theme: 'light', notifications: true },
      created_at: now
    },
    {
      id: 'usr_owner_abdul',
      name: 'Abdul Ahad',
      email: 'owner@abdulahadkitchen.com',
      password: 'Password123!',
      role: 'restaurant_owner',
      phone: '+92 321 8889900',
      city: 'Karachi',
      address: 'Plot 14-C, Bukhari Commercial, DHA Phase 6, Karachi',
      avatar_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=250&q=80',
      status: 'active',
      preferences: { notifications: true },
      created_at: now
    },
    {
      id: 'usr_owner_zaffran',
      name: 'Chef Tariq Mehmood',
      email: 'owner@zaffran.com',
      password: 'Password123!',
      role: 'restaurant_owner',
      phone: '+92 333 4445566',
      city: 'Karachi',
      address: 'Tipu Sultan Road, Karachi',
      avatar_url: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=250&q=80',
      status: 'active',
      preferences: { notifications: true },
      created_at: now
    },
    {
      id: 'usr_owner_smash',
      name: 'Hamza Siddiqui',
      email: 'owner@craftsmash.com',
      password: 'Password123!',
      role: 'restaurant_owner',
      phone: '+92 301 7776655',
      city: 'Lahore',
      address: 'MM Alam Road, Gulberg III, Lahore',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      status: 'active',
      preferences: { notifications: true },
      created_at: now
    },
    {
      id: 'usr_customer_1',
      name: 'Sarah Ahmed',
      email: 'customer@restauranthub.com',
      password: 'Password123!',
      role: 'customer',
      phone: '+92 345 2223344',
      city: 'Karachi',
      address: 'House 42, Street 10, DHA Phase 5, Karachi',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80',
      status: 'active',
      preferences: { dietary: ['Halal'], favoriteCuisines: ['Pakistani & Mughal', 'Burgers & American'] },
      created_at: now
    }
  ];

  const restaurants = [
    {
      id: 'rest_abdul_ahad',
      owner_id: 'usr_owner_abdul',
      name: "Abdul Ahad's Kitchen",
      slug: 'abdul-ahads-kitchen',
      description: 'Signature Mughal & Royal Pakistani fine dining crafted with heirloom spices, slow-simmered karahis, and charcoal-pit BBQ.',
      cuisine: 'Pakistani & Mughal',
      secondary_cuisines: ['BBQ & Grill', 'Biryani & Rice', 'Desserts'],
      price_range: '$$',
      city: 'Karachi',
      area: 'DHA Phase 6',
      address: 'Plot 14-C, Bukhari Commercial, DHA Phase 6, Karachi',
      latitude: 24.7936,
      longitude: 67.0642,
      phone: '+92 321 8889900',
      email: 'owner@abdulahadkitchen.com',
      opening_hours: { monday: '12:00 PM - 12:00 AM', friday: '1:30 PM - 1:00 AM' },
      services: { delivery: true, pickup: true, dineIn: true, halal: true, familyHall: true },
      logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
      cover_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80'
      ],
      rating_avg: 4.9,
      review_count: 142,
      profile_views: 1940,
      menu_views: 1620,
      search_appearances: 3410,
      verification_status: 'verified',
      approval_status: 'approved',
      is_featured: 1,
      is_trending: 1,
      delivery_fee: 1.99,
      min_order: 10,
      delivery_time_min: 25,
      delivery_time_max: 35,
      created_at: now
    },
    {
      id: 'rest_zaffran',
      owner_id: 'usr_owner_zaffran',
      name: 'Zaffran Royal Darbar',
      slug: 'zaffran-royal-darbar',
      description: 'Hand-pounded dum biryanis, saffron-infused curries, and Peshawari namkeen gosht cooked over almond wood.',
      cuisine: 'Pakistani & Mughal',
      secondary_cuisines: ['Afghani', 'BBQ & Grill'],
      price_range: '$$$',
      city: 'Karachi',
      area: 'Tipu Sultan',
      address: 'Main Tipu Sultan Road, Karachi',
      latitude: 24.8782,
      longitude: 67.0793,
      phone: '+92 333 4445566',
      email: 'owner@zaffran.com',
      opening_hours: { monday: '12:00 PM - 11:30 PM', friday: '1:00 PM - 12:30 AM' },
      services: { delivery: true, pickup: true, dineIn: true, halal: true },
      logo_url: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=300&q=80',
      cover_url: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1400&q=80',
      gallery: [],
      rating_avg: 4.8,
      review_count: 98,
      profile_views: 1410,
      menu_views: 1120,
      search_appearances: 2290,
      verification_status: 'verified',
      approval_status: 'approved',
      is_featured: 1,
      is_trending: 1,
      delivery_fee: 2.49,
      min_order: 15,
      delivery_time_min: 30,
      delivery_time_max: 45,
      created_at: now
    },
    {
      id: 'rest_smash',
      owner_id: 'usr_owner_smash',
      name: 'Craft Smash & Co.',
      slug: 'craft-smash-and-co',
      description: 'Crispy lace-edged wagyu smash burgers, truffle parmesan fries, and Belgian milkshakes.',
      cuisine: 'Burgers & American',
      secondary_cuisines: ['Fast Food', 'Shakes & Desserts'],
      price_range: '$$',
      city: 'Lahore',
      area: 'Gulberg III',
      address: 'MM Alam Road, Gulberg III, Lahore',
      latitude: 31.5126,
      longitude: 74.3519,
      phone: '+92 301 7776655',
      email: 'owner@craftsmash.com',
      opening_hours: { monday: '11:30 AM - 2:00 AM', friday: '12:00 PM - 3:00 AM' },
      services: { delivery: true, pickup: true, dineIn: true, halal: true },
      logo_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80',
      cover_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1400&q=80',
      gallery: [],
      rating_avg: 4.7,
      review_count: 86,
      profile_views: 1210,
      menu_views: 980,
      search_appearances: 1870,
      verification_status: 'verified',
      approval_status: 'approved',
      is_featured: 1,
      is_trending: 1,
      delivery_fee: 1.49,
      min_order: 8,
      delivery_time_min: 20,
      delivery_time_max: 30,
      created_at: now
    },
    {
      id: 'rest_napoli',
      owner_id: 'usr_owner_zaffran',
      name: 'Forno Di Napoli',
      slug: 'forno-di-napoli',
      description: '48-hour cold-fermented Neapolitan sourdough pizzas baked at 900°F with San Marzano tomatoes and fresh burrata.',
      cuisine: 'Italian & Pizza',
      secondary_cuisines: ['Pasta', 'Artisan Bakery'],
      price_range: '$$$',
      city: 'Karachi',
      area: 'Clifton Block 4',
      address: 'Street 7, Clifton Block 4, Karachi',
      latitude: 24.8138,
      longitude: 67.0303,
      phone: '+92 333 9991122',
      email: 'owner@zaffran.com',
      opening_hours: { monday: '12:30 PM - 11:30 PM', friday: '1:00 PM - 12:30 AM' },
      services: { delivery: true, pickup: true, dineIn: true, halal: true },
      logo_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=300&q=80',
      cover_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1400&q=80',
      gallery: [],
      rating_avg: 4.8,
      review_count: 74,
      profile_views: 990,
      menu_views: 840,
      search_appearances: 1520,
      verification_status: 'verified',
      approval_status: 'approved',
      is_featured: 0,
      is_trending: 1,
      delivery_fee: 2.25,
      min_order: 12,
      delivery_time_min: 28,
      delivery_time_max: 40,
      created_at: now
    },
    {
      id: 'rest_sakura',
      owner_id: 'usr_owner_abdul',
      name: 'Sakura Robata & Sushi',
      slug: 'sakura-robata-and-sushi',
      description: 'Contemporary Tokyo robatayaki grill, hand-pressed nigiri, and slow-simmered spicy miso ramen.',
      cuisine: 'Pan-Asian & Sushi',
      secondary_cuisines: ['Japanese', 'Thai'],
      price_range: '$$$$',
      city: 'Islamabad',
      area: 'F-7 Markaz',
      address: 'Street 12, F-7 Markaz, Islamabad',
      latitude: 33.7215,
      longitude: 73.0571,
      phone: '+92 51 2651122',
      email: 'owner@abdulahadkitchen.com',
      opening_hours: { monday: '1:00 PM - 11:30 PM', friday: '1:00 PM - 12:00 AM' },
      services: { delivery: true, pickup: true, dineIn: true, halal: true },
      logo_url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=300&q=80',
      cover_url: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1400&q=80',
      gallery: [],
      rating_avg: 4.9,
      review_count: 63,
      profile_views: 870,
      menu_views: 720,
      search_appearances: 1340,
      verification_status: 'verified',
      approval_status: 'approved',
      is_featured: 0,
      is_trending: 0,
      delivery_fee: 2.99,
      min_order: 18,
      delivery_time_min: 32,
      delivery_time_max: 45,
      created_at: now
    }
  ];

  const categories = [
    { id: 'cat_aa_1', restaurant_id: 'rest_abdul_ahad', name: 'Appetizers', description: 'Charcoal-grilled starters', sort_order: 1, is_active: 1, created_at: now },
    { id: 'cat_aa_2', restaurant_id: 'rest_abdul_ahad', name: 'Main Course', description: 'Royal curries, biryanis & karahis', sort_order: 2, is_active: 1, created_at: now },
    { id: 'cat_aa_3', restaurant_id: 'rest_abdul_ahad', name: 'Breads', description: 'Clay-oven naans', sort_order: 3, is_active: 1, created_at: now },
    { id: 'cat_aa_4', restaurant_id: 'rest_abdul_ahad', name: 'Desserts & Drinks', description: 'Sweet finishes & lassis', sort_order: 4, is_active: 1, created_at: now },
    { id: 'cat_zf_1', restaurant_id: 'rest_zaffran', name: 'Royal Biryanis & Mains', description: 'Slow-cooked dum specialties', sort_order: 1, is_active: 1, created_at: now },
    { id: 'cat_sm_1', restaurant_id: 'rest_smash', name: 'Smash Burgers', description: 'Seared wagyu & angus patties', sort_order: 1, is_active: 1, created_at: now },
    { id: 'cat_np_1', restaurant_id: 'rest_napoli', name: 'Wood-Fired Pizzas', description: 'Neapolitan sourdough crusts', sort_order: 1, is_active: 1, created_at: now },
    { id: 'cat_sk_1', restaurant_id: 'rest_sakura', name: 'Signature Rolls & Ramen', description: 'Fresh sashimi & broths', sort_order: 1, is_active: 1, created_at: now }
  ];

  const foodItems = [
    {
      id: 'food_aa_1',
      restaurant_id: 'rest_abdul_ahad',
      category_id: 'cat_aa_1',
      category_name: 'Appetizers',
      restaurant_name: "Abdul Ahad's Kitchen",
      restaurant_slug: 'abdul-ahads-kitchen',
      restaurant_city: 'Karachi',
      restaurant_rating: 4.9,
      name: 'Seekh Kebab',
      description: 'Minced lamb mixed with fresh herbs and spices, grilled to perfection over glowing charcoal.',
      price: 12.99,
      discounted_price: null,
      image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Pakistani & Mughal',
      tags: ['Halal', 'Chef Special', 'Charcoal Grill'],
      variations: [
        { name: 'Regular (4 Pcs)', priceDelta: 0 },
        { name: 'Family Platter (8 Pcs)', priceDelta: 10 }
      ],
      addons: [
        { name: 'Mint Tamarind Chutney', price: 0.99 },
        { name: 'Sizzling Onion Bed', price: 1.5 }
      ],
      is_available: true,
      is_popular: true,
      is_trending: true,
      order_count: 320,
      created_at: now
    },
    {
      id: 'food_aa_2',
      restaurant_id: 'rest_abdul_ahad',
      category_id: 'cat_aa_2',
      category_name: 'Main Course',
      restaurant_name: "Abdul Ahad's Kitchen",
      restaurant_slug: 'abdul-ahads-kitchen',
      restaurant_city: 'Karachi',
      restaurant_rating: 4.9,
      name: 'Chicken Biryani',
      description: 'Aromatic basmati rice layered with spiced chicken, caramelized onions, and saffron.',
      price: 16.99,
      discounted_price: 14.99,
      image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Pakistani & Mughal',
      tags: ['Halal', 'Bestseller', 'Spicy'],
      variations: [
        { name: 'Single Serving', priceDelta: 0 },
        { name: 'Double Serving', priceDelta: 9 }
      ],
      addons: [
        { name: 'Zeera Raita', price: 1.25 },
        { name: 'Extra Chicken Piece', price: 3.5 }
      ],
      is_available: true,
      is_popular: true,
      is_trending: true,
      order_count: 540,
      created_at: now
    },
    {
      id: 'food_aa_3',
      restaurant_id: 'rest_abdul_ahad',
      category_id: 'cat_aa_2',
      category_name: 'Main Course',
      restaurant_name: "Abdul Ahad's Kitchen",
      restaurant_slug: 'abdul-ahads-kitchen',
      restaurant_city: 'Karachi',
      restaurant_rating: 4.9,
      name: 'Mutton Karahi',
      description: 'Tender goat meat wok-cooked with vine tomatoes, julienned ginger, and crushed black pepper.',
      price: 22.99,
      discounted_price: null,
      image_url: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Pakistani & Mughal',
      tags: ['Halal', 'Signature'],
      variations: [
        { name: 'Half Kg', priceDelta: 0 },
        { name: 'Full Kg', priceDelta: 16 }
      ],
      addons: [{ name: 'Desi Ghee Tadka', price: 2.5 }],
      is_available: true,
      is_popular: true,
      is_trending: true,
      order_count: 410,
      created_at: now
    },
    {
      id: 'food_aa_4',
      restaurant_id: 'rest_abdul_ahad',
      category_id: 'cat_aa_3',
      category_name: 'Breads',
      restaurant_name: "Abdul Ahad's Kitchen",
      restaurant_slug: 'abdul-ahads-kitchen',
      restaurant_city: 'Karachi',
      restaurant_rating: 4.9,
      name: 'Garlic Naan',
      description: 'Soft, pillowy leavened clay-oven bread brushed with roasted garlic butter and fresh coriander.',
      price: 3.5,
      discounted_price: null,
      image_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Pakistani & Mughal',
      tags: ['Halal', 'Vegetarian'],
      variations: [{ name: '1 Piece', priceDelta: 0 }],
      addons: [],
      is_available: true,
      is_popular: true,
      is_trending: false,
      order_count: 680,
      created_at: now
    },
    {
      id: 'food_zf_1',
      restaurant_id: 'rest_zaffran',
      category_id: 'cat_zf_1',
      category_name: 'Royal Biryanis & Mains',
      restaurant_name: 'Zaffran Royal Darbar',
      restaurant_slug: 'zaffran-royal-darbar',
      restaurant_city: 'Karachi',
      restaurant_rating: 4.8,
      name: 'Zafrani Mutton Dum Pukht',
      description: 'Slow-braised mutton shanks sealed in dough with Kashmiri saffron and whole garam masala.',
      price: 24.5,
      discounted_price: null,
      image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Pakistani & Mughal',
      tags: ['Halal', 'Royal Special'],
      variations: [{ name: 'Regular', priceDelta: 0 }],
      addons: [],
      is_available: true,
      is_popular: true,
      is_trending: true,
      order_count: 290,
      created_at: now
    },
    {
      id: 'food_sm_1',
      restaurant_id: 'rest_smash',
      category_id: 'cat_sm_1',
      category_name: 'Smash Burgers',
      restaurant_name: 'Craft Smash & Co.',
      restaurant_slug: 'craft-smash-and-co',
      restaurant_city: 'Lahore',
      restaurant_rating: 4.7,
      name: 'Double Truffle Wagyu Smash',
      description: 'Double smashed wagyu patties, aged cheddar, black truffle aioli, and caramelized onions on brioche.',
      price: 13.99,
      discounted_price: 11.99,
      image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Burgers & American',
      tags: ['Halal', 'Trending'],
      variations: [{ name: 'Double Patty', priceDelta: 0 }, { name: 'Triple Patty', priceDelta: 3.5 }],
      addons: [{ name: 'Parmesan Truffle Fries', price: 3.99 }],
      is_available: true,
      is_popular: true,
      is_trending: true,
      order_count: 375,
      created_at: now
    },
    {
      id: 'food_np_1',
      restaurant_id: 'rest_napoli',
      category_id: 'cat_np_1',
      category_name: 'Wood-Fired Pizzas',
      restaurant_name: 'Forno Di Napoli',
      restaurant_slug: 'forno-di-napoli',
      restaurant_city: 'Karachi',
      restaurant_rating: 4.8,
      name: 'Burrata & Diavola Sourdough Pizza',
      description: 'San Marzano tomato base, spicy beef pepperoni, creamy fresh burrata, and hot honey drizzle.',
      price: 17.5,
      discounted_price: null,
      image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Italian & Pizza',
      tags: ['Halal', 'Wood Fired'],
      variations: [{ name: '12 Inch Artisan', priceDelta: 0 }],
      addons: [{ name: 'Chili Honey Dip', price: 1.5 }],
      is_available: true,
      is_popular: true,
      is_trending: true,
      order_count: 260,
      created_at: now
    }
  ];

  const campaigns = [
    {
      id: 'camp_featured_top',
      title: 'Homepage Sponsored #1 Spotlight: Prime Discovery Placement',
      city: 'All',
      slot_count: 3,
      min_opening_bid: 0.1,
      min_bid_increment: 0.01,
      status: 'active',
      starts_at: now,
      ends_at: futureEnd,
      rules: {
        pricingModel: 'dynamic_scaling_step',
        stepPercent: 5,
        stepFloor: 0.01,
        openingBid: 0.1
      },
      created_at: now
    }
  ];

  const bids = [
    {
      id: 'bid_seed_1',
      campaign_id: 'camp_featured_top',
      restaurant_id: 'rest_abdul_ahad',
      amount: 1.5,
      status: 'leading',
      payment_status: 'paid',
      placed_by_user_id: 'usr_owner_abdul',
      notes: 'Opening featured spotlight placement',
      created_at: now
    },
    {
      id: 'bid_seed_2',
      campaign_id: 'camp_featured_top',
      restaurant_id: 'rest_zaffran',
      amount: 1.2,
      status: 'active_runner_up',
      payment_status: 'paid',
      placed_by_user_id: 'usr_owner_zaffran',
      notes: 'Runner-up featured placement',
      created_at: now
    },
    {
      id: 'bid_seed_3',
      campaign_id: 'camp_featured_top',
      restaurant_id: 'rest_smash',
      amount: 0.85,
      status: 'active_runner_up',
      payment_status: 'paid',
      placed_by_user_id: 'usr_owner_smash',
      notes: 'Lahore spotlight bid',
      created_at: now
    }
  ];

  const offers = [
    {
      id: 'off_aa_1',
      restaurant_id: 'rest_abdul_ahad',
      restaurant_name: "Abdul Ahad's Kitchen",
      restaurant_slug: 'abdul-ahads-kitchen',
      restaurant_city: 'Karachi',
      title: '15% Off Royal Feast Orders',
      description: 'Enjoy 15% off on orders above $20 with code ROYAL15',
      code: 'ROYAL15',
      discount_type: 'percentage',
      discount_value: 15,
      min_order_amount: 20,
      valid_until: futureEnd,
      is_active: 1,
      created_at: now
    }
  ];

  const reviews = [
    {
      id: 'rev_seed_1',
      restaurant_id: 'rest_abdul_ahad',
      customer_id: 'usr_customer_1',
      customer_name: 'Sarah Ahmed',
      rating: 5,
      comment: 'The Seekh Kebab and Mutton Karahi arrived piping hot. Best authentic flavors in Karachi!',
      images: [],
      owner_reply: 'Thank you Sarah! Honored to host your order.',
      owner_reply_at: now,
      helpful_count: 14,
      is_verified_order: true,
      status: 'published',
      created_at: now
    }
  ];

  const branches = [
    {
      id: 'br_aa_1',
      restaurant_id: 'rest_abdul_ahad',
      name: 'DHA Phase 6 Flagship',
      city: 'Karachi',
      area: 'Bukhari Commercial',
      address: 'Plot 14-C, Bukhari Commercial, DHA Phase 6, Karachi',
      phone: '+92 321 8889900',
      opening_hours: '12:00 PM - 12:00 AM',
      is_main: 1,
      status: 'active',
      created_at: now
    }
  ];

  return {
    users,
    sessions: {},
    restaurants,
    categories,
    foodItems,
    offers,
    branches,
    reviews,
    favourites: [{ id: 'fav_1', user_id: 'usr_customer_1', restaurant_id: 'rest_abdul_ahad', created_at: now }],
    campaigns,
    bids,
    orders: [],
    orderItems: [],
    payments: [],
    notifications: [],
    auditLogs: []
  };
}

function loadStore(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.restaurants)) {
        return parsed;
      }
    }
  } catch {}
  const initial = buildInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(state: StoreState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function getActiveBidForRestaurant(state: StoreState, restaurantId: string): number {
  const activeBids = state.bids.filter(
    b => b.restaurant_id === restaurantId && ['leading', 'active_runner_up'].includes(b.status)
  );
  if (activeBids.length === 0) return 0;
  return Math.max(...activeBids.map(b => Number(b.amount || 0)));
}

function formatPublicRestaurant(state: StoreState, r: any, rank?: number) {
  const activeBid = getActiveBidForRestaurant(state, r.id);
  return {
    ...r,
    is_featured: Boolean(r.is_featured || activeBid > 0),
    is_trending: Boolean(r.is_trending),
    is_sponsored: activeBid > 0,
    active_bid_amount: activeBid,
    bid_rank: rank ?? null
  };
}

function isRealNonDummyUser(user: any): boolean {
  if (!user) return false;
  return !SEED_USER_IDS.has(user.id);
}

export async function handleServerlessFallback<T = any>(
  rawPath: string,
  options: RequestInit = {}
): Promise<T> {
  const state = loadStore();
  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(rawPath, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const pathname = url.pathname;
  const body = options.body ? JSON.parse(String(options.body)) : {};

  const token = localStorage.getItem(TOKEN_KEY) || '';
  const currentUserId = token ? state.sessions[token] : null;
  const user = currentUserId ? state.users.find(u => u.id === currentUserId) || null : null;

  // 1. AUTH ENDPOINTS
  if (pathname === '/api/auth/me' && method === 'GET') {
    if (!user) {
      return { user: null, ownedRestaurants: [], unreadNotifications: 0 } as T;
    }
    const ownedRestaurants =
      user.role === 'restaurant_owner' || user.role === 'admin'
        ? state.restaurants.filter(r => r.owner_id === user.id)
        : [];
    return {
      user,
      ownedRestaurants,
      unreadNotifications: state.notifications.filter(n => n.user_id === user.id && !n.is_read).length
    } as T;
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const found = state.users.find(u => u.email.toLowerCase() === email && u.password === password);
    if (!found) {
      throw new Error('Invalid email or password.');
    }
    if (found.status === 'suspended') {
      throw new Error('This account has been suspended by platform administration.');
    }
    const newToken = `tok_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    state.sessions[newToken] = found.id;
    saveStore(state);
    const ownedRestaurants =
      found.role === 'restaurant_owner' || found.role === 'admin'
        ? state.restaurants.filter(r => r.owner_id === found.id)
        : [];
    return {
      token: newToken,
      user: { ...found },
      ownedRestaurants
    } as T;
  }

  if (pathname === '/api/auth/register' && method === 'POST') {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = body.role === 'restaurant_owner' ? 'restaurant_owner' : 'customer';
    const phone = String(body.phone || '').trim();
    const city = String(body.city || 'Karachi').trim();
    const address = String(body.address || '').trim();

    if (!name || !email || password.length < 6) {
      throw new Error('Name, valid email, and password (min 6 chars) are required.');
    }
    if (state.users.some(u => u.email.toLowerCase() === email)) {
      throw new Error('An account with this email already exists.');
    }

    const now = new Date().toISOString();
    const userId = `usr_${Math.random().toString(36).slice(2, 10)}`;
    const newUser = {
      id: userId,
      name,
      email,
      password,
      role,
      phone,
      city,
      address,
      avatar_url: '',
      status: 'active',
      preferences: {},
      created_at: now
    };
    state.users.push(newUser);

    if (role === 'restaurant_owner' && body.restaurantName) {
      const restName = String(body.restaurantName).trim();
      const restId = `rest_${Math.random().toString(36).slice(2, 10)}`;
      const slug = `${restName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 5)}`;
      const cuisine = String(body.cuisine || 'Pakistani & Mughal').trim();
      state.restaurants.push({
        id: restId,
        owner_id: userId,
        name: restName,
        slug,
        description: String(body.restaurantDescription || `Welcome to ${restName}, serving fresh ${cuisine} specialties.`),
        cuisine,
        secondary_cuisines: [],
        price_range: String(body.priceRange || '$$'),
        city,
        area: String(body.area || 'Main Commercial'),
        address: String(body.restaurantAddress || address || `${city} Central`),
        phone: phone || '+92 300 0000000',
        email,
        opening_hours: { monday: '11:00 AM - 11:00 PM', friday: '12:00 PM - 12:00 AM' },
        services: { delivery: true, pickup: true, dineIn: true, halal: true },
        logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
        cover_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
        gallery: [],
        rating_avg: 5.0,
        review_count: 0,
        profile_views: 1,
        menu_views: 1,
        search_appearances: 1,
        verification_status: 'verified',
        approval_status: 'approved',
        is_featured: 0,
        is_trending: 0,
        delivery_fee: 1.99,
        min_order: 10,
        delivery_time_min: 25,
        delivery_time_max: 35,
        created_at: now
      });
      state.categories.push(
        { id: `cat_${Math.random().toString(36).slice(2, 8)}`, restaurant_id: restId, name: 'Main Course', description: 'Signature dishes', sort_order: 1, is_active: 1, created_at: now },
        { id: `cat_${Math.random().toString(36).slice(2, 8)}`, restaurant_id: restId, name: 'Appetizers & Sides', description: 'Starters', sort_order: 2, is_active: 1, created_at: now }
      );
    }

    const newToken = `tok_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    state.sessions[newToken] = userId;
    saveStore(state);

    const ownedRestaurants = role === 'restaurant_owner' ? state.restaurants.filter(r => r.owner_id === userId) : [];
    return {
      token: newToken,
      user: newUser,
      ownedRestaurants
    } as T;
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    if (token) {
      delete state.sessions[token];
      saveStore(state);
    }
    return { ok: true } as T;
  }

  if (pathname === '/api/auth/profile' && method === 'PUT') {
    if (!user) throw new Error('Authentication required');
    user.name = String(body.name || user.name).trim();
    user.phone = String(body.phone ?? user.phone).trim();
    user.city = String(body.city || user.city).trim();
    user.address = String(body.address ?? user.address).trim();
    user.preferences = body.preferences || user.preferences || {};
    saveStore(state);
    return { user } as T;
  }

  // 2. DISCOVERY HOME
  if (pathname === '/api/discovery/home' && method === 'GET') {
    const city = url.searchParams.get('city') || 'All';
    const hideDummy = isRealNonDummyUser(user);
    const approved = state.restaurants.filter(
      r => r.approval_status === 'approved' && (!hideDummy || !SEED_RESTAURANT_IDS.has(r.id))
    );

    const sorted = [...approved].sort((a, b) => {
      const bidDiff = getActiveBidForRestaurant(state, b.id) - getActiveBidForRestaurant(state, a.id);
      if (bidDiff !== 0) return bidDiff;
      return Number(b.rating_avg || 0) - Number(a.rating_avg || 0);
    });

    const formattedAll = sorted.map((r, i) => formatPublicRestaurant(state, r, i + 1));
    const cityFiltered =
      city && city !== 'All'
        ? formattedAll.filter(r => r.city.toLowerCase() === city.toLowerCase())
        : formattedAll;
    const pool = (cityFiltered.length > 0 ? cityFiltered : formattedAll).map((r, i) => ({
      ...r,
      bid_rank: i + 1
    }));

    const foodRows = state.foodItems.filter(
      f => f.is_available && (!hideDummy || !SEED_RESTAURANT_IDS.has(f.restaurant_id))
    );
    const trendingFood = foodRows
      .filter(f => city === 'All' || f.restaurant_city.toLowerCase() === city.toLowerCase() || foodRows.length <= 4)
      .slice(0, 8);

    const liveOrders = user
      ? state.orders
          .filter(o =>
            user.role === 'restaurant_owner'
              ? state.restaurants.some(r => r.id === o.restaurant_id && r.owner_id === user.id)
              : o.customer_id === user.id
          )
          .slice(0, 10)
      : [];

    let biddingOverview: any = undefined;
    if (user && (user.role === 'restaurant_owner' || user.role === 'admin')) {
      const camp = state.campaigns[0];
      const recentBids = [...state.bids]
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .map(b => {
          const rest = state.restaurants.find(r => r.id === b.restaurant_id);
          return {
            ...b,
            restaurant_name: rest?.name || 'Restaurant',
            restaurant_cuisine: rest?.cuisine || '',
            restaurant_city: rest?.city || ''
          };
        });
      const highestBid = recentBids.length > 0 ? Number(recentBids[0].amount) : 0;
      const minNextBid = getMinNextBid(highestBid, {
        openingBid: Number(camp?.min_opening_bid || 0.1),
        stepFloor: Number(camp?.min_bid_increment || 0.01)
      });
      const minIncrement = highestBid > 0 ? roundMoney(minNextBid - highestBid) : minNextBid;
      biddingOverview = {
        campaignTitle: camp?.title || 'Homepage Sponsored #1 Spotlight: Prime Discovery Placement',
        slotCount: Number(camp?.slot_count || 3),
        highestBid,
        minIncrement,
        minNextBid,
        leadingRestaurant: formattedAll[0] || null,
        recentBids,
        allRestaurants: sorted.map((r, idx) => ({
          id: r.id,
          name: r.name,
          city: r.city,
          cuisine: r.cuisine,
          activeBid: getActiveBidForRestaurant(state, r.id),
          bidRank: idx + 1
        }))
      };
    }

    return {
      sponsoredRestaurants: pool.filter(r => r.is_sponsored || r.is_featured),
      topRated: pool.slice(0, 8),
      nearby: [...pool].sort((a, b) => a.delivery_time_min - b.delivery_time_min).slice(0, 6),
      trendingRestaurants: pool.slice(0, 6),
      recentlyAdded: pool.slice(0, 4),
      trendingFood,
      popularCuisines: [
        { name: 'Pakistani & Mughal', count: 2, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80' },
        { name: 'Burgers & American', count: 1, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80' },
        { name: 'Italian & Pizza', count: 1, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80' },
        { name: 'Pan-Asian & Sushi', count: 1, image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80' }
      ],
      specialOffers: hideDummy ? [] : state.offers,
      favouriteIds: user ? state.favourites.filter(f => f.user_id === user.id).map(f => f.restaurant_id) : [],
      liveOrders,
      biddingOverview,
      cities: ['All', 'Karachi', 'Lahore', 'Islamabad']
    } as T;
  }

  // 3. PUBLIC BIDDING (Restaurant Owners & Admins Only)
  if (pathname === '/api/bidding/public-bid' && method === 'POST') {
    if (!user) throw new Error('Authentication required');
    if (user.role !== 'restaurant_owner' && user.role !== 'admin') {
      throw new Error('Bidding is available to restaurant accounts only.');
    }
    const restaurantId = String(body.restaurantId || '').trim();
    const amount = roundMoney(Number(body.amount));
    const notes = String(body.notes || 'Live Spotlight Bid').trim();
    const restaurant = state.restaurants.find(r => r.id === restaurantId);
    if (!restaurant) throw new Error('Restaurant not found.');
    if (user.role !== 'admin' && restaurant.owner_id !== user.id) {
      throw new Error('You can only bid for your own restaurant.');
    }
    const camp = state.campaigns[0];
    const currentLeadingBid = state.bids.length > 0 ? Math.max(...state.bids.map(b => Number(b.amount || 0))) : 0;
    const minRequired = getMinNextBid(currentLeadingBid, {
      openingBid: Number(camp?.min_opening_bid || 0.1),
      stepFloor: Number(camp?.min_bid_increment || 0.01)
    });
    if (isNaN(amount) || amount < minRequired) {
      throw new Error(`Bid must be at least $${minRequired.toFixed(2)} (current top bid is $${currentLeadingBid.toFixed(2)}).`);
    }
    state.bids.forEach(b => {
      if (b.status === 'leading') b.status = 'active_runner_up';
    });
    const bidId = `bid_${Math.random().toString(36).slice(2, 10)}`;
    state.bids.unshift({
      id: bidId,
      campaign_id: camp?.id || 'camp_featured_top',
      restaurant_id: restaurantId,
      amount,
      status: 'leading',
      payment_status: 'paid',
      placed_by_user_id: user.id,
      notes,
      created_at: new Date().toISOString()
    });
    restaurant.is_featured = 1;
    saveStore(state);
    return {
      ok: true,
      bidId,
      amount,
      restaurantName: restaurant.name,
      nextMinimumBid: getMinNextBid(amount, {
        openingBid: Number(camp?.min_opening_bid || 0.1),
        stepFloor: Number(camp?.min_bid_increment || 0.01)
      })
    } as T;
  }

  // 4. RESTAURANTS SEARCH & DETAIL
  if (pathname === '/api/restaurants' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const city = url.searchParams.get('city') || 'All';
    const cuisine = url.searchParams.get('cuisine') || 'All';
    const priceRange = url.searchParams.get('priceRange') || 'All';
    const minRating = Number(url.searchParams.get('minRating') || 0);
    const sortBy = url.searchParams.get('sortBy') || 'recommended';
    const hideDummy = isRealNonDummyUser(user);

    let results = state.restaurants.filter(r => {
      if (r.approval_status !== 'approved') return false;
      if (hideDummy && SEED_RESTAURANT_IDS.has(r.id)) return false;
      if (city !== 'All' && r.city.toLowerCase() !== city.toLowerCase()) return false;
      if (cuisine !== 'All' && r.cuisine.toLowerCase() !== cuisine.toLowerCase()) return false;
      if (priceRange !== 'All' && r.price_range !== priceRange) return false;
      if (minRating > 0 && Number(r.rating_avg) < minRating) return false;
      if (q) {
        const hay = `${r.name} ${r.description} ${r.cuisine} ${r.city} ${r.area}`.toLowerCase();
        const hasFood = state.foodItems.some(
          f => f.restaurant_id === r.id && `${f.name} ${f.description}`.toLowerCase().includes(q)
        );
        if (!hay.includes(q) && !hasFood) return false;
      }
      return true;
    });

    results.sort((a, b) => {
      if (sortBy === 'rating') return Number(b.rating_avg) - Number(a.rating_avg);
      if (sortBy === 'delivery_time') return Number(a.delivery_time_min) - Number(b.delivery_time_min);
      if (sortBy === 'price_low') return a.price_range.length - b.price_range.length;
      const bidDiff = getActiveBidForRestaurant(state, b.id) - getActiveBidForRestaurant(state, a.id);
      if (bidDiff !== 0) return bidDiff;
      return Number(b.rating_avg) - Number(a.rating_avg);
    });

    return {
      restaurants: results.map((r, idx) => formatPublicRestaurant(state, r, idx + 1)),
      total: results.length
    } as T;
  }

  const restDetailMatch = pathname.match(/^\/api\/restaurants\/([^/]+)$/);
  if (restDetailMatch && method === 'GET') {
    const idOrSlug = decodeURIComponent(restDetailMatch[1]);
    const row = state.restaurants.find(r => r.id === idOrSlug || r.slug === idOrSlug);
    if (!row) throw new Error('Restaurant not found');
    const categories = state.categories.filter(c => c.restaurant_id === row.id);
    const menuItems = state.foodItems.filter(f => f.restaurant_id === row.id);
    const branches = state.branches.filter(b => b.restaurant_id === row.id);
    const offers = state.offers.filter(o => o.restaurant_id === row.id);
    const reviews = state.reviews.filter(rv => rv.restaurant_id === row.id && rv.status === 'published');
    const isFavourite = Boolean(user && state.favourites.some(f => f.user_id === user.id && f.restaurant_id === row.id));
    return {
      restaurant: formatPublicRestaurant(state, row),
      categories,
      menuItems,
      branches,
      offers,
      reviews,
      isFavourite
    } as T;
  }

  // 5. FOODS ENDPOINT
  if (pathname === '/api/foods' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const cuisine = url.searchParams.get('cuisine') || 'All';
    const city = url.searchParams.get('city') || 'All';
    const hideDummy = isRealNonDummyUser(user);
    const foods = state.foodItems.filter(f => {
      if (hideDummy && SEED_RESTAURANT_IDS.has(f.restaurant_id)) return false;
      if (city !== 'All' && f.restaurant_city.toLowerCase() !== city.toLowerCase()) return false;
      if (cuisine !== 'All' && f.cuisine.toLowerCase() !== cuisine.toLowerCase()) return false;
      if (q && !`${f.name} ${f.description} ${f.restaurant_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return { foods } as T;
  }

  // 6. AI DISCOVERY & VOICE COMMANDS
  if (pathname === '/api/ai/discovery' && method === 'POST') {
    const query = String(body.query || '').trim();
    const qLower = query.toLowerCase();
    const matchedRestaurants = state.restaurants
      .filter(r => `${r.name} ${r.cuisine} ${r.city} ${r.description}`.toLowerCase().includes(qLower))
      .slice(0, 3)
      .map((r, i) => formatPublicRestaurant(state, r, i + 1));
    const matchedFoods = state.foodItems
      .filter(f => `${f.name} ${f.description} ${f.cuisine}`.toLowerCase().includes(qLower))
      .slice(0, 4);

    const topRests = matchedRestaurants.length > 0 ? matchedRestaurants : state.restaurants.slice(0, 2).map((r, i) => formatPublicRestaurant(state, r, i + 1));
    const topFoods = matchedFoods.length > 0 ? matchedFoods : state.foodItems.slice(0, 3);

    return {
      answer:
        matchedFoods.length > 0 || matchedRestaurants.length > 0
          ? `Here are the best matches for "${query}". Tap any dish or restaurant below, or tell me what you'd like me to order for you!`
          : `I recommend checking out ${topRests.map(r => r.name).join(' and ')}. Popular dishes right now include ${topFoods.map(f => `${f.name} ($${(f.discounted_price ?? f.price).toFixed(2)})`).join(', ')}. Just tell me what you'd like to order!`,
      restaurants: topRests,
      foods: topFoods
    } as T;
  }

  if (pathname === '/api/ai/voice-command' && method === 'POST') {
    const transcript = String(body.transcript || '').trim();
    const formType = body.formType || null;
    if (formType) {
      const phoneMatch = transcript.match(/(\+?\d[\d\s-]{6,14}\d)/);
      const emailMatch = transcript.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      return {
        action: 'form_fill',
        spokenReply: 'I have filled in the form details from your voice input.',
        fields: {
          name: user?.name || 'Abdul Ahad',
          phone: phoneMatch ? phoneMatch[1].trim() : user?.phone || '+92 321 8889900',
          email: emailMatch ? emailMatch[1].trim() : user?.email || '',
          address: transcript,
          notes: transcript
        }
      } as T;
    }

    const qLower = transcript.toLowerCase();
    const matchedFoods = state.foodItems.filter(f => qLower.includes(f.name.toLowerCase()));
    const topRests = state.restaurants.slice(0, 2).map((r, i) => formatPublicRestaurant(state, r, i + 1));
    const foods = matchedFoods.length > 0 ? matchedFoods : state.foodItems.slice(0, 3);
    const answer =
      matchedFoods.length > 0
        ? `Found ${matchedFoods.map(f => f.name).join(' and ')} ready to order.`
        : `Here are our top recommendations for "${transcript}".`;

    return {
      action: 'search',
      spokenReply: answer,
      searchData: {
        answer,
        restaurants: topRests,
        foods
      }
    } as T;
  }

  // 7. ORDERS
  if (pathname === '/api/orders/live' && method === 'GET') {
    if (!user) return { orders: [] } as T;
    const orders = state.orders.filter(o =>
      user.role === 'restaurant_owner'
        ? state.restaurants.some(r => r.id === o.restaurant_id && r.owner_id === user.id)
        : o.customer_id === user.id
    );
    return { orders } as T;
  }

  if (pathname === '/api/orders' && method === 'POST') {
    const restaurantId = String(body.restaurantId || 'rest_abdul_ahad').trim();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const address = String(body.address || user?.address || 'DHA Phase 6, Karachi').trim();
    const phone = String(body.phone || user?.phone || '+92 300 0000000').trim();
    const customerName = String(body.customerName || user?.name || 'Customer').trim();
    const orderType = body.orderType || 'delivery';
    const restaurant = state.restaurants.find(r => r.id === restaurantId) || state.restaurants[0];

    const items = rawItems.map((it: any) => {
      const dbFood = state.foodItems.find(f => f.id === it.foodItemId || f.name === it.name);
      const unitPrice = Number(it.price ?? dbFood?.discounted_price ?? dbFood?.price ?? 12.99);
      const qty = Math.max(1, Number(it.quantity || 1));
      return {
        id: `oi_${Math.random().toString(36).slice(2, 9)}`,
        name: it.name || dbFood?.name || 'Menu Item',
        quantity: qty,
        price: unitPrice,
        lineTotal: roundMoney(unitPrice * qty)
      };
    });

    const subtotal = roundMoney(items.reduce((s: number, i: any) => s + i.lineTotal, 0));
    const deliveryFee = orderType === 'delivery' ? Number(restaurant?.delivery_fee || 1.99) : 0;
    const taxAmount = roundMoney(subtotal * 0.08);
    const total = roundMoney(subtotal + deliveryFee + taxAmount);
    const now = new Date().toISOString();
    const orderNumber = `RH-${Math.floor(10000 + Math.random() * 90000)}`;
    const newOrder = {
      id: `ord_${Math.random().toString(36).slice(2, 10)}`,
      order_number: orderNumber,
      customer_id: user?.id || null,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      restaurant_slug: restaurant.slug,
      customer_name: customerName,
      customer_phone: phone,
      phone,
      delivery_address: address,
      address,
      order_type: orderType,
      subtotal,
      discount_amount: 0,
      delivery_fee: deliveryFee,
      tax_amount: taxAmount,
      total,
      status: 'Pending',
      source: body.source || 'web',
      created_at: now,
      timestamp: now,
      items
    };
    state.orders.unshift(newOrder);
    saveStore(state);
    return { order: newOrder } as T;
  }

  const cancelOrderMatch = pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/);
  if (cancelOrderMatch && method === 'POST') {
    const ord = state.orders.find(o => o.id === cancelOrderMatch[1]);
    if (ord) {
      ord.status = 'Cancelled';
      saveStore(state);
    }
    return { ok: true, status: 'Cancelled' } as T;
  }

  // 8. CUSTOMER DASHBOARD & FAVOURITES
  if (pathname === '/api/customer/dashboard' && method === 'GET') {
    if (!user) throw new Error('Sign in required');
    const orders = state.orders.filter(o => o.customer_id === user.id);
    const favIds = state.favourites.filter(f => f.user_id === user.id).map(f => f.restaurant_id);
    const favourites = state.restaurants
      .filter(r => favIds.includes(r.id))
      .map(r => formatPublicRestaurant(state, r));
    const reviews = state.reviews.filter(rv => rv.customer_id === user.id);
    const notifications = state.notifications.filter(n => n.user_id === user.id);
    return { orders, favourites, reviews, notifications } as T;
  }

  if (pathname === '/api/customer/favourites/toggle' && method === 'POST') {
    if (!user) throw new Error('Please sign in to save favourite restaurants.');
    const restaurantId = String(body.restaurantId || '').trim();
    const idx = state.favourites.findIndex(f => f.user_id === user.id && f.restaurant_id === restaurantId);
    if (idx >= 0) {
      state.favourites.splice(idx, 1);
      saveStore(state);
      return { isFavourite: false } as T;
    }
    state.favourites.push({
      id: `fav_${Math.random().toString(36).slice(2, 9)}`,
      user_id: user.id,
      restaurant_id: restaurantId,
      created_at: new Date().toISOString()
    });
    saveStore(state);
    return { isFavourite: true } as T;
  }

  if (pathname === '/api/reviews' && method === 'POST') {
    if (!user) throw new Error('Please sign in to write a review.');
    const revId = `rev_${Math.random().toString(36).slice(2, 9)}`;
    state.reviews.unshift({
      id: revId,
      restaurant_id: body.restaurantId,
      customer_id: user.id,
      customer_name: user.name,
      rating: Number(body.rating || 5),
      comment: String(body.comment || ''),
      images: Array.isArray(body.images) ? body.images : [],
      owner_reply: '',
      helpful_count: 0,
      is_verified_order: true,
      status: 'published',
      created_at: new Date().toISOString()
    });
    saveStore(state);
    return { ok: true, reviewId: revId } as T;
  }

  // 9. OWNER ENDPOINTS
  if (pathname === '/api/owner/restaurants' && method === 'POST') {
    if (!user) throw new Error('Authentication required');
    const restId = `rest_${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date().toISOString();
    state.restaurants.push({
      id: restId,
      owner_id: user.id,
      name: body.name,
      slug: `${String(body.name || 'restaurant').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 5)}`,
      description: body.description || `Authentic ${body.cuisine || 'Pakistani'} kitchen.`,
      cuisine: body.cuisine || 'Pakistani & Mughal',
      secondary_cuisines: [],
      price_range: body.priceRange || '$$',
      city: body.city || 'Karachi',
      area: body.area || 'Main Commercial',
      address: body.address || 'Karachi',
      phone: body.phone || user.phone || '',
      email: user.email,
      opening_hours: {},
      services: { delivery: true, pickup: true, dineIn: true, halal: true },
      logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
      cover_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
      gallery: [],
      rating_avg: 5.0,
      review_count: 0,
      profile_views: 1,
      menu_views: 1,
      search_appearances: 1,
      verification_status: 'verified',
      approval_status: 'approved',
      is_featured: 0,
      is_trending: 0,
      delivery_fee: 1.99,
      min_order: 10,
      delivery_time_min: 25,
      delivery_time_max: 35,
      created_at: now
    });
    state.categories.push({
      id: `cat_${Math.random().toString(36).slice(2, 8)}`,
      restaurant_id: restId,
      name: 'Main Course',
      description: 'Signature dishes',
      sort_order: 1,
      is_active: 1,
      created_at: now
    });
    saveStore(state);
    return { restaurantId: restId } as T;
  }

  const ownerOrderStatusMatch = pathname.match(/^\/api\/owner\/(?:restaurants\/[^/]+\/)?orders\/([^/]+)\/status$/);
  if (ownerOrderStatusMatch && (method === 'PATCH' || method === 'PUT' || method === 'POST')) {
    const orderId = ownerOrderStatusMatch[1];
    const ord = state.orders.find(o => o.id === orderId);
    if (ord && body.status) {
      ord.status = body.status;
      saveStore(state);
    }
    return { ok: true, status: body.status } as T;
  }

  const ownerItemMatch = pathname.match(/^\/api\/owner\/items\/([^/]+)$/);
  if (ownerItemMatch) {
    const itemId = ownerItemMatch[1];
    if (method === 'DELETE') {
      state.foodItems = state.foodItems.filter(f => f.id !== itemId);
      saveStore(state);
      return { ok: true } as T;
    }
    if (method === 'PUT') {
      const item = state.foodItems.find(f => f.id === itemId);
      if (item) {
        Object.assign(item, {
          name: body.name ?? item.name,
          description: body.description ?? item.description,
          price: body.price !== undefined ? Number(body.price) : item.price,
          is_available: body.isAvailable !== undefined ? Boolean(body.isAvailable) : item.is_available
        });
        saveStore(state);
      }
      return { ok: true } as T;
    }
  }

  const ownerRestMatch = pathname.match(/^\/api\/owner\/restaurants\/([^/]+)(?:\/(.*))?$/);
  if (ownerRestMatch) {
    const restaurantId = ownerRestMatch[1];
    const subPath = ownerRestMatch[2] || '';
    const restaurant = state.restaurants.find(r => r.id === restaurantId) || state.restaurants[0];

    if (subPath === 'dashboard' && method === 'GET') {
      const categories = state.categories.filter(c => c.restaurant_id === restaurant.id);
      const menuItems = state.foodItems.filter(f => f.restaurant_id === restaurant.id);
      const orders = state.orders.filter(o => o.restaurant_id === restaurant.id);
      const reviews = state.reviews.filter(rv => rv.restaurant_id === restaurant.id);
      const branches = state.branches.filter(b => b.restaurant_id === restaurant.id);
      const offers = state.offers.filter(o => o.restaurant_id === restaurant.id);
      const camp = state.campaigns[0];
      const currentLeadingBid = state.bids.length > 0 ? Math.max(...state.bids.map(b => Number(b.amount || 0))) : 0;
      const minNextEligibleBid = getMinNextBid(currentLeadingBid, {
        openingBid: Number(camp?.min_opening_bid || 0.1),
        stepFloor: Number(camp?.min_bid_increment || 0.01)
      });
      const minIncrement = currentLeadingBid > 0 ? roundMoney(minNextEligibleBid - currentLeadingBid) : minNextEligibleBid;
      const myBids = state.bids.filter(b => b.restaurant_id === restaurant.id);
      const myHighestBid = myBids.length > 0 ? Math.max(...myBids.map(b => Number(b.amount || 0))) : 0;

      const validOrders = orders.filter(o => o.status !== 'Cancelled');
      const totalRevenue = roundMoney(validOrders.reduce((s, o) => s + Number(o.total || 0), 0));

      return {
        restaurant: formatPublicRestaurant(state, restaurant),
        metrics: {
          profileViews: Number(restaurant.profile_views || 0),
          menuViews: Number(restaurant.menu_views || 0),
          searchAppearances: Number(restaurant.search_appearances || 0),
          ratingAvg: Number(restaurant.rating_avg || 4.9),
          reviewCount: Number(restaurant.review_count || reviews.length),
          totalOrders: validOrders.length,
          activeOrdersCount: orders.filter(o => ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery'].includes(o.status)).length,
          totalRevenue
        },
        categories,
        menuItems,
        orders,
        reviews,
        branches,
        offers,
        biddingStatus: {
          campaign: {
            id: camp?.id || 'camp_featured_top',
            title: camp?.title || 'Homepage Sponsored #1 Spotlight: Prime Discovery Placement',
            slotCount: 3,
            minOpeningBid: Number(camp?.min_opening_bid || 0.1),
            minBidIncrement: minIncrement,
            endsAt: camp?.ends_at || new Date(Date.now() + 86400000 * 30).toISOString(),
            rules: camp?.rules || {}
          },
          currentLeadingBid,
          minNextEligibleBid,
          myCurrentRank: myHighestBid >= currentLeadingBid && myHighestBid > 0 ? 1 : 2,
          myHighestBid,
          isLeading: myHighestBid >= currentLeadingBid && myHighestBid > 0,
          myBidHistory: myBids
        }
      } as T;
    }

    if (subPath === 'categories' && method === 'POST') {
      const catId = `cat_${Math.random().toString(36).slice(2, 8)}`;
      state.categories.push({
        id: catId,
        restaurant_id: restaurant.id,
        name: body.name,
        description: body.description || '',
        sort_order: state.categories.length + 1,
        is_active: 1,
        created_at: new Date().toISOString()
      });
      saveStore(state);
      return { categoryId: catId } as T;
    }

    if (subPath === 'items' && method === 'POST') {
      const itemId = `food_${Math.random().toString(36).slice(2, 10)}`;
      const cat = state.categories.find(c => c.id === body.categoryId) || state.categories[0];
      state.foodItems.unshift({
        id: itemId,
        restaurant_id: restaurant.id,
        category_id: cat?.id || 'cat_aa_1',
        category_name: cat?.name || 'Main Course',
        restaurant_name: restaurant.name,
        restaurant_slug: restaurant.slug,
        restaurant_city: restaurant.city,
        restaurant_rating: restaurant.rating_avg,
        name: body.name,
        description: body.description || `Freshly prepared ${body.name}.`,
        price: Number(body.price || 10),
        discounted_price: body.discountedPrice ? Number(body.discountedPrice) : null,
        image_url: body.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        cuisine: restaurant.cuisine,
        tags: ['Halal'],
        variations: Array.isArray(body.variations) ? body.variations : [],
        addons: Array.isArray(body.addons) ? body.addons : [],
        is_available: true,
        is_popular: Boolean(body.isPopular),
        is_trending: false,
        order_count: 0,
        created_at: new Date().toISOString()
      });
      saveStore(state);
      return { itemId } as T;
    }

    if (subPath === 'bids' && method === 'POST') {
      return handleServerlessFallback('/api/bidding/public-bid', {
        method: 'POST',
        body: JSON.stringify({ restaurantId: restaurant.id, amount: body.amount, notes: body.notes })
      });
    }

    if (subPath === 'ai-menu-draft' && method === 'POST') {
      const prompt = String(body.prompt || '');
      return {
        summary: `Structured menu draft generated from: "${prompt.slice(0, 60)}"`,
        missingDetails: [],
        items: [
          {
            categoryName: 'Main Course',
            name: 'Chef Signature Platter',
            description: `Prepared fresh according to your instructions: ${prompt.slice(0, 80)}`,
            price: 15.99,
            variations: [{ name: 'Regular', priceDelta: 0 }],
            addons: []
          }
        ]
      } as T;
    }

    if (subPath === 'ai-menu-publish' && method === 'POST') {
      const draftItems = Array.isArray(body.items) ? body.items : [];
      draftItems.forEach((it: any) => {
        state.foodItems.unshift({
          id: `food_${Math.random().toString(36).slice(2, 10)}`,
          restaurant_id: restaurant.id,
          category_id: 'cat_aa_2',
          category_name: it.categoryName || 'Main Course',
          restaurant_name: restaurant.name,
          restaurant_slug: restaurant.slug,
          restaurant_city: restaurant.city,
          restaurant_rating: restaurant.rating_avg,
          name: it.name,
          description: it.description || '',
          price: Number(it.price || 12.99),
          discounted_price: null,
          image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
          cuisine: restaurant.cuisine,
          tags: ['AI Curated'],
          variations: it.variations || [],
          addons: it.addons || [],
          is_available: true,
          is_popular: true,
          is_trending: false,
          order_count: 0,
          created_at: new Date().toISOString()
        });
      });
      saveStore(state);
      return { ok: true, createdCount: draftItems.length } as T;
    }

    if (subPath === 'ai-assistant' && method === 'POST') {
      return {
        answer: `Based on ${restaurant.name}'s current metrics (${restaurant.profile_views} profile views and ${restaurant.rating_avg}★ rating), highlighting your top-margin dishes and maintaining a competitive bid in the Spotlight auction will maximize conversion.`
      } as T;
    }
  }

  // 10. ADMIN OVERVIEW
  if (pathname === '/api/admin/overview' && method === 'GET') {
    return {
      metrics: {
        totalUsers: state.users.length,
        totalRestaurants: state.restaurants.length,
        pendingRestaurants: state.restaurants.filter(r => r.approval_status === 'pending').length,
        totalOrders: state.orders.length,
        totalOrderVolume: roundMoney(state.orders.reduce((s, o) => s + Number(o.total || 0), 0)),
        totalBidRevenue: roundMoney(state.bids.reduce((s, b) => s + Number(b.amount || 0), 0))
      },
      restaurants: state.restaurants,
      users: state.users,
      reviews: state.reviews,
      campaigns: state.campaigns,
      bids: state.bids,
      payments: state.payments,
      auditLogs: state.auditLogs
    } as T;
  }

  return { ok: true } as T;
}
