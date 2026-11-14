import crypto from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { getDb } from './db';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export interface StructuredMenuDraftItem {
  tempId: string;
  categoryName: string;
  name: string;
  description: string;
  price: number;
  variations: { name: string; priceDelta: number }[];
  addons: { name: string; price: number }[];
  missingDetails: string[];
}

export async function generateMenuDraftFromPrompt(
  prompt: string,
  restaurantName: string,
  defaultCuisine: string,
  userId: string,
  restaurantId: string
): Promise<{
  summary: string;
  categoriesDetected: string[];
  items: StructuredMenuDraftItem[];
  source: 'gemini' | 'smart_parser';
}> {
  const db = getDb();
  const ai = getAiClient();
  let items: StructuredMenuDraftItem[] = [];
  let summary = '';
  let source: 'gemini' | 'smart_parser' = 'smart_parser';

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are the Restaurant Hub AI Menu Architect for "${restaurantName}" (${defaultCuisine}).
Extract a structured menu draft from the restaurant owner's input below.
Owner input:
"""
${prompt}
"""

Rules:
1. Identify category names (e.g. "Biryani", "Appetizers", "Burgers", "Drinks", "Main Course").
2. Extract each food item's exact name and numeric price.
3. If the owner did not provide a description, write a concise, appetizing 1-sentence culinary description matching the item name and ${defaultCuisine} cuisine.
4. Suggest 1-2 sensible variations (e.g., Regular, Large, Spicy) if relevant, and flag any missing details (e.g., "Generated description — please review", "Check portion size").`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    categoryName: { type: Type.STRING },
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    variations: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          priceDelta: { type: Type.NUMBER }
                        },
                        required: ['name', 'priceDelta']
                      }
                    },
                    addons: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          price: { type: Type.NUMBER }
                        },
                        required: ['name', 'price']
                      }
                    },
                    missingDetails: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ['categoryName', 'name', 'description', 'price', 'variations', 'addons', 'missingDetails']
                }
              }
            },
            required: ['summary', 'items']
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          items = parsed.items.map((it: any, idx: number) => ({
            tempId: `draft_${Date.now()}_${idx}`,
            categoryName: String(it.categoryName || 'Main Course').trim(),
            name: String(it.name || 'Menu Item').trim(),
            description: String(it.description || '').trim(),
            price: Math.max(0, Number(it.price) || 0),
            variations: Array.isArray(it.variations) ? it.variations : [],
            addons: Array.isArray(it.addons) ? it.addons : [],
            missingDetails: Array.isArray(it.missingDetails) ? it.missingDetails : []
          }));
          summary = parsed.summary || `Extracted ${items.length} menu items across ${new Set(items.map(i => i.categoryName)).size} categories.`;
          source = 'gemini';
        }
      }
    } catch (err) {
      console.warn('Gemini menu draft fallback triggered:', err);
    }
  }

  // Deterministic NLP fallback parser so menu drafting ALWAYS works even offline or without API quota
  if (items.length === 0) {
    items = fallbackParseMenuDraft(prompt, defaultCuisine);
    summary = `Extracted ${items.length} structured menu item(s). Review descriptions, variations, and prices below before publishing.`;
  }

  const categoriesDetected = Array.from(new Set(items.map(i => i.categoryName)));

  db.prepare(`
    INSERT INTO ai_logs (id, user_id, restaurant_id, mode, prompt, tools_called_json, response_summary, created_at)
    VALUES (?, ?, ?, 'menu_draft', ?, ?, ?, ?)
  `).run(
    `ail_${crypto.randomUUID().slice(0, 12)}`,
    userId,
    restaurantId,
    prompt,
    JSON.stringify(['extractStructuredMenuDraft']),
    summary,
    new Date().toISOString()
  );

  return { summary, categoriesDetected, items, source };
}

function fallbackParseMenuDraft(prompt: string, defaultCuisine: string): StructuredMenuDraftItem[] {
  const results: StructuredMenuDraftItem[] = [];
  let currentCategory = 'Main Course';

  // Detect category mention such as "Add a biryani section" or "Category: Burgers"
  const sectionMatch = prompt.match(/(?:add\s+(?:a|an)\s+|category\s*:\s*|section\s*:\s*)([a-zA-Z0-9 &'-]+?)(?:\s+section|\s+category|[.:\n]|$)/i);
  if (sectionMatch && sectionMatch[1]) {
    const rawCat = sectionMatch[1].trim();
    currentCategory = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
  }

  // Split by sentences, commas, or newlines
  const segments = prompt
    .replace(/\band\b/gi, ',')
    .split(/[,\n;.]+/)
    .map(s => s.trim())
    .filter(Boolean);

  segments.forEach((seg, idx) => {
    const catHeader = seg.match(/^(?:add\s+(?:a|an)\s+)?([a-zA-Z &]+?)\s+(?:section|category)$/i);
    if (catHeader) {
      const c = catHeader[1].trim();
      currentCategory = c.charAt(0).toUpperCase() + c.slice(1);
      return;
    }

    // Match patterns like "Chicken biryani costs 450" or "Beef Burger - $12.99" or "Special Biryani: 700"
    const priceMatch = seg.match(/^(.*?)(?:\s+(?:costs|is|for|at|price)\s+|\s*[-:]\s*|\s+)\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:pkr|rs|usd|\$)?$/i);
    if (priceMatch) {
      let rawName = priceMatch[1]
        .replace(/^(?:add|include|create)\s+/i, '')
        .trim();
      const price = parseFloat(priceMatch[2]);
      if (rawName && !isNaN(price)) {
        const formattedName = rawName
          .split(/\s+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

        const missing: string[] = ['Description auto-generated — please verify', 'No food photo uploaded yet'];
        if (price > 100) {
          missing.push('High numeric price detected (check currency unit)');
        }

        results.push({
          tempId: `draft_${Date.now()}_${idx}`,
          categoryName: currentCategory,
          name: formattedName,
          description: `Freshly prepared ${formattedName.toLowerCase()} crafted with signature ${defaultCuisine || 'house'} spices and herbs.`,
          price,
          variations: [
            { name: 'Regular Portion', priceDelta: 0 },
            { name: 'Large Portion', priceDelta: Math.round(price * 0.35 * 100) / 100 }
          ],
          addons: [
            { name: 'Signature Dip / Raita', price: 1.5 }
          ],
          missingDetails: missing
        });
      }
    }
  });

  return results;
}

export async function runCustomerDiscoveryAI(params: {
  query: string;
  city?: string;
  userId?: string | null;
}) {
  const db = getDb();
  const q = params.query.trim();
  const lower = q.toLowerCase();

  // Retrieve candidate restaurants and dishes from actual database
  const allRestaurants = db.prepare(`
    SELECT r.*,
      (SELECT MAX(b.amount) FROM bids b JOIN ranking_campaigns c ON c.id = b.campaign_id WHERE b.restaurant_id = r.id AND c.status = 'active' AND b.status IN ('leading', 'active_runner_up')) as active_bid_amount
    FROM restaurants r
    WHERE r.approval_status = 'approved'
    ORDER BY r.rating_avg DESC, r.review_count DESC
  `).all() as any[];

  const allFoods = db.prepare(`
    SELECT f.*, r.name as restaurant_name, r.slug as restaurant_slug, r.city as restaurant_city, r.rating_avg as restaurant_rating, r.delivery_time_min, r.delivery_time_max
    FROM food_items f
    JOIN restaurants r ON r.id = f.restaurant_id
    WHERE r.approval_status = 'approved' AND f.is_available = 1
    ORDER BY f.order_count DESC
  `).all() as any[];

  // Filter based on intent in query
  let matchedRestaurants = [...allRestaurants];
  let matchedFoods = [...allFoods];

  if (params.city && params.city !== 'All') {
    const cityFiltered = matchedRestaurants.filter(r => r.city.toLowerCase() === params.city!.toLowerCase());
    if (cityFiltered.length > 0) matchedRestaurants = cityFiltered;
  }

  // Keyword matching
  const stopWords = new Set(['find', 'the', 'best', 'nearby', 'show', 'me', 'where', 'can', 'i', 'get', 'good', 'restaurants', 'restaurant', 'suitable', 'for', 'recommend', 'somewhere', 'which', 'have', 'with', 'in', 'a', 'an', 'to', 'eat', 'food', 'place', 'places']);
  const keywords = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const isAffordableQuery = lower.includes('affordable') || lower.includes('cheap') || lower.includes('budget') || lower.includes('under');
  const isFamilyQuery = lower.includes('family') || lower.includes('families') || lower.includes('dinner') || lower.includes('group');
  const isTopRatedQuery = lower.includes('best') || lower.includes('top') || lower.includes('rating') || lower.includes('rated');

  if (isAffordableQuery) {
    matchedRestaurants = matchedRestaurants.filter(r => r.price_range === '$' || r.price_range === '$$');
    matchedFoods = matchedFoods.filter(f => (f.discounted_price || f.price) <= 15);
  }

  if (isFamilyQuery) {
    matchedRestaurants = matchedRestaurants.filter(r => {
      try {
        const s = JSON.parse(r.services_json || '{}');
        return Boolean(s.familySeating || s.dineIn);
      } catch {
        return true;
      }
    });
  }

  if (keywords.length > 0) {
    const kwFoods = matchedFoods.filter(f => {
      const hay = `${f.name} ${f.description} ${f.cuisine} ${f.tags_json} ${f.restaurant_name}`.toLowerCase();
      return keywords.some(k => hay.includes(k) || (k.endsWith('s') && hay.includes(k.slice(0, -1))));
    });

    const kwRests = matchedRestaurants.filter(r => {
      const hay = `${r.name} ${r.description} ${r.cuisine} ${r.secondary_cuisines} ${r.city} ${r.area}`.toLowerCase();
      const hasFood = kwFoods.some(f => f.restaurant_id === r.id);
      return hasFood || keywords.some(k => hay.includes(k) || (k.endsWith('s') && hay.includes(k.slice(0, -1))));
    });

    if (kwRests.length > 0) matchedRestaurants = kwRests;
    if (kwFoods.length > 0) matchedFoods = kwFoods;
  }

  if (isTopRatedQuery) {
    matchedRestaurants.sort((a, b) => Number(b.rating_avg) - Number(a.rating_avg));
  }

  const topRestaurants = matchedRestaurants.slice(0, 4).map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    cuisine: r.cuisine,
    price_range: r.price_range,
    city: r.city,
    area: r.area,
    rating_avg: r.rating_avg,
    review_count: r.review_count,
    delivery_time_min: r.delivery_time_min,
    delivery_time_max: r.delivery_time_max,
    delivery_fee: r.delivery_fee,
    cover_url: r.cover_url,
    logo_url: r.logo_url,
    is_sponsored: Boolean(r.active_bid_amount)
  }));

  const topFoods = matchedFoods.slice(0, 6).map(f => ({
    id: f.id,
    restaurant_id: f.restaurant_id,
    restaurant_name: f.restaurant_name,
    name: f.name,
    description: f.description,
    price: f.price,
    discounted_price: f.discounted_price,
    image_url: f.image_url,
    cuisine: f.cuisine,
    restaurant_rating: f.restaurant_rating
  }));

  let aiAnswer = '';
  const ai = getAiClient();
  if (ai) {
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are the Restaurant Hub AI Discovery Concierge.
A customer asked: "${q}" (City filter: ${params.city || 'All'}).
Here are the verified database results retrieved from Restaurant Hub:
Restaurants: ${JSON.stringify(topRestaurants.map(r => ({ name: r.name, cuisine: r.cuisine, price: r.price_range, rating: r.rating_avg, area: r.area, city: r.city })))}
Dishes: ${JSON.stringify(topFoods.map(f => ({ dish: f.name, restaurant: f.restaurant_name, price: f.discounted_price || f.price })))}

Write a warm, helpful, concise 2-3 sentence recommendation referencing ONLY the real restaurants and prices above. Never invent restaurants or prices.`
      });
      aiAnswer = resp.text || '';
    } catch {
      // Fallback below
    }
  }

  if (!aiAnswer) {
    if (topRestaurants.length > 0) {
      const rNames = topRestaurants.map(r => `${r.name} (${r.rating_avg}★, ${r.price_range} in ${r.area})`).join(', ');
      const fNames = topFoods.slice(0, 3).map(f => `${f.name} at ${f.restaurant_name} ($${(f.discounted_price || f.price).toFixed(2)})`).join('; ');
      aiAnswer = `Based on verified Restaurant Hub data, I recommend checking out ${rNames}.${fNames ? ` Popular matching dishes include ${fNames}.` : ''}`;
    } else {
      aiAnswer = `I couldn't find an exact match for "${q}", so I've highlighted our highest-rated verified restaurants below.`;
    }
  }

  db.prepare(`
    INSERT INTO ai_logs (id, user_id, restaurant_id, mode, prompt, tools_called_json, response_summary, created_at)
    VALUES (?, ?, NULL, 'customer_discovery', ?, ?, ?, ?)
  `).run(
    `ail_${crypto.randomUUID().slice(0, 12)}`,
    params.userId || null,
    q,
    JSON.stringify(['searchRestaurants', 'searchFoodItems']),
    aiAnswer.slice(0, 240),
    new Date().toISOString()
  );

  return {
    answer: aiAnswer,
    restaurants: topRestaurants,
    foods: topFoods
  };
}

