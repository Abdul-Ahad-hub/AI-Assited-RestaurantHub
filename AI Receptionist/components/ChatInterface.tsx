import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { OrderItem } from '../types';
import { MENU_ITEMS, SYSTEM_INSTRUCTION } from '../constants';

interface ChatInterfaceProps {
  onOrderPlaced: (items: OrderItem[], address: string, phone: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onOrderPlaced, isOpen, onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ role: string, text: string }[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState('');
  
  const sessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{ input: AudioContext, output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const placeOrderFunction: FunctionDeclaration = {
    name: 'placeOrder',
    parameters: {
      type: Type.OBJECT,
      description: 'Place a food order with the customer details. Items must be objects with name and quantity.',
      properties: {
        items: {
          type: Type.ARRAY,
          description: 'Array of order items, each must be an object with name and quantity',
          items: {
            type: Type.OBJECT,
            description: 'An order item with name and quantity',
            properties: {
              name: { 
                type: Type.STRING,
                description: 'Exact name of the menu item from the available menu'
              },
              quantity: { 
                type: Type.NUMBER,
                description: 'Number of portions'
              },
            },
            required: ['name', 'quantity'],
          },
        },
        address: {
          type: Type.STRING,
          description: 'Full delivery address including street, city, and any landmarks',
        },
        phone: {
          type: Type.STRING,
          description: 'Phone number for delivery contact',
        },
      },
      required: ['items', 'address', 'phone'],
    },
  };

  const showOrderAnimation = (message: string) => {
    setOrderSuccessMessage(message);
    setShowOrderSuccess(true);
    
    setTimeout(() => {
      setShowOrderSuccess(false);
    }, 3000);
  };

  const startSession = async () => {
    setIsConnecting(true);
    const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
    
    try {
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const config: any = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: SYSTEM_INSTRUCTION,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [placeOrderFunction] }],
      };

      console.log('Starting voice session');

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config,
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            
            // Set up audio processing
            if (audioContextsRef.current && mediaStreamRef.current) {
              const inputCtx = audioContextsRef.current.input;
              const source = inputCtx.createMediaStreamSource(mediaStreamRef.current);
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessorRef.current = scriptProcessor;
              
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const l = inputData.length;
                const int16 = new Int16Array(l);
                for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                if (sessionRef.current) {
                  sessionRef.current.sendRealtimeInput({ media: pcmBlob });
                }
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            console.log('Received message:', {
              hasModelTurn: !!message.serverContent?.modelTurn,
              hasToolCall: !!message.toolCall,
              modelTurnParts: message.serverContent?.modelTurn?.parts,
              inputTranscription: message.serverContent?.inputTranscription?.text,
              outputTranscription: message.serverContent?.outputTranscription?.text,
              interrupted: message.serverContent?.interrupted,
              fullMessage: message
            });
            
            // Handle audio output
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              const base64 = message.serverContent.modelTurn.parts[0].inlineData.data;
              const outputCtx = audioContextsRef.current?.output;
              if (outputCtx) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              }
            }

            // Handle interruptions
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // Handle user input transcription
            if (message.serverContent?.inputTranscription) {
              setTranscriptions(prev => [...prev, { role: 'user', text: message.serverContent!.inputTranscription!.text }]);
            }

            // Handle agent transcription
            if (message.serverContent?.outputTranscription) {
              setTranscriptions(prev => [...prev, { role: 'agent', text: message.serverContent!.outputTranscription!.text }]);
            }
           
