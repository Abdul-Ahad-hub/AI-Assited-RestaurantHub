import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { FREE_GEMINI_MODELS } from "./geminiModelRouter";

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
  private modelIndex = 0;
  private chat: any;
  private history: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  private get toolCapableModels() {
    return FREE_GEMINI_MODELS.filter(m => m.supportsJsonSchema);
  }

  constructor() {
    this.chat = this.createChatForModel(this.toolCapableModels[0].id);
  }

  private createChatForModel(modelId: string) {
    return ai.chats.create({
      model: modelId,
      history: this.history,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [placeOrderDeclaration] }],
      },
    });
  }

  async sendMessage(message: string) {
    const models = this.toolCapableModels;
    let lastError: any = null;

    for (let attempt = 0; attempt < models.length; attempt++) {
      const idx = (this.modelIndex + attempt) % models.length;
      const modelId = models[idx].id;
      try {
        if (idx !== this.modelIndex) {
          this.modelIndex = idx;
          this.chat = this.createChatForModel(modelId);
        }
        const response = await this.chat.sendMessage({ message });
        this.history.push({ role: 'user', parts: [{ text: message }] });
        if (response.text) {
          this.history.push({ role: 'model', parts: [{ text: response.text }] });
        }
        return {
          text: response.text,
          functionCalls: response.functionCalls,
          modelUsed: modelId
        };
      } catch (error) {
        lastError = error;
        console.warn(`[KitchenAI] Model ${modelId} failed, switching to next free Gemini model...`, error);
      }
    }

    throw lastError || new Error('All free Gemini models are currently unavailable.');
  }
}