export async function runRestaurantOwnerAssistant(params: {
  restaurantId: string;
  userId: string;
  prompt: string;
}) {
  const db = getDb();
  const restaurant = db.prepare(`SELECT * FROM restaurants WHERE id = ?`).get(params.restaurantId) as any;
  if (!restaurant) {
    throw new Error('Restaurant not found');
  }

  const foods = db.prepare(`SELECT name, price, discounted_price, order_count, is_available FROM food_items WHERE restaurant_id = ? ORDER BY order_count DESC`).all(params.restaurantId) as any[];
  const reviews = db.prepare(`SELECT rating, comment, customer_name, owner_reply FROM reviews WHERE restaurant_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 10`).all(params.restaurantId) as any[];
  const orderStats = db.prepare(`
    SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_revenue
    FROM orders
    WHERE restaurant_id = ? AND status != 'Cancelled'
  `).get(params.restaurantId) as any;

  const contextSnapshot = {
    name: restaurant.name,
    rating: restaurant.rating_avg,
    reviewCount: restaurant.review_count,
    profileViews: restaurant.profile_views,
    menuViews: restaurant.menu_views,
    totalOrders: orderStats?.total_orders || 0,
    totalRevenue: Number(orderStats?.total_revenue || 0).toFixed(2),
    topDishes: foods.slice(0, 5),
    recentReviews: reviews.slice(0, 5)
  };

  let reply = '';
  const ai = getAiClient();
  if (ai) {
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are the Restaurant Hub Business Operations AI Assistant for "${restaurant.name}".
Here is the restaurant's live verified database performance snapshot:
${JSON.stringify(contextSnapshot, null, 2)}

Owner question/request: "${params.prompt}"

Provide actionable, data-backed advice based strictly on their real metrics, menu items, and reviews above. Format clearly with bullet points where helpful.`
      });
      reply = resp.text || '';
    } catch {
      // Fallback below
    }
  }

  if (!reply) {
    const topDish = foods[0];
    reply = `Here is your live operational summary for **${restaurant.name}**:\n` +
      `• **Performance**: ${contextSnapshot.profileViews} profile views, ${contextSnapshot.menuViews} menu views, and ${contextSnapshot.totalOrders} orders generating **$${contextSnapshot.totalRevenue}** in tracked revenue.\n` +
      `• **Top Dish**: ${topDish ? `${topDish.name} ($${topDish.price.toFixed(2)}) with ${topDish.order_count} orders.` : 'Add menu items to start tracking top sellers.'}\n` +
      `• **Customer Sentiment**: ${restaurant.rating_avg}★ average across ${restaurant.review_count} published reviews.\n` +
      `• **Recommended Action**: Consider running a 15% promotional offer on mid-week dinner combos or using the AI Menu Architect tab to expand high-margin add-ons and drinks.`;
  }

  db.prepare(`
    INSERT INTO ai_logs (id, user_id, restaurant_id, mode, prompt, tools_called_json, response_summary, created_at)
    VALUES (?, ?, ?, 'restaurant_assistant', ?, ?, ?, ?)
  `).run(
    `ail_${crypto.randomUUID().slice(0, 12)}`,
    params.userId,
    params.restaurantId,
    params.prompt,
    JSON.stringify(['getRestaurantAnalytics', 'analyzeReviews']),
    reply.slice(0, 240),
    new Date().toISOString()
  );

  return { reply, snapshot: contextSnapshot };
}

export async function processVoiceCommandAI(params: {
  transcript: string;
  formType?: 'checkout' | 'profile' | 'register' | null;
  city?: string;
  restaurantId?: string;
  userId?: string | null;
}): Promise<{
  action: 'form_fill' | 'order' | 'search' | 'reply';
  spokenReply: string;
  fields?: Record<string, string>;
  orderData?: {
    items: { name: string; quantity: number }[];
    address: string;
    phone: string;
  };
  searchData?: {
    answer: string;
    restaurants: any[];
    foods: any[];
  };
}> {
  const text = (params.transcript || '').trim();
  const ai = getAiClient();

  // 1. If opened from a form ("AI Fill with Voice"), extract form fields
  if (params.formType) {
    let extractedFields: Record<string, string> = {};
    let spokenReply = 'I have filled in the form fields from your voice input.';

    if (ai) {
      try {
        const resp = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Extract form fields from the user's spoken voice input for a "${params.formType}" form on Restaurant Hub.
User said: "${text}"

Possible fields to extract (only include fields mentioned or implied by the user):
- name (Full name of person)
- email (Email address)
- phone (Phone number)
- address (Street/house delivery address)
- city (Karachi, Lahore, or Islamabad)
- orderType ("delivery", "pickup", or "dine_in")
- offerCode (Promo/discount code in uppercase, e.g. AHAD20, SMASH4)
- notes (Special kitchen or rider instructions, spice level, etc.)
- restaurantName (Brand name of restaurant if registering a restaurant)
- cuisine (Cuisine type if registering a restaurant)
- area (Neighborhood/area e.g. DHA Phase 6, Gulberg)`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                spokenReply: { type: Type.STRING },
                name: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                address: { type: Type.STRING },
                city: { type: Type.STRING },
                orderType: { type: Type.STRING },
                offerCode: { type: Type.STRING },
                notes: { type: Type.STRING },
                restaurantName: { type: Type.STRING },
                cuisine: { type: Type.STRING },
                area: { type: Type.STRING }
              },
              required: ['spokenReply']
            }
          }
        });

        if (resp.text) {
          const parsed = JSON.parse(resp.text);
          spokenReply = parsed.spokenReply || spokenReply;
          for (const key of [
            'name',
            'email',
            'phone',
            'address',
            'city',
            'orderType',
            'offerCode',
            'notes',
            'restaurantName',
            'cuisine',
            'area'
          ]) {
            if (parsed[key] && String(parsed[key]).trim()) {
              extractedFields[key] = String(parsed[key]).trim();
            }
          }
        }
      } catch (err) {
        console.warn('Gemini voice form fill fallback triggered:', err);
      }
    }

    // Deterministic fallback parser if Gemini is unavailable or missed a pattern
    if (Object.keys(extractedFields).length === 0) {
      const phoneMatch = text.match(/(?:\+?\d[\d\s-]{7,14}\d)/);
      if (phoneMatch) extractedFields.phone = phoneMatch[0].trim();

      const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]+)/);
      if (emailMatch) extractedFields.email = emailMatch[1].trim();

      const cityMatch = text.match(/\b(Karachi|Lahore|Islamabad)\b/i);
      if (cityMatch) {
        extractedFields.city =
          cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
      }

      const codeMatch = text.match(/(?:code|promo|coupon)\s+(?:is\s+)?([A-Za-z0-9]{4,12})/i);
      if (codeMatch) extractedFields.offerCode = codeMatch[1].toUpperCase();

      const nameMatch = text.match(/(?:my name is|name is|i am)\s+([A-Za-z ]+?)(?:,|\.|and|phone|address|email|$)/i);
      if (nameMatch) extractedFields.name = nameMatch[1].trim();

      const addrMatch = text.match(/(?:address is|deliver to|at|live at)\s+([^,.]+(?:,[^,.]+)?)/i);
      if (addrMatch) {
        extractedFields.address = addrMatch[1].trim();
      } else if (!extractedFields.phone && text.length > 6) {
        extractedFields.address = text;
      }

      const noteMatch = text.match(/(?:note|notes|instruction|make it|extra)\s+(.+)$/i);
      if (noteMatch) extractedFields.notes = noteMatch[0].trim();
    }

    return {
      action: 'form_fill',
      spokenReply,
      fields: extractedFields
    };
  }

  // 2. General Voice Command (Search or Order)
  const discovery = await runCustomerDiscoveryAI({
    query: text,
    city: params.city || 'All',
    userId: params.userId
  });

  return {
    action: 'search',
    spokenReply: discovery.answer,
    searchData: discovery
  };
}