            // Handle tool calls (ORDER PLACEMENT)
            if (message.toolCall?.functionCalls) {
              console.log('🎯 Tool call detected! Function calls:', message.toolCall.functionCalls);
              
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'placeOrder') {
                  console.log('✅ Processing placeOrder function call');
                  console.log('Function call args:', JSON.stringify(fc.args, null, 2));
                  
                  // Debug: Check the exact structure of items
                  console.log('Raw function call args structure:', {
                    args: fc.args,
                    stringified: JSON.stringify(fc.args, null, 2),
                    itemsType: typeof fc.args?.items,
                    itemsIsArray: Array.isArray(fc.args?.items),
                    firstItem: fc.args?.items?.[0],
                    firstItemType: typeof fc.args?.items?.[0]
                  });
                  
                  try {
                    const args = fc.args as any;
                    
                    // Validate required fields
                    if (!args) {
                      console.error('❌ Args is null or undefined');
                      throw new Error('No order data provided');
                    }
                    
                    if (!args.items || !Array.isArray(args.items) || args.items.length === 0) {
                      console.error('❌ Invalid items array:', args.items);
                      throw new Error('No items in order');
                    }
                    
                    if (!args.address || typeof args.address !== 'string' || args.address.trim() === '') {
                      console.error('❌ Invalid address:', args.address);
                      throw new Error('No delivery address provided');
                    }
                    
                    if (!args.phone || typeof args.phone !== 'string' || args.phone.trim() === '') {
                      console.error('❌ Invalid phone:', args.phone);
                      throw new Error('No phone number provided');
                    }
                    
                    // Process each item
                    const finalizedItems: OrderItem[] = args.items
                      .map((oi: any, index: number) => {
                        console.log(`Processing item ${index + 1} raw:`, oi);
                        console.log(`Type of item ${index + 1}:`, typeof oi);
                        
                        let itemName = '';
                        let quantity = 1;
                        
                        // Handle different possible formats from AI
                        if (typeof oi === 'string') {
                          // Item is a string like "Chicken Biryani"
                          itemName = oi.trim();
                          quantity = 1; // Default quantity
                          console.log(`String item detected: "${itemName}"`);
                        } else if (typeof oi === 'object' && oi !== null) {
                          // Item is an object with properties
                          itemName = String(
                            oi.name || 
                            oi.item || 
                            oi.menuItem || 
                            oi.product || 
                            oi.title || 
                            ''
                          ).trim();
                          
                          quantity = Number(oi.quantity) || 
                                    Number(oi.qty) || 
                                    Number(oi.amount) || 
                                    1;
                          
                          console.log(`Object item detected: name="${itemName}", quantity=${quantity}`);
                        } else {
                          console.warn(`Unexpected item format:`, oi);
                          return null;
                        }
                        
                        if (!itemName) {
                          console.warn('Item name is empty after processing:', oi);
                          return null;
                        }
                        
                        console.log(`Looking for menu item matching: "${itemName}"`);
                        
                        // Clean up item name for matching
                        const cleanName = itemName.toLowerCase()
                          .replace(/\b(extra|large|medium|small|spicy|mild|with|without)\b/g, '')
                          .replace(/[^a-z\s]/g, '')
                          .trim();
                        
                        // Find matching menu item
                        const menuItem = MENU_ITEMS.find(mi => {
                          const menuName = mi.name.toLowerCase();
                          
                          // Exact match
                          if (menuName === cleanName) return true;
                          
                          // Contains match
                          if (menuName.includes(cleanName) || cleanName.includes(menuName)) return true;
                          
                          // Word-by-word matching
                          const menuWords = menuName.split(/\s+/);
                          const itemWords = cleanName.split(/\s+/);
                          
                          // Check if any significant word matches
                          const significantMatch = menuWords.some(mw => 
                            mw.length > 3 && itemWords.some(iw => iw.includes(mw) || mw.includes(iw))
                          );
                          
                          return significantMatch;
                        });
                        
                        if (!menuItem) {
                          console.warn(`No menu item found for: "${itemName}" (cleaned: "${cleanName}")`);
                          console.log('Available menu items:', MENU_ITEMS.map(m => m.name));
                          
                          // Try partial matching as fallback
                          const partialMatch = MENU_ITEMS.find(mi => 
                            mi.name.toLowerCase().includes(cleanName.split(' ')[0]) ||
                            cleanName.includes(mi.name.toLowerCase().split(' ')[0])
                          );
                          
                          if (partialMatch) {
                            console.log(`Found partial match: ${partialMatch.name} for "${itemName}"`);
                            return {
                              name: partialMatch.name,
                              quantity,
                              price: partialMatch.price
                            };
                          }
                          
                          // Return custom item
                          return {
                            name: itemName,
                            quantity,
                            price: 0
                          };
                        }
                        
                        console.log(`✅ Matched: "${itemName}" -> "${menuItem.name}"`);
                        
                        return {
                          name: menuItem.name,
                          quantity,
                          price: menuItem.price
                        };
                      })
                      .filter((item): item is OrderItem => item !== null);
                    
                    if (finalizedItems.length === 0) {
                      throw new Error('No valid items could be processed from the order');
                    }
                    
                    console.log('✅ Finalized order items:', finalizedItems);
                    console.log('✅ Delivery address:', args.address);
                    console.log('✅ Phone number:', args.phone);
                    
                    // Calculate total
                    const total = finalizedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    console.log(`✅ Total order value: $${total.toFixed(2)}`);
                    
                    // Call parent callback
                    onOrderPlaced(finalizedItems, args.address.trim(), args.phone.trim());
                    
                    // Show success animation
                    const itemCount = finalizedItems.reduce((sum, item) => sum + item.quantity, 0);
                    showOrderAnimation(`✅ Order confirmed! ${itemCount} items ($${total.toFixed(2)}) on their way to ${args.address}`);
                    
                    // Send success response back to AI
                    if (sessionRef.current) {
                      console.log('📤 Sending success response to AI');
                      sessionRef.current.sendToolResponse({
                        functionResponses: [{
                          id: fc.id,
                          name: fc.name,
                          response: { 
                            result: `Order confirmed successfully! ${itemCount} items totaling $${total.toFixed(2)} will be delivered to ${args.address}.`
                          }
                        }]
                      });
                    }
                    
                  } catch (error) {
                    console.error('❌ Error processing order:', error);
                    
                    // Send error response to AI
                    if (sessionRef.current) {
                      sessionRef.current.sendToolResponse({
                        functionResponses: [{
                          id: fc.id,
                          name: fc.name,
                          response: { 
                            error: "Failed to process order. Please try again.",
                            details: error instanceof Error ? error.message : String(error)
                          }
                        }]
                      });
                    }
                    
                    // Show error message in chat
                    setTranscriptions(prev => [...prev, { 
                      role: 'agent', 
                      text: "I encountered an error processing your order. Please try again or provide more details." 
                    }]);
                  }
                } else {
                  console.warn(`Unknown function call: ${fc.name}`);
                }
              }
            }
          },
          onclose: () => {
            console.log('Session closed');
            setIsActive(false);
          },
          onerror: (e: any) => {
            console.error('Session error:', e);
            setIsActive(false);
            setIsConnecting(false);
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (error) {
      console.error('Failed to start session:', error);
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    console.log('Stopping session');
    
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (error) {
        console.error('Error closing session:', error);
      }
      sessionRef.current = null;
    }
    
    // Clean up audio resources
    sourcesRef.current.forEach(s => {
      try {
        s.stop();
      } catch (error) {
        console.error('Error stopping audio source:', error);
      }
    });
    sourcesRef.current.clear();
    
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (error) {
        console.error('Error disconnecting script processor:', error);
      }
      scriptProcessorRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (error) {
          console.error('Error stopping media track:', error);
        }
      });
      mediaStreamRef.current = null;
    }
    
    if (audioContextsRef.current) {
      try {
        audioContextsRef.current.input.close();
        audioContextsRef.current.output.close();
      } catch (error) {
        console.error('Error closing audio contexts:', error);
      }
      audioContextsRef.current = null;
    }
    
    nextStartTimeRef.current = 0;
    
    setIsActive(false);
    setIsConnecting(false);
  };

  useEffect(() => {
    if (isOpen && !isActive) {
      startSession();
    }
    
    return () => {
      if (!isOpen) {
        stopSession();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-orange-900/10 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-300">
      {/* Order Success Animation */}
      {showOrderSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]">
          <div className="absolute inset-0 bg-black/30"></div>
          <div className="relative bg-white rounded-2xl p-8 max-w-sm mx-4 shadow-2xl animate-in zoom-in duration-300">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <i className="fas fa-check text-green-600 text-3xl"></i>
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">🎉 Order Confirmed!</h3>
              <p className="text-gray-600 mb-4">{orderSuccessMessage}</p>
              <div className="flex space-x-2 justify-center">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden border-l border-orange-100">
        <div className="p-6 orange-gradient text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-white text-orange-600 animate-pulse' : 'bg-white/20'}`}>
              <i className={`fas ${isActive ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Voice Agent</h2>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                {isConnecting ? 'Connecting...' : isActive ? 'Listening' : 'Disconnected'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-orange-50/20">
          {isConnecting && (
            <div className="text-center pt-20">
              <div className="flex justify-center space-x-2 mb-4">
                <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce delay-200"></div>
              </div>
              <p className="text-sm text-gray-500">
                Starting voice session...
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Please wait while we connect to the voice assistant...
              </p>
            </div>
          )}

          {!isConnecting && transcriptions.length === 0 && isActive && (
            <div className="text-center pt-20">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-microphone-alt text-orange-500 text-xl"></i>
              </div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Voice Assistant Ready</p>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Speak clearly and tell me your order. Include items, address, and phone number.
              </p>
            </div>
          )}

          {transcriptions.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                t.role === 'user' 
                  ? 'bg-orange-600 text-white font-medium' 
                  : 'bg-white text-gray-700 border border-orange-100 shadow-sm'
              }`}>
                {t.text}
                {t.role === 'agent' && i === transcriptions.length - 1 && (
                  <div className="flex space-x-1 mt-2">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></div>
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse delay-150"></div>
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse delay-300"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-white border-t border-orange-50">
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-4 bg-orange-100 rounded-2xl mb-4">
              <i className="fas fa-microphone text-orange-600 text-2xl"></i>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {isActive ? 'Speak now...' : 'Connecting to voice assistant...'}
            </p>
          </div>
          
          <div className="mt-4 flex justify-center items-center space-x-4">
            <div className="flex space-x-2">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-200'}`}></div>
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse delay-150' : 'bg-gray-200'}`}></div>
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse delay-300' : 'bg-gray-200'}`}></div>
            </div>
            <span className="text-xs text-gray-500">
              {isConnecting ? 'Connecting...' : isActive ? 'Listening ✓' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};