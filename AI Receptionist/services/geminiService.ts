
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const placeOrderDeclaration: FunctionDeclaration = {
  name: 'placeOrder',
  parameters: {
    type: Type.OBJECT,
    description: 'Place a food order for the customer.',
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'The list of items to order.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'The name of the menu item.',
            },
            quantity: {
              type: Type.NUMBER,
              description: 'The number of portions.',
            },
          },
          required: ['name', 'quantity'],
        },
      },
    },
    required: ['items'],
  },
};

export class KitchenAI {
  private chat;

  constructor() {
    this.chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [placeOrderDeclaration] }],
      },
    });
  }

  async sendMessage(message: string) {
    try {
      const response = await this.chat.sendMessage({ message });
      
      return {
        text: response.text,
        functionCalls: response.functionCalls,
      };
    } catch (error) {
      console.error("AI Service Error:", error);
      throw error;
    }
  }
}
