import { getDb, recalculateRestaurantRating } from './db';
import { hashPassword, logAudit, createNotification } from './auth';

export const SEED_USER_IDS = new Set([
  'usr_admin_1',
  'usr_owner_abdul',
  'usr_owner_zaffran',
  'usr_owner_smash',
  'usr_customer_1'
]);

export const SEED_RESTAURANT_IDS = new Set([
  'rest_abdul_ahad',
  'rest_zaffran',
  'rest_smash',
  'rest_sakura',
  'rest_napoli',
  'rest_levant',
  'rest_green',
  'rest_pending_lahore'
]);

export function ensureSeeded() {
  const db = getDb();
  const existingUsers = db.prepare(`SELECT COUNT(*) as cnt FROM users`).get() as { cnt: number };
  if (existingUsers && Number(existingUsers.cnt) > 0) {
    // Ensure verified working food photography URLs on existing database records
    db.prepare(`UPDATE food_items SET image_url = ? WHERE id = 'food_aa_1'`).run('https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80');
    db.prepare(`UPDATE food_items SET image_url = ? WHERE id = 'food_aa_6'`).run('https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80');
    db.prepare(`UPDATE food_items SET image_url = ? WHERE id = 'food_aa_8'`).run('https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80');
    // Migrate legacy flat $5 / $25 campaign rules to scaling bids
    db.prepare(`UPDATE ranking_campaigns SET min_opening_bid = 0.10, min_bid_increment = 0.01 WHERE min_opening_bid = 25 AND min_bid_increment = 5`).run();
    db.prepare(`UPDATE ranking_campaigns SET title = ? WHERE id = 'camp_featured_top' AND title LIKE '%—%'`).run('Homepage Sponsored #1 Spotlight: Prime Discovery Placement');
    // Remove any previously seeded hardcoded orders so orders start clean
    db.exec(`
      DELETE FROM order_items WHERE order_id IN ('ord_seed_1', 'ord_seed_2', 'ord_live_demo_1', 'ord_live_demo_2');
      DELETE FROM orders WHERE id IN ('ord_seed_1', 'ord_seed_2', 'ord_live_demo_1', 'ord_live_demo_2');
      DELETE FROM payments WHERE id IN ('pay_1', 'pay_2');
    `);
    return;
  }

  const now = new Date().toISOString();
  const defaultPass = hashPassword('Password123!');

  db.exec('BEGIN IMMEDIATE;');
  try {
    // 1. Seed Users
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, phone, city, address, avatar_url, status, preferences_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `);

    insertUser.run(
      'usr_admin_1',
      'Zainab Mirza (Platform Admin)',
      'admin@restauranthub.com',
      defaultPass,
      'admin',
      '+92 300 1112233',
      'Karachi',
      'Restaurant Hub HQ, Clifton Block 4, Karachi',
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
      JSON.stringify({ theme: 'light', notifications: true }),
      now,
      now
    );

    insertUser.run(
      'usr_owner_abdul',
      'Abdul Ahad',
      'owner@abdulahadkitchen.com',
      defaultPass,
      'restaurant_owner',
      '+92 321 8889900',
      'Karachi',
      'Plot 14-C, Bukhari Commercial, DHA Phase 6, Karachi',
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=250&q=80',
      JSON.stringify({ notifications: true }),
      now,
      now
    );

    insertUser.run(
      'usr_owner_zaffran',
      'Chef Tariq Mehmood',
      'owner@zaffran.com',
      defaultPass,
      'restaurant_owner',
      '+92 333 4445566',
      'Karachi',
      'Tipu Sultan Road, Karachi',
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=250&q=80',
      JSON.stringify({ notifications: true }),
      now,
      now
    );

    insertUser.run(
      'usr_owner_smash',
      'Hamza Siddiqui',
      'owner@craftsmash.com',
      defaultPass,
      'restaurant_owner',
      '+92 301 7776655',
      'Lahore',
      'MM Alam Road, Gulberg III, Lahore',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      JSON.stringify({ notifications: true }),
      now,
      now
    );

    insertUser.run(
      'usr_customer_1',
      'Sarah Ahmed',
      'customer@restauranthub.com',
      defaultPass,
      'customer',
      '+92 345 2223344',
      'Karachi',
      'House 42, Street 10, DHA Phase 5, Karachi',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80',
      JSON.stringify({ dietary: ['Halal'], favoriteCuisines: ['Pakistani & Mughal', 'Burgers & American'] }),
      now,
      now
    );

    insertUser.run(
      'usr_customer_2',
      'Omar Farooq',
      'omar@example.com',
      defaultPass,
      'customer',
      '+92 312 9988776',
      'Karachi',
      'Apartment 8B, Sea View Residency, Clifton, Karachi',
      '',
      JSON.stringify({ dietary: ['Halal'] }),
      now,
      now
    );

    // 2. Seed Restaurants
    const insertRestaurant = db.prepare(`
      INSERT INTO restaurants (
        id, owner_id, name, slug, description, cuisine, secondary_cuisines, price_range,
        city, area, address, latitude, longitude, phone, email, opening_hours_json, services_json,
        logo_url, cover_url, gallery_json, rating_avg, review_count, profile_views, menu_views, search_appearances,
        verification_status, approval_status, is_featured, is_trending,
        delivery_fee, min_order, delivery_time_min, delivery_time_max, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    const defaultHours = JSON.stringify({
      monday: '11:30 AM - 11:45 PM',
      tuesday: '11:30 AM - 11:45 PM',
      wednesday: '11:30 AM - 11:45 PM',
      thursday: '11:30 AM - 11:45 PM',
      friday: '12:00 PM - 1:00 AM',
      saturday: '12:00 PM - 1:00 AM',
      sunday: '12:00 PM - 11:45 PM'
    });

    // Restaurant 1: Abdul Ahad's Kitchen (Preserved & Expanded Flagship)
    insertRestaurant.run(
      'rest_abdul_ahad',
      'usr_owner_abdul',
      "Abdul Ahad's Kitchen",
      'abdul-ahads-kitchen',
      'Signature subcontinental heritage kitchen crafting flame-grilled kebabs, slow-cooked dum biryanis, artisan clay-oven breads, and traditional karahi dishes with real-time AI Voice Concierge ordering.',
      'Pakistani & Mughal',
      JSON.stringify(['BBQ & Grill', 'Biryani', 'Desi']),
      '$$',
      'Karachi',
      'DHA Phase 6',
      'Plot 14-C, Bukhari Commercial, DHA Phase 6, Karachi',
      24.7936,
      67.0642,
      '+92 321 8889900',
      'concierge@abdulahadkitchen.com',
      defaultHours,
      JSON.stringify({
        delivery: true,
        pickup: true,
        dineIn: true,
        familySeating: true,
        halal: true,
        voiceOrdering: true,
        outdoorSeating: true
      }),
      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
      JSON.stringify([
        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80'
      ]),
      4.9,
      3,
      1420,
      980,
      2840,
      'verified',
      'approved',
      1,
      1,
      1.99,
      8.00,
      25,
      35,
      now,
      now
    );

    // Restaurant 2: Zaffran Royal Dum & Charcoal
    insertRestaurant.run(
      'rest_zaffran',
      'usr_owner_zaffran',
      'Zaffran Royal Dum & Grill',
      'zaffran-royal-dum-grill',
      'Celebrated family dining destination famous for saffron-infused Matka Biryani, smoky Peshawari Namkeen Roast, and royal Mughal platters.',
      'Pakistani & Mughal',
      JSON.stringify(['Biryani', 'BBQ & Grill', 'Family Dining']),
      '$$$',
      'Karachi',
      'Clifton Block 2',
      'Marine Promenade, Clifton Block 2, Karachi',
      24.8138,
      67.0303,
      '+92 333 4445566',
      'hello@zaffranroyal.com',
      defaultHours,
      JSON.stringify({
        delivery: true,
        pickup: true,
        dineIn: true,
        familySeating: true,
        halal: true,
        valetParking: true
      }),
      'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1400&q=80',
      JSON.stringify([
        'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80'
      ]),
      4.7,
      2,
      1150,
      790,
      2100,
      'verified',
      'approved',
      1,
      1,
      2.49,
      12.00,
      30,
      45,
      now,
      now
    );

    // Restaurant 3: Craft Smash & Co.
    insertRestaurant.run(
      'rest_smash',
      'usr_owner_smash',
      'Craft Smash & Co.',
      'craft-smash-and-co',
      'Crispy lacy-edged Angus smash burgers, truffle parmesan fries, Nashville hot chicken tenders, and artisanal thick shakes.',
      'Burgers & American',
      JSON.stringify(['Fast Casual', 'Fried Chicken', 'Desserts']),
      '$$',
      'Karachi',
      'Tipu Sultan',
      'Shop 4, Main Tipu Sultan Road, Karachi',
      24.8762,
      67.0791,
      '+92 301 7776655',
      'orders@craftsmash.com',
      defaultHours,
      JSON.stringify({
        delivery: true,
        pickup: true,
        dineIn: true,
        familySeating: false,
        halal: true,
        lateNight: true
      }),
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1400&q=80',
      JSON.stringify([
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80'
      ]),
      4.8,
      2,
      980,
      720,
      1890,
      'verified',
      'approved',
      1,
      1,
      1.49,
      7.00,
      20,
      30,
      now,
      now
    );

    // Restaurant 4: Forno Napoli Pizzeria
    insertRestaurant.run(
      'rest_napoli',
      'usr_owner_zaffran',
      'Forno Napoli Wood-Fired',
      'forno-napoli-wood-fired',
      'Authentic 48-hour fermented Neapolitan sourdough pizzas baked in an imported oak-fired brick oven at 485°C, plus handmade fresh pastas.',
      'Italian & Pizza',
      JSON.stringify(['Pizza', 'Pasta', 'Mediterranean']),
      '$$$',
      'Karachi',
      'Zamzama, DHA Phase 5',
      '18-E Zamzama Boulevard, DHA Phase 5, Karachi',
      24.8182,
      67.0419,
      '+92 300 9900112',
      'ciao@fornonapoli.pk',
      defaultHours,
      JSON.stringify({
        delivery: true,
        pickup: true,
        dineIn: true,
        familySeating: true,
        halal: true,
        outdoorSeating: true
      }),
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1400&q=80',
      JSON.stringify([
        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80'
      ]),
      4.6,
      1,
      640,
      430,
      1210,
      'verified',
      'approved',
      0,
      1,
      1.99,
      10.00,
      25,
      40,
      now,
      now
    );

    // Restaurant 5: Sakura Wok & Sushi Bar
    insertRestaurant.run(
      'rest_sakura',
      'usr_owner_smash',
      'Sakura Wok & Sushi Bar',
      'sakura-wok-and-sushi',
      'Contemporary Pan-Asian kitchen serving hand-rolled tempura maki, fiery Sichuan chili beef, Korean dakgangjeong, and steaming ramen bowls.',
      'Pan-Asian & Sushi',
      JSON.stringify(['Japanese', 'Chinese', 'Thai']),
      '$$$',
      'Lahore',
      'Gulberg III',
      '45 MM Alam Road, Gulberg III, Lahore',
      31.5102,
      74.3441,
      '+92 42 35751122',
      'dine@sakurawok.pk',
      defaultHours,
      JSON.stringify({
        delivery: true,
        pickup: true,
        dineIn: true,
        familySeating: true,
        halal: true
      }),
      'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1400&q=80',
      JSON.stringify([]),
      4.8,
      1,
      540,
      390,
      980,
      'verified',
      'approved',
      1,
      0,
      2.20,
      12.00,
      30,
      45,
      now,
      now
    );

    // Restaurant 6: Levantine Cedar Grill (Affordable & Family Favorite)
    insertRestaurant.run(
      'rest_cedar',
      'usr_owner_abdul',
      'Cedar & Sumac Lebanese Grill',
      'cedar-and-sumac-grill',
      'Freshly baked pita, smoky charcoal shish taouk, silky hummus beiruti, crispy falafel wraps, and pomegranate-glazed lamb chops.',
      'Middle Eastern & Arabian',
      JSON.stringify(['Shawarma', 'Healthy & Bowls', 'BBQ & Grill']),
      '$',
      'Karachi',
      'Bahadurabad',
      'Char Minar Chowrangi, Bahadurabad, Karachi',
      24.8825,
      67.0672,
      '+92 321 5556677',
      'salam@cedarsumac.com',
      defaultHours,
      JSON.stringify({
        delivery: true,
        pickup: true,
        dineIn: true,
        familySeating: true,
        halal: true
      }),
      'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1400&q=80',
      JSON.stringify([]),
      4.5,
      1,
      490,
      360,
      890,
      'verified',
      'approved',
      0,
      0,
      1.20,
      6.00,
      20,
      30,
      now,
      now
    );

    // Restaurant 7: Emerald Greens & Roastery (Islamabad + Pending Verification Demo for Admin)
    insertRestaurant.run(
      'rest_emerald',
      'usr_owner_smash',
      'Emerald Roast & Artisan Bowls',
      'emerald-roast-artisan-bowls',
      'Specialty single-origin coffee, macro-balanced Mediterranean grain bowls, sourdough tartines, and sugar-free matcha desserts.',
      'Cafe & Healthy',
      JSON.stringify(['Coffee', 'Healthy & Bowls', 'Desserts']),
      '$$',
      'Islamabad',
      'F-6 Markaz',
      'Street 12, Beverly Centre, F-6 Markaz, Islamabad',
      33.7294,
      73.0761,
      '+92 51 2823344',
      'hello@emeraldroast.pk',
      defaultHours,
      JSON.stringify({
        delivery: true,
        pickup: true,
        dineIn: true,
        familySeating: true,
        halal: true,
        wifi: true
      }),
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=80',
      JSON.stringify([]),
      4.9,
      1,
      310,
      220,
      560,
      'verified',
      'approved',
      0,
      1,
      1.50,
      8.00,
      20,
      35,
      now,
      now
    );

    // Restaurant 8: Pending Approval Restaurant (For Admin Verification Queue)
    insertRestaurant.run(
      'rest_pending_lahore',
      'usr_owner_zaffran',
      ' Haveli Tawa & Karahi House',
      'haveli-tawa-karahi-house',
      'Traditional Walled City Lahore tawa chicken, Taka-Tak, and creamy sweet lassi.',
      'Pakistani & Mughal',
      JSON.stringify(['Desi', 'Karahi']),
      '$$',
      'Lahore',
      'Fort Road',
      'Food Street, Fort Road, Lahore',
      31.5880,
      74.3105,
      '+92 300 4449988',
      'info@havelitawa.pk',
      defaultHours,
      JSON.stringify({ delivery: true, dineIn: true, familySeating: true, halal: true }),
      'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
      JSON.stringify([]),
      0,
      0,
      20,
      10,
      30,
      'pending',
      'pending',
      0,
      0,
      1.50,
      8.00,
      30,
      45,
      now,
      now
    );

    // 3. Seed Branches
    const insertBranch = db.prepare(`
      INSERT INTO restaurant_branches (id, restaurant_id, name, city, area, address, phone, opening_hours, is_main, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `);

    insertBranch.run('br_abdul_1', 'rest_abdul_ahad', 'DHA Phase 6 Flagship', 'Karachi', 'DHA Phase 6', 'Plot 14-C, Bukhari Commercial, DHA Phase 6, Karachi', '+92 321 8889900', '11:30 AM - 12:30 AM', 1, now);
    insertBranch.run('br_abdul_2', 'rest_abdul_ahad', 'Gulshan-e-Iqbal Branch', 'Karachi', 'Block 13-D', 'Main University Road, Gulshan-e-Iqbal, Karachi', '+92 321 8889901', '12:00 PM - 12:00 AM', 0, now);
    insertBranch.run('br_zaffran_1', 'rest_zaffran', 'Clifton Marine Drive', 'Karachi', 'Clifton Block 2', 'Marine Promenade, Clifton Block 2, Karachi', '+92 333 4445566', '12:00 PM - 1:00 AM', 1, now);
    insertBranch.run('br_smash_1', 'rest_smash', 'Tipu Sultan Lounge', 'Karachi', 'Tipu Sultan', 'Shop 4, Main Tipu Sultan Road, Karachi', '+92 301 7776655', '12:00 PM - 2:00 AM', 1, now);

    // 4. Seed Menu Categories & Food Items
    const insertCategory = db.prepare(`
      INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);

    const insertFood = db.prepare(`
      INSERT INTO food_items (
        id, restaurant_id, category_id, name, description, price, discounted_price,
        image_url, cuisine, tags_json, variations_json, addons_json,
        is_available, is_popular, is_trending, order_count, sort_order, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        1, ?, ?, ?, ?, ?, ?
      )
    `);

    // --- Abdul Ahad's Kitchen Categories & Original 8 Menu Items ---
    insertCategory.run('cat_aa_app', 'rest_abdul_ahad', 'Appetizers', 'Charcoal-grilled starters and crispy handmade savories', 1, now);
    insertCategory.run('cat_aa_main', 'rest_abdul_ahad', 'Main Course', 'Signature Dum Biryanis, traditional Karahis, and rich handi curries', 2, now);
    insertCategory.run('cat_aa_bread', 'rest_abdul_ahad', 'Breads', 'Freshly baked clay-oven tandoori naans and parathas', 3, now);
    insertCategory.run('cat_aa_drinks', 'rest_abdul_ahad', 'Drinks', 'House-churned lassis and refreshing beverages', 4, now);
    insertCategory.run('cat_aa_dessert', 'rest_abdul_ahad', 'Desserts', 'Warm subcontinental sweets infused with cardamom and saffron', 5, now);

    // Item 1: Seekh Kebab
    insertFood.run(
      'food_aa_1',
      'rest_abdul_ahad',
      'cat_aa_app',
      'Seekh Kebab',
      'Minced lamb mixed with fresh herbs and spices, grilled to perfection over glowing charcoal.',
      12.99,
      null,
      'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Chef Special', 'BBQ', 'High Protein']),
      JSON.stringify([
        { name: 'Regular (4 Pcs)', priceDelta: 0 },
        { name: 'Family Platter (8 Pcs)', priceDelta: 10.00 }
      ]),
      JSON.stringify([
        { name: 'Mint Tamarind Chutney', price: 0.99 },
        { name: 'Sizzling Onion Bed', price: 1.50 }
      ]),
      1,
      1,
      185,
      1,
      now,
      now
    );

    // Item 2: Samosa Trio
    insertFood.run(
      'food_aa_2',
      'rest_abdul_ahad',
      'cat_aa_app',
      'Samosa Trio',
      'Crispy pastry shells filled with spiced potatoes and peas, served with tangy imli and green chutney.',
      6.50,
      null,
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Vegetarian', 'Crispy']),
      JSON.stringify([
        { name: 'Potato & Pea (3 Pcs)', priceDelta: 0 },
        { name: 'Spiced Keema Filling (3 Pcs)', priceDelta: 2.50 }
      ]),
      JSON.stringify([
        { name: 'Extra Chickpea Chana Dip', price: 1.99 }
      ]),
      1,
      0,
      94,
      2,
      now,
      now
    );

    // Item 3: Chicken Biryani
    insertFood.run(
      'food_aa_3',
      'rest_abdul_ahad',
      'cat_aa_main',
      'Chicken Biryani',
      'Fragrant aged basmati rice cooked on dum with succulent chicken, saffron, caramelized onions, and aromatic spices.',
      15.99,
      13.99,
      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Bestseller', 'Biryani', 'Spicy']),
      JSON.stringify([
        { name: 'Single Serving (With 2 Piece Chicken)', priceDelta: 0 },
        { name: 'Double Dum Box (Serves 2)', priceDelta: 11.00 },
        { name: 'Family Dastarkhwan Thal (Serves 4)', priceDelta: 28.00 }
      ]),
      JSON.stringify([
        { name: 'Zeera Raita', price: 1.50 },
        { name: 'Kachumber Salad', price: 1.25 },
        { name: 'Extra Masala Aloo (2 Pcs)', price: 1.00 }
      ]),
      1,
      1,
      412,
      1,
      now,
      now
    );

    // Item 4: Lamb Karahi
    insertFood.run(
      'food_aa_4',
      'rest_abdul_ahad',
      'cat_aa_main',
      'Lamb Karahi',
      'Tender bone-in lamb cooked in a traditional iron wok with crushed ginger, garlic, vine-ripened tomatoes, and green chilies.',
      18.50,
      null,
      'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Signature', 'Karahi']),
      JSON.stringify([
        { name: 'Half Karahi (Serves 2)', priceDelta: 0 },
        { name: 'Full Karahi (Serves 4)', priceDelta: 15.00 }
      ]),
      JSON.stringify([
        { name: 'Desi Ghee Tadka', price: 2.50 },
        { name: 'Extra Ginger & Green Chili Garnish', price: 0.75 }
      ]),
      1,
      1,
      230,
      2,
      now,
      now
    );

    // Item 5: Paneer Tikka Masala
    insertFood.run(
      'food_aa_5',
      'rest_abdul_ahad',
      'cat_aa_main',
      'Paneer Tikka Masala',
      'Grilled cottage cheese cubes simmered in a rich, velvety fenugreek and tomato-based gravy.',
      14.99,
      null,
      'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Vegetarian', 'Creamy']),
      JSON.stringify([
        { name: 'Regular Bowl', priceDelta: 0 },
        { name: 'Large Family Bowl', priceDelta: 6.00 }
      ]),
      JSON.stringify([
        { name: 'Steamed Jeera Rice Side', price: 3.50 }
      ]),
      1,
      0,
      118,
      3,
      now,
      now
    );

    // Item 6: Garlic Naan
    insertFood.run(
      'food_aa_6',
      'rest_abdul_ahad',
      'cat_aa_bread',
      'Garlic Naan',
      'Soft, pillowy leavened clay-oven bread brushed with roasted garlic butter and fresh cilantro.',
      3.50,
      null,
      'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Tandoori', 'Freshly Baked']),
      JSON.stringify([
        { name: 'Classic Butter Garlic', priceDelta: 0 },
        { name: 'Chili Cheese Garlic Naan', priceDelta: 2.00 }
      ]),
      JSON.stringify([]),
      1,
      0,
      390,
      1,
      now,
      now
    );

    // Item 7: Mango Lassi
    insertFood.run(
      'food_aa_7',
      'rest_abdul_ahad',
      'cat_aa_drinks',
      'Mango Lassi',
      'Refreshing whipped yogurt drink blended with sweet Sindhri mango pulp and topped with pistachios.',
      4.99,
      null,
      'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Chilled', 'Bestseller']),
      JSON.stringify([
        { name: 'Regular Glass (350ml)', priceDelta: 0 },
        { name: 'Tall Clay Matka (550ml)', priceDelta: 2.00 }
      ]),
      JSON.stringify([]),
      1,
      1,
      275,
      1,
      now,
      now
    );

    // Item 8: Gulab Jamun
    insertFood.run(
      'food_aa_8',
      'rest_abdul_ahad',
      'cat_aa_dessert',
      'Gulab Jamun',
      'Warm, syrup-soaked khoya milk dumplings flavored with green cardamom and rose water.',
      5.99,
      null,
      'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Warm Dessert', 'Sweet']),
      JSON.stringify([
        { name: '3 Pieces', priceDelta: 0 },
        { name: '6 Pieces Box', priceDelta: 4.50 }
      ]),
      JSON.stringify([
        { name: 'Vanilla Bean Ice Cream Scoop', price: 2.00 },
        { name: 'Shahi Rabri Topping', price: 2.50 }
      ]),
      1,
      0,
      165,
      1,
      now,
      now
    );

    // --- Zaffran Royal Dum & Grill Menu ---
    insertCategory.run('cat_zf_biryani', 'rest_zaffran', 'Royal Matka Biryani', 'Slow-steamed in sealed terracotta pots', 1, now);
    insertCategory.run('cat_zf_bbq', 'rest_zaffran', 'Charcoal Barbeque', 'Marinated overnight in traditional spices', 2, now);

    insertFood.run(
      'food_zf_1',
      'rest_zaffran',
      'cat_zf_biryani',
      'Saffron Mutton Matka Biryani',
      'Prime goat leg cuts layered with saffron basmati rice, fried shallots, and mint sealed in an earthen clay pot.',
      19.99,
      17.99,
      'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Matka Sealed', 'Biryani', 'Premium']),
      JSON.stringify([{ name: 'Clay Matka (Serves 2)', priceDelta: 0 }]),
      JSON.stringify([{ name: 'Burhani Garlic Raita', price: 1.50 }]),
      1,
      1,
      290,
      1,
      now,
      now
    );

    insertFood.run(
      'food_zf_2',
      'rest_zaffran',
      'cat_zf_biryani',
      'Hyderabadi Kachay Gosht Ki Biryani',
      'Traditional raw-marinated beef tenderloin dum biryani with rich mirchi ka salan.',
      14.50,
      null,
      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Biryani', 'Spicy']),
      JSON.stringify([{ name: 'Standard', priceDelta: 0 }]),
      JSON.stringify([]),
      1,
      0,
      145,
      2,
      now,
      now
    );

    insertFood.run(
      'food_zf_3',
      'rest_zaffran',
      'cat_zf_bbq',
      'Peshawari Namkeen Lamb Chops',
      'Juicy fat-rendered lamb rib chops seasoned simply with Himalayan pink salt and cracked black pepper.',
      22.00,
      null,
      'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
      'Pakistani & Mughal',
      JSON.stringify(['Keto Friendly', 'BBQ']),
      JSON.stringify([{ name: '6 Chops Platter', priceDelta: 0 }]),
      JSON.stringify([{ name: 'Roghni Naan', price: 2.50 }]),
      1,
      1,
      198,
      1,
      now,
      now
    );

    // --- Craft Smash & Co. Menu ---
    insertCategory.run('cat_cs_burgers', 'rest_smash', 'Smash Burgers', '100% grass-fed Angus beef smashed on a blazing steel griddle', 1, now);
    insertCategory.run('cat_cs_sides', 'rest_smash', 'Loaded Fries & Tenders', 'Hand-cut crispy sides and Nashville tenders', 2, now);

    insertFood.run(
      'food_cs_1',
      'rest_smash',
      'cat_cs_burgers',
      'Double Oklahoma Onion Smash',
      'Two lacy-edged Angus patties smashed with paper-thin sweet vidalia onions, double American cheese, house pickles, and smoky craft sauce on a toasted brioche bun.',
      11.99,
      9.99,
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
      'Burgers & American',
      JSON.stringify(['Bestseller', 'Burger', 'Smash']),
      JSON.stringify([
        { name: 'Double Patty (Standard)', priceDelta: 0 },
        { name: 'Triple Beast Patty', priceDelta: 3.50 }
      ]),
      JSON.stringify([
        { name: 'Crispy Beef Bacon', price: 2.50 },
        { name: 'Pickled Jalapeños', price: 0.99 },
        { name: 'Make it a Meal (Skin-on Fries + Drink)', price: 3.99 }
      ]),
      1,
      1,
      510,
      1,
      now,
      now
    );

    insertFood.run(
      'food_cs_2',
      'rest_smash',
      'cat_cs_burgers',
      'Nashville Hot Crispy Chicken Burger',
      'Buttermilk-brined crispy chicken thigh dipped in cayenne chili oil with creamy purple slaw and dill pickles.',
      10.50,
      null,
      'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
      'Burgers & American',
      JSON.stringify(['Spicy', 'Crispy Chicken']),
      JSON.stringify([
        { name: 'Medium Heat', priceDelta: 0 },
        { name: 'Firebird Extra Hot', priceDelta: 0.50 }
      ]),
      JSON.stringify([{ name: 'Extra Comeback Sauce', price: 0.99 }]),
      1,
      1,
      320,
      2,
      now,
      now
    );

    insertFood.run(
      'food_cs_3',
      'rest_smash',
      'cat_cs_sides',
      'Truffle Parmesan Crinkle Fries',
      'Golden crinkle-cut fries tossed in white truffle oil, aged Grana Padano, and fresh parsley with roasted garlic aioli.',
      6.99,
      null,
      'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80',
      'Burgers & American',
      JSON.stringify(['Vegetarian', 'Sharing']),
      JSON.stringify([{ name: 'Regular Basket', priceDelta: 0 }]),
      JSON.stringify([]),
      1,
      0,
      210,
      1,
      now,
      now
    );

    // --- Forno Napoli Menu ---
    insertCategory.run('cat_fn_pizza', 'rest_napoli', 'Wood-Fired Neapolitan Pizzas', '12-inch artisan sourdough crusts', 1, now);

    insertFood.run(
      'food_fn_1',
      'rest_napoli',
      'cat_fn_pizza',
      'Burrata & Diavola Sourdough Pizza',
      'San Marzano tomato base, fior di latte mozzarella, spicy halal beef pepperoni, fresh creamy burrata heart, and hot honey drizzle.',
      17.50,
      null,
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80',
      'Italian & Pizza',
      JSON.stringify(['Wood-Fired', 'Chef Special']),
      JSON.stringify([{ name: '12-Inch Artisan', priceDelta: 0 }]),
      JSON.stringify([{ name: 'Chili Infused Olive Oil Dip', price: 1.50 }]),
      1,
      1,
      260,
      1,
      now,
      now
    );

    // --- Sakura Wok & Sushi Menu ---
    insertCategory.run('cat_sk_sushi', 'rest_sakura', 'Signature Sushi & Wok', 'Freshly prepared to order', 1, now);

    insertFood.run(
      'food_sk_1',
      'rest_sakura',
      'cat_sk_sushi',
      'Volcano Prawn Tempura Roll (8 Pcs)',
      'Crispy tiger prawn tempura, avocado, and cucumber topped with torched spicy dynamite mayo, tobiko, and unagi glaze.',
      16.00,
      null,
      'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80',
      'Pan-Asian & Sushi',
      JSON.stringify(['Trending', 'Sushi']),
      JSON.stringify([{ name: '8 Pieces', priceDelta: 0 }]),
      JSON.stringify([]),
      1,
      1,
      195,
      1,
      now,
      now
    );

    // --- Cedar & Sumac Menu ---
    insertCategory.run('cat_cd_wraps', 'rest_cedar', 'Charcoal Grills & Shawarma', 'Authentic Levantine flavors', 1, now);

    insertFood.run(
      'food_cd_1',
      'rest_cedar',
      'cat_cd_wraps',
      'Lebanese Charcoal Shish Taouk Platter',
      'Garlic-lemon marinated chicken skewers grilled over charcoal, served with smoky hummus, toum garlic whip, pickled turnips, and warm saj bread.',
      9.50,
      7.99,
      'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=600&q=80',
      'Middle Eastern & Arabian',
      JSON.stringify(['Affordable', 'High Protein', 'Halal']),
      JSON.stringify([{ name: 'Single Platter', priceDelta: 0 }]),
      JSON.stringify([{ name: 'Extra Toum Garlic Dip', price: 0.99 }]),
      1,
      1,
      305,
      1,
      now,
      now
    );

    // --- Emerald Roast Menu ---
    insertCategory.run('cat_em_bowls', 'rest_emerald', 'Superfood Bowls & Specialty Coffee', 'Clean, energizing ingredients', 1, now);

    insertFood.run(
      'food_em_1',
      'rest_emerald',
      'cat_em_bowls',
      'Harissa Grilled Salmon & Quinoa Bowl',
      'Norwegian salmon fillet, tri-color quinoa, roasted sweet potato, avocado, edamame, and tahini-citrus dressing.',
      15.50,
      null,
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80',
      'Cafe & Healthy',
      JSON.stringify(['Healthy', 'Gluten-Free']),
      JSON.stringify([{ name: 'Regular Bowl', priceDelta: 0 }]),
      JSON.stringify([]),
      1,
      1,
      142,
      1,
      now,
      now
    );

    // 5. Seed Offers
    const insertOffer = db.prepare(`
      INSERT INTO offers (id, restaurant_id, title, description, code, discount_type, discount_value, min_order_amount, valid_until, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const nextMonth = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    insertOffer.run('off_1', 'rest_abdul_ahad', '20% OFF Royal Feast', 'Get 20% off on all Dum Biryanis & Karahi orders above $20', 'AHAD20', 'percentage', 20, 20, nextMonth, now);
    insertOffer.run('off_2', 'rest_smash', '$4 OFF Smash Combo', 'Instant $4 discount on orders of $18 or more', 'SMASH4', 'fixed', 4, 18, nextMonth, now);
    insertOffer.run('off_3', 'rest_zaffran', '15% OFF Family Platter', 'Enjoy 15% savings on family dining orders', 'ZAFFRAN15', 'percentage', 15, 25, nextMonth, now);
    insertOffer.run('off_4', 'rest_cedar', 'Free Delivery + 10% OFF', 'Save 10% on Lebanese grill platters', 'CEDAR10', 'percentage', 10, 12, nextMonth, now);

    // 6. Seed Reviews
    const insertReview = db.prepare(`
      INSERT INTO reviews (
        id, restaurant_id, customer_id, order_id, customer_name, rating, comment,
        images_json, owner_reply, owner_reply_at, helpful_count, is_verified_order, status, report_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertReview.run(
      'rev_1',
      'rest_abdul_ahad',
      'usr_customer_1',
      'ord_seed_1',
      'Sarah Ahmed',
      5,
      "Ordered the Chicken Biryani, Seekh Kebabs, and Garlic Naan using the Voice AI Concierge! It understood my address and quantities in seconds, and the biryani arrived piping hot in 28 minutes. Best Seekh Kebabs in DHA!",
      JSON.stringify(['https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=500&q=80']),
      'Thank you so much Sarah! We are thrilled you loved the Dum Biryani and our AI Voice Concierge experience.',
      now,
      14,
      1,
      'published',
      '',
      now
    );

    insertReview.run(
      'rev_2',
      'rest_abdul_ahad',
      'usr_customer_2',
      null,
      'Omar Farooq',
      5,
      'The Lamb Karahi and Mango Lassi are unmatched. Authentic smoky wok flavor without excessive oil. Great family seating area too.',
      JSON.stringify([]),
      '',
      '',
      9,
      1,
      'published',
      '',
      now
    );

    insertReview.run(
      'rev_3',
      'rest_abdul_ahad',
      null,
      null,
      'Ayesha Siddiqa',
      5,
      'Gulab Jamun with warm syrup and Paneer Tikka Masala made our weekend family dinner special!',
      JSON.stringify([]),
      '',
      '',
      6,
      1,
      'published',
      '',
      now
    );

    insertReview.run(
      'rev_4',
      'rest_zaffran',
      'usr_customer_1',
      null,
      'Sarah Ahmed',
      5,
      'The terracotta Matka Mutton Biryani is a showstopper when you crack open the bread seal at the table!',
      JSON.stringify([]),
      'Honored to host your family, Sarah!',
      now,
      11,
      1,
      'published',
      '',
      now
    );

    insertReview.run(
      'rev_5',
      'rest_zaffran',
      'usr_customer_2',
      null,
      'Omar Farooq',
      4,
      'Peshawari lamb chops were melt-in-the-mouth tender. Delivery took around 40 mins on Friday night.',
      JSON.stringify([]),
      '',
      '',
      4,
      1,
      'published',
      '',
      now
    );

    insertReview.run(
      'rev_6',
      'rest_smash',
      'usr_customer_1',
      null,
      'Sarah Ahmed',
      5,
      'Crispy caramelized edges on the Double Oklahoma Smash and the truffle crinkle fries are addictive.',
      JSON.stringify([]),
      '',
      '',
      18,
      1,
      'published',
      '',
      now
    );

    insertReview.run(
      'rev_7',
      'rest_smash',
      null,
      null,
      'Bilal Khan',
      5,
      'Best Nashville hot chicken burger in town! Real cayenne heat.',
      JSON.stringify([]),
      '',
      '',
      7,
      1,
      'published',
      '',
      now
    );

    insertReview.run(
      'rev_8',
      'rest_napoli',
      'usr_customer_1',
      null,
      'Sarah Ahmed',
      5,
      'Real Neapolitan leopard-spotted crust and fresh burrata!',
      JSON.stringify([]),
      '',
      '',
      8,
      1,
      'published',
      '',
      now
    );

    // Reported review for Admin Content Moderation Queue
    insertReview.run(
      'rev_reported_1',
      'rest_abdul_ahad',
      null,
      null,
      'SpamBotPromo99',
      1,
      'Click my profile link for cheap crypto signals and fake coupon codes!!!',
      JSON.stringify([]),
      '',
      '',
      0,
      0,
      'reported',
      'Spam / Promotional Link Violation',
      now
    );

    // 7. Seed Paid Ranking Campaign & Initial Bids
    const insertCampaign = db.prepare(`
      INSERT INTO ranking_campaigns (
        id, title, city, cuisine_scope, slot_count, min_opening_bid, min_bid_increment, status, starts_at, ends_at, rules_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `);

    insertCampaign.run(
      'camp_featured_top',
      'Homepage Sponsored #1 Spotlight: Prime Discovery Placement',
      'All',
      'All',
      3,
      0.10,
      0.01,
      now,
      nextMonth,
      JSON.stringify({
        disclosureLabel: 'Sponsored',
        incrementRule: 'Each bid must beat the current leading bid by a small step that grows with the bid amount.',
        organicSeparation: 'Paid placement only affects Sponsored Spotlight order; organic ratings and Top Rated rankings are strictly merit-based.'
      }),
      now
    );

    const insertBid = db.prepare(`
      INSERT INTO bids (id, campaign_id, restaurant_id, amount, status, payment_status, placed_by_user_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?)
    `);

    // Initial bids: Craft Smash bid $35, Zaffran bid $40, Abdul Ahad's Kitchen bid $45 (Currently Leading #1!)
    // Next eligible bid must be at least $50 ($45 + $5)!
    insertBid.run('bid_1', 'camp_featured_top', 'rest_smash', 35.00, 'active_runner_up', 'usr_owner_smash', 'Weekend Burger Push', now);
    insertBid.run('bid_2', 'camp_featured_top', 'rest_zaffran', 40.00, 'active_runner_up', 'usr_owner_zaffran', 'Royal Family Dining Campaign', now);
    insertBid.run('bid_3', 'camp_featured_top', 'rest_abdul_ahad', 45.00, 'leading', 'usr_owner_abdul', 'Flagship AI Concierge Launch', now);

    // 8. Seed Payments for Initial Bids (Zero hardcoded orders!)
    const insertPayment = db.prepare(`
      INSERT INTO payments (id, reference, user_id, restaurant_id, related_type, related_id, amount, platform_fee, currency, provider, status, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?)
    `);

    insertPayment.run('pay_3', 'TXN-BID-001', 'usr_owner_smash', 'rest_smash', 'bid', 'bid_1', 35.00, 35.00, 'manual_invoice', 'completed', JSON.stringify({ campaign: 'camp_featured_top' }), now);
    insertPayment.run('pay_4', 'TXN-BID-002', 'usr_owner_zaffran', 'rest_zaffran', 'bid', 'bid_2', 40.00, 40.00, 'manual_invoice', 'completed', JSON.stringify({ campaign: 'camp_featured_top' }), now);
    insertPayment.run('pay_5', 'TXN-BID-003', 'usr_owner_abdul', 'rest_abdul_ahad', 'bid', 'bid_3', 45.00, 45.00, 'manual_invoice', 'completed', JSON.stringify({ campaign: 'camp_featured_top' }), now);

    // Favorite for Sarah
    db.prepare(`INSERT INTO favourites (id, user_id, restaurant_id, created_at) VALUES (?, ?, ?, ?)`).run('fav_1', 'usr_customer_1', 'rest_abdul_ahad', now);
    db.prepare(`INSERT INTO favourites (id, user_id, restaurant_id, created_at) VALUES (?, ?, ?, ?)`).run('fav_2', 'usr_customer_1', 'rest_smash', now);

    // Platform Settings
    const insertSetting = db.prepare(`INSERT INTO platform_settings (key, value_json, updated_at) VALUES (?, ?, ?)`);
    insertSetting.run('bidding_rules', JSON.stringify({
      minBidIncrement: 0.01,
      minOpeningBid: 0.10,
      commissionRatePercent: 10,
      allowAutoBidding: false,
      competitorBidVisibility: 'leading_amount_only',
      sponsoredDisclosureRequired: true
    }), now);

    insertSetting.run('payment_providers', JSON.stringify({
      cashOnDelivery: { enabled: true, label: 'Cash on Delivery (Verified)' },
      stripeBoundary: { enabled: false, configured: Boolean(process.env.STRIPE_SECRET_KEY), missingEnv: 'STRIPE_SECRET_KEY' }
    }), now);

    // Recalculate ratings
    ['rest_abdul_ahad', 'rest_zaffran', 'rest_smash', 'rest_napoli'].forEach(rid => {
      recalculateRestaurantRating(db, rid);
    });

    db.exec('COMMIT;');

    // Notifications & Audit Log outside main block
    createNotification({
      userId: 'usr_owner_abdul',
      restaurantId: 'rest_abdul_ahad',
      type: 'bidding_leading',
      title: 'Leading Rank #1 in Sponsored Placement',
      message: "Abdul Ahad's Kitchen holds Rank #1 with a $45.00 bid. Minimum next qualifying bid is $47.25.",
      linkView: 'owner'
    });

    createNotification({
      userId: 'usr_admin_1',
      roleTarget: 'admin',
      type: 'moderation_alert',
      title: '1 Pending Restaurant & 1 Reported Review',
      message: 'Haveli Tawa & Karahi House awaits onboarding approval, and 1 flagged review requires moderation.',
      linkView: 'admin'
    });

    logAudit('usr_admin_1', 'admin', 'SEED_DATABASE', 'system', 'initial_seed', {
      note: 'Development seed initialized cleanly with flagships and Abdul Ahad Kitchen preserved.'
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Seed error:', err);
  }
}
