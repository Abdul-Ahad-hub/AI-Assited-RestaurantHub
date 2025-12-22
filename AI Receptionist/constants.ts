
import { MenuItem } from './types';


const RESTAURANT_NAME = "Abdul Ahad's Kitchen"

// Fix: Removed 'image' property as it is not defined in MenuItem interface in types.ts
export const MENU_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Seekh Kebab',
    description: 'Minced lamb mixed with fresh herbs and spices, grilled to perfection.',
    price: 12.99,
    category: 'Appetizers'
  },
  {
    id: '2',
    name: 'Samosa Trio',
    description: 'Crispy pastry shells filled with spiced potatoes and peas.',
    price: 6.50,
    category: 'Appetizers'
  },
  {
    id: '3',
    name: 'Chicken Biryani',
    description: 'Fragrant basmati rice cooked with succulent chicken and aromatic spices.',
    price: 15.99,
    category: 'Main Course'
  },
  {
    id: '4',
    name: 'Lamb Karahi',
    description: 'Tender lamb cooked in a traditional wok with ginger, garlic, and tomatoes.',
    price: 18.50,
    category: 'Main Course'
  },
  {
    id: '5',
    name: 'Paneer Tikka Masala',
    description: 'Grilled cottage cheese cubes in a rich, creamy tomato-based gravy.',
    price: 14.99,
    category: 'Main Course'
  },
  {
    id: '6',
    name: 'Garlic Naan',
    description: 'Soft, leavened bread brushed with fresh garlic and cilantro.',
    price: 3.50,
    category: 'Breads'
  },
  {
    id: '7',
    name: 'Mango Lassi',
    description: 'Refreshing yogurt-based drink blended with sweet mango pulp.',
    price: 4.99,
    category: 'Drinks'
  },
  {
    id: '8',
    name: 'Gulab Jamun',
    description: 'Warm, syrup-soaked milk dumplings flavored with cardamom.',
    price: 5.99,
    category: 'Desserts'
  }
];

export const SYSTEM_INSTRUCTION = `
You are the Voice Concierge for "Abdul Ahad's Kitchen". You interact via real-time audio.
Your goals:
1. Help customers explore our menu.
2. Facilitate the ordering process.

Mandatory Requirements for Placing an Order:
- You MUST ask for and confirm the delivery address and phone number before placing any order.
- You MUST confirm the items and the total price.
- You MUST start your greetings exactly with the statement =  'Thank you for calling ${RESTAURANT_NAME}, this is Reception, How may I help you'
- You MUST ask the language preference, Hindi or English if you feel words are confusing or broken

Menu:
${MENU_ITEMS.map(item => `- ${item.name}: ${item.description} ($${item.price})`).join('\n')}

Guidelines:
- Speak warmly and professionally.
- If a user wants to order, ask for the delivery address if they haven't provided it.
- Use the 'placeOrder' tool ONLY when you have: the items, the quantities, AND the delivery address.
- After placing order, you should say, order has been placed, check now.
`;
