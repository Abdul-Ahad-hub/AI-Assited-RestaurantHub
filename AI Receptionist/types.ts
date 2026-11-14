export interface MenuItemVariation {
  name: string;
  priceDelta: number;
}

export interface MenuItemAddon {
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  restaurant_id?: string;
  restaurant_name?: string;
  restaurant_slug?: string;
  restaurant_city?: string;
  restaurant_rating?: number;
  category_id?: string;
  category_name?: string;
  name: string;
  description: string;
  price: number;
  discounted_price?: number | null;
  category?: string;
  image_url?: string;
  cuisine?: string;
  tags?: string[];
  variations?: MenuItemVariation[];
  addons?: MenuItemAddon[];
  is_available?: boolean;
  is_popular?: boolean;
  is_trending?: boolean;
  order_count?: number;
}

export interface OrderItem {
  id?: string;
  foodItemId?: string;
  restaurantId?: string;
  restaurantName?: string;
  name: string;
  quantity: number;
  price: number;
  variationName?: string;
  addonNames?: string[];
  selectedVariation?: MenuItemVariation | null;
  selectedAddons?: MenuItemAddon[];
  lineTotal?: number;
}

export interface Order {
  id: string;
  order_number?: string;
  restaurant_id?: string;
  restaurant_name?: string;
  restaurant_logo?: string;
  customer_name?: string;
  customer_phone?: string;
  items: OrderItem[];
  subtotal?: number;
  discount_amount?: number;
  delivery_fee?: number;
  tax_amount?: number;
  total: number;
  address: string;
  delivery_address?: string;
  phone: string;
  order_type?: 'delivery' | 'pickup' | 'dine_in';
  status: 'Pending' | 'Confirmed' | 'Preparing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  source?: 'web' | 'voice_ai' | 'chat_ai';
  timestamp: Date | string;
  created_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'restaurant_owner' | 'admin';
  phone: string;
  city: string;
  address: string;
  avatar_url: string;
  status: 'active' | 'suspended';
  preferences: Record<string, any>;
}

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  cuisine: string;
  secondary_cuisines: string[];
  price_range: '$' | '$$' | '$$$' | '$$$$';
  city: string;
  area: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  opening_hours: Record<string, string>;
  services: Record<string, boolean>;
  logo_url: string;
  cover_url: string;
  gallery: string[];
  rating_avg: number;
  review_count: number;
  verification_status: 'pending' | 'verified' | 'rejected';
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  is_featured: boolean;
  is_trending: boolean;
  is_sponsored?: boolean;
  active_bid_amount?: number;
  bid_rank?: number;
  delivery_fee: number;
  min_order: number;
  delivery_time_min: number;
  delivery_time_max: number;
  created_at: string;
  owner_name?: string;
  owner_email?: string;
}

export interface RestaurantOffer {
  id: string;
  restaurant_id: string;
  restaurant_name?: string;
  restaurant_slug?: string;
  restaurant_cover?: string;
  title: string;
  description: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  valid_until: string;
  is_active: boolean | number;
}

export interface RestaurantReview {
  id: string;
  restaurant_id: string;
  restaurant_name?: string;
  customer_id?: string | null;
  customer_name: string;
  rating: number;
  comment: string;
  images: string[];
  owner_reply?: string;
  owner_reply_at?: string;
  helpful_count: number;
  is_verified_order: boolean;
  status: 'published' | 'reported' | 'hidden' | 'rejected';
  report_reason?: string;
  created_at: string;
}

export interface MenuDraftItem {
  tempId: string;
  categoryName: string;
  name: string;
  description: string;
  price: number;
  variations: MenuItemVariation[];
  addons: MenuItemAddon[];
  missingDetails: string[];
}
