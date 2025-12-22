
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'Appetizers' | 'Main Course' | 'Breads' | 'Desserts' | 'Drinks';
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  address: string;
  phone: string;
  status: 'Pending' | 'Preparing' | 'Out for Delivery' | 'Delivered';
  timestamp: Date;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
