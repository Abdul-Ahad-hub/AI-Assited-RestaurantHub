import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MenuItem, OrderItem, Restaurant } from '../types';
import { apiFetch } from '../services/apiClient';
import { SmartImage } from './SmartImage';

export type VoiceFormFillType = 'checkout' | 'profile' | 'register' | null;

interface ChatInterfaceProps {
  onOrderPlaced: (items: OrderItem[], address: string, phone: string, restaurantId?: string) => void;
  isOpen: boolean;
  onOpen?: () => void;
  onClose: () => void;
  activeRestaurant?: Restaurant | null;
  activeMenuItems?: MenuItem[];
  selectedCity?: string;
  onSelectRestaurant?: (restaurantIdOrSlug: string) => void;
  onSearchCompleted?: (results: { answer: string; restaurants: any[]; foods: any[] }) => void;
  voiceFormType?: VoiceFormFillType;
  onFormFilled?: (fields: Record<string, string>) => void;
  startInVoiceMode?: boolean;
}

interface ChatTurn {
  role: 'user' | 'agent';
  text: string;
  restaurants?: any[];
  foods?: any[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  isOpen,
  onOpen,
  onClose,
  activeRestaurant,
  selectedCity = 'All',
  onSelectRestaurant,
  onSearchCompleted,
  voiceFormType = null,
  onFormFilled,
  startInVoiceMode = false
}) => {
  const [isTalkMode, setIsTalkMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceStatusText, setVoiceStatusText] = useState('Listening... Speak whenever you are ready');
  const [voiceNotice, setVoiceNotice] = useState<string>('');
  const [closingCountdown, setClosingCountdown] = useState<number | null>(null);
  const [micError, setMicError] = useState('');
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isSendingText, setIsSendingText] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const latestTranscriptRef = useRef('');
  const silenceTimerRef = useRef<any>(null);
  const restartTimerRef = useRef<any>(null);
  const closeCountdownRef = useRef<any>(null);
  const keepListeningRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);

  // Store parent callbacks in refs so parent re-renders never trigger useEffect cleanup!
  const onCloseRef = useRef(onClose);
  const onFormFilledRef = useRef(onFormFilled);
  const onSearchCompletedRef = useRef(onSearchCompleted);
  useEffect(() => {
    onCloseRef.current = onClose;
    onFormFilledRef.current = onFormFilled;
    onSearchCompletedRef.current = onSearchCompleted;
  }, [onClose, onFormFilled, onSearchCompleted]);

  const currentRestName = activeRestaurant?.name || 'Restaurant Hub AI';
  const currentRestId = activeRestaurant?.id || 'rest_abdul_ahad';

  const clearCloseCountdown = useCallback(() => {
    if (closeCountdownRef.current) {
      clearInterval(closeCountdownRef.current);
      closeCountdownRef.current = null;
    }
    setClosingCountdown(null);
  }, []);

  const stopVoiceEngine = useCallback((reasonNotice?: string) => {
    keepListeningRef.current = false;
    isProcessingRef.current = false;
    isSpeakingRef.current = false;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (closeCountdownRef.current) {
      clearInterval(closeCountdownRef.current);
      closeCountdownRef.current = null;
    }
    setClosingCountdown(null);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsListening(false);
    setIsReconnecting(false);
    setIsAiSpeaking(false);
    setIsProcessingVoice(false);
    if (reasonNotice) {
      setVoiceNotice(reasonNotice);
    }
  }, []);

  const speakTextAloud = (text: string, onDone?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onDone?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.04;
      let finished = false;
      const finishOnce = () => {
        if (finished) return;
        finished = true;
        isSpeakingRef.current = false;
        setIsAiSpeaking(false);
        onDone?.();
      };
      utter.onstart = () => {
        isSpeakingRef.current = true;
        setIsAiSpeaking(true);
      };
      utter.onend = finishOnce;
      utter.onerror = finishOnce;
      window.speechSynthesis.speak(utter);
      // Safety fallback in case browser speechSynthesis hangs or is muted
      setTimeout(finishOnce, Math.max(3000, Math.min(12000, text.length * 75)));
    } catch {
      isSpeakingRef.current = false;
      onDone?.();
    }
  };

  const scheduleGracefulAutoClose = useCallback(() => {
    clearCloseCountdown();
    let remaining = 3;
    setClosingCountdown(remaining);
    setVoiceNotice('Task completed! Closing voice assistant automatically in 3 seconds...');

    closeCountdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCloseCountdown();
        stopVoiceEngine();
        setIsTalkMode(false);
        onCloseRef.current();
      } else {
        setClosingCountdown(remaining);
        setVoiceNotice(`Task completed! Closing voice assistant automatically in ${remaining}s...`);
      }
    }, 1000);
  }, [clearCloseCountdown, stopVoiceEngine]);

  const executeVoiceTranscript = useCallback(
    async (spokenText: string) => {
      const clean = spokenText.trim();
      if (!clean || isProcessingRef.current) return;

      clearCloseCountdown();
      setVoiceNotice('');

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      isProcessingRef.current = true;
      setIsProcessingVoice(true);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      setVoiceStatusText(
        voiceFormType ? 'Extracting and filling form fields...' : 'Executing your request...'
      );

      try {
        const res = await apiFetch('/api/ai/voice-command', {
          method: 'POST',
          body: JSON.stringify({
            transcript: clean,
            formType: voiceFormType,
            city: selectedCity,
            restaurantId: currentRestId
          })
        });

        const reply = res.spokenReply || 'Done!';
        setVoiceStatusText(reply);
        isProcessingRef.current = false;
        setIsProcessingVoice(false);

        if (res.action === 'form_fill' && res.fields && onFormFilledRef.current) {
          onFormFilledRef.current(res.fields);
        } else if (res.action === 'search' && res.searchData) {
          setMessages(prev => [
            ...prev,
            { role: 'user', text: clean },
            {
              role: 'agent',
              text: res.searchData.answer,
              restaurants: res.searchData.restaurants,
              foods: res.searchData.foods
            }
          ]);
          if (onSearchCompletedRef.current) {
            onSearchCompletedRef.current(res.searchData);
          }
        }

        speakTextAloud(reply, () => {
          scheduleGracefulAutoClose();
        });
      } catch (err: any) {
        isProcessingRef.current = false;
        setIsProcessingVoice(false);
        const errMsg = err?.message || 'Could not process voice command.';
        setVoiceStatusText('Listening... Speak whenever you are ready');
        setVoiceNotice(`Note: ${errMsg}. Microphone is still active — keep speaking or tap Apply.`);
        if (keepListeningRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch {}
        }
      }
    },
    [voiceFormType, selectedCity, currentRestId, clearCloseCountdown, scheduleGracefulAutoClose]
  );

  const executeVoiceTranscriptRef = useRef(executeVoiceTranscript);
  useEffect(() => {
    executeVoiceTranscriptRef.current = executeVoiceTranscript;
  }, [executeVoiceTranscript]);

  const startVoiceEngine = useCallback(async () => {
    clearCloseCountdown();
    setMicError('');
    setVoiceNotice('');
    setLiveTranscript('');
    latestTranscriptRef.current = '';
    keepListeningRef.current = true;
    isProcessingRef.current = false;
    setVoiceStatusText(
      voiceFormType
        ? 'Speak your form details (name, phone, address, notes)...'
        : 'Listening continuously... Speak whenever you are ready'
    );

    // 1. Verify microphone permission
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !mediaStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      }
    } catch {
      setMicError(
        'Microphone access was blocked or not found. Allow microphone permission in your browser address bar, or type your command below.'
      );
      setVoiceStatusText('Microphone permission needed');
      setVoiceNotice('Voice listening paused because microphone permission was not granted.');
      return;
    }

    // 2. Start Continuous SpeechRecognition with Resilient Auto-Keepalive
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setMicError(
        'Browser SpeechRecognition is supported in Chrome and Edge. You can still type or tap a voice command below.'
      );
      setVoiceNotice('Browser speech recognition is unavailable in this browser.');
      return;
    }

    const createAndStartInstance = () => {
      if (!keepListeningRef.current) return;
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onresult = null;
            recognitionRef.current.stop();
          } catch {}
        }

        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setIsReconnecting(false);
          setVoiceNotice('');
        };

        recognition.onresult = (event: any) => {
          let combined = '';
          for (let i = 0; i < event.results.length; i++) {
            combined += event.results[i][0].transcript + ' ';
          }
          const trimmed = combined.trim();
          if (trimmed) {
            setLiveTranscript(trimmed);
            latestTranscriptRef.current = trimmed;
            setVoiceStatusText('Hearing you...');
            setVoiceNotice('');

            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (trimmed.length >= 4) {
              silenceTimerRef.current = setTimeout(() => {
                executeVoiceTranscriptRef.current(latestTranscriptRef.current);
              }, 2800);
            }
          }
        };

        recognition.onerror = (ev: any) => {
          if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
            keepListeningRef.current = false;
            setMicError(
              'Microphone permission was denied. Click the site settings icon in your address bar to allow Microphone.'
            );
            setVoiceNotice('Voice session stopped: Microphone permission denied by browser.');
            setIsListening(false);
            setIsReconnecting(false);
          } else if (ev.error === 'audio-capture') {
            setVoiceNotice('No microphone detected. Check your audio input device or tap Resume.');
            setIsListening(false);
          } else if (ev.error === 'network') {
            setVoiceNotice('Browser speech network hiccup — auto-reconnecting microphone...');
          }
          // For 'no-speech' or 'aborted', onend will automatically re-arm listening.
        };

        recognition.onend = () => {
          // Chrome/Edge stops SpeechRecognition after ~6s of silence.
          // Automatically re-arm with a fresh instance while still in Talk Mode!
          if (keepListeningRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
            setIsReconnecting(true);
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            restartTimerRef.current = setTimeout(() => {
              if (keepListeningRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
                createAndStartInstance();
              }
            }, 180);
          } else {
            setIsListening(false);
            setIsReconnecting(false);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        setIsReconnecting(false);
      } catch (e: any) {
        setIsListening(false);
        setIsReconnecting(false);
        setVoiceNotice('Voice listening paused by browser. Tap the microphone orb or Resume below.');
      }
    };

    createAndStartInstance();
  }, [voiceFormType, clearCloseCountdown]);

  // Only react to `isOpen`, `startInVoiceMode`, or `voiceFormType` changes — never re-run on parent re-renders!
  useEffect(() => {
    if (isOpen && (startInVoiceMode || voiceFormType)) {
      setIsTalkMode(true);
      startVoiceEngine();
    } else if (!isOpen) {
      stopVoiceEngine();
      setIsTalkMode(false);
    }
  }, [isOpen, startInVoiceMode, voiceFormType, startVoiceEngine, stopVoiceEngine]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      stopVoiceEngine();
    };
  }, [stopVoiceEngine]);

  const handleSwitchToTalkMode = () => {
    setIsTalkMode(true);
    startVoiceEngine();
  };

  const handleStayInVoiceMode = () => {
    clearCloseCountdown();
    setVoiceNotice('Auto-close cancelled. Listening resumed!');
    startVoiceEngine();
  };

  const handleCloseTalkMode = () => {
    stopVoiceEngine();
    setIsTalkMode(false);
    onCloseRef.current();
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = textInput.trim();
    if (!q || isSendingText) return;
    setTextInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setIsSendingText(true);

    try {
      const data = await apiFetch('/api/ai/discovery', {
        method: 'POST',
        body: JSON.stringify({ query: q, city: selectedCity })
      });
      setMessages(prev => [
        ...prev,
        {
          role: 'agent',
          text: data.answer,
          restaurants: data.restaurants,
          foods: data.foods
        }
      ]);
      if (onSearchCompletedRef.current) {
        onSearchCompletedRef.current(data);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'agent',
          text: err?.message || 'Unable to process request right now.'
        }
      ]);
    } finally {
      setIsSendingText(false);
    }
  };

  // =========================================================================
  // 1. FLOATING BOTTOM-RIGHT LAUNCHER BUTTON WHEN CLOSED
  // =========================================================================
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="rh-ai-fab"
        title="Tell me what you want and I will place your order"
      >
        <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
          <i className="fas fa-comment-dots text-sm"></i>
        </span>
        <span className="flex flex-col items-start leading-tight text-left">
          <span className="text-[13px] font-extrabold">I'm here. Skip the clicking.</span>
          <span className="text-[10px] font-semibold opacity-90">Just tell me, I'll place your order</span>
        </span>
      </button>
    );
  }

  // =========================================================================
  // 2. FULLSCREEN CHATGPT-STYLE TALKING AI OVERLAY (WHEN IN TALK MODE)
  // =========================================================================
  if (isTalkMode) {
    return (
      <div className="rh-voice-fullscreen animate-in fade-in duration-200">
        {/* Top Bar with Live Connection Status Badge */}
        <div className="w-full max-w-2xl flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isListening || isReconnecting
                  ? 'bg-emerald-400 animate-ping'
                  : isProcessingVoice || isAiSpeaking
                  ? 'bg-[#a78bfa] animate-ping'
                  : 'bg-amber-400'
              }`}
            ></span>
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#c4b5fd]">
              {voiceFormType ? `AI Voice Form Fill (${voiceFormType})` : 'Restaurant Hub Voice AI'}
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-gray-200">
              {isProcessingVoice
                ? 'Processing...'
                : isAiSpeaking
                ? 'Speaking reply...'
                : isListening
                ? 'Mic Active • Auto-Keepalive On'
                : isReconnecting
                ? 'Keeping mic active...'
                : 'Mic Paused'}
            </span>
          </div>
          {!voiceFormType && (
            <button
              type="button"
              onClick={() => {
                stopVoiceEngine();
                setIsTalkMode(false);
              }}
              className="text-xs font-bold text-gray-300 hover:text-white bg-white/10 px-3.5 py-2 rounded-xl"
            >
              Switch to Chat
            </button>
          )}
        </div>

        {/* Center Pulsing AI Sign / Orb */}
        <div className="flex flex-col items-center justify-center text-center my-auto space-y-6 max-w-xl w-full px-4">
          <div
            onClick={() => {
              if (!isListening && !isProcessingVoice) startVoiceEngine();
            }}
            className="rh-ai-orb-wrap cursor-pointer"
            title="Tap to start or resume microphone"
          >
            {(isListening || isReconnecting || isAiSpeaking) && <div className="rh-ai-orb-ring"></div>}
            {(isListening || isReconnecting || isAiSpeaking) && <div className="rh-ai-orb-ring delay"></div>}
            <div
              className={`rh-ai-orb ${
                isListening || isReconnecting || isAiSpeaking || isProcessingVoice ? 'speaking' : ''
              }`}
            >
              <i
                className={`fas ${
                  isProcessingVoice
                    ? 'fa-circle-notch fa-spin'
                    : isAiSpeaking
                    ? 'fa-volume-up'
                    : isListening || isReconnecting
                    ? 'fa-microphone'
                    : 'fa-microphone-slash'
                } text-4xl text-white`}
              ></i>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              {voiceStatusText}
            </h2>

            {/* Clear Status / Countdown / Pause Indication Banner */}
            {voiceNotice && (
              <div className="bg-amber-500/20 border border-amber-400/40 rounded-2xl px-4 py-3 text-xs font-bold text-amber-200 max-w-md mx-auto flex flex-col items-center gap-2">
                <span>
                  <i className="fas fa-info-circle mr-1.5"></i>
                  {voiceNotice}
                </span>
                {closingCountdown !== null && (
                  <button
                    type="button"
                    onClick={handleStayInVoiceMode}
                    className="bg-white text-[#1e1b2e] hover:bg-gray-100 px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow"
                  >
                    Stay in Voice Mode
                  </button>
                )}
              </div>
            )}

            {/* Resume button whenever mic is paused */}
            {!isListening && !isReconnecting && !isProcessingVoice && !isAiSpeaking && closingCountdown === null && (
              <button
                type="button"
                onClick={() => startVoiceEngine()}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-full text-xs font-extrabold inline-flex items-center gap-2 shadow-lg"
              >
                <i className="fas fa-microphone"></i>
                <span>Resume Listening</span>
              </button>
            )}

            {liveTranscript && (
              <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm font-semibold text-[#c4b5fd]">
                "{liveTranscript}"
              </div>
            )}
            {micError && (
              <div className="bg-red-500/20 border border-red-400/40 rounded-xl p-3 text-xs text-red-200 max-w-md mx-auto">
                <i className="fas fa-exclamation-circle mr-1.5"></i>
                {micError}
              </div>
            )}
          </div>

          {/* Instant Submit or Voice Command Input */}
          <div className="w-full max-w-md space-y-3 pt-2">
            {liveTranscript && !isProcessingVoice && (
              <button
                type="button"
                onClick={() => executeVoiceTranscript(liveTranscript)}
                className="rh-btn-primary px-6 py-2.5 rounded-full text-xs font-extrabold"
              >
                Done Speaking • Apply Now
              </button>
            )}

            <div className="bg-white/10 border border-white/15 rounded-2xl p-2 flex items-center gap-2">
              <input
                type="text"
                value={liveTranscript}
                onChange={e => setLiveTranscript(e.target.value)}
                placeholder={
                  voiceFormType
                    ? 'Speak into mic or type e.g. "Address House 12 DHA Phase 6, phone 03001234567"'
                    : 'Speak into mic or type a voice command...'
                }
                className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder-gray-400 outline-none"
              />
              <button
                type="button"
                onClick={() => executeVoiceTranscript(liveTranscript)}
                disabled={!liveTranscript.trim() || isProcessingVoice}
                className="rh-btn-primary px-4 py-2 rounded-xl text-xs font-extrabold disabled:opacity-40"
              >
                Apply
              </button>
            </div>

            {voiceFormType === 'checkout' && (
              <button
                type="button"
                onClick={() =>
                  executeVoiceTranscript(
                    'My address is House 14, Street 5, DHA Phase 6 Karachi, phone number is +92 300 1234567, promo code ROYAL15, and make it medium spicy'
                  )
                }
                className="text-[11px] font-bold text-[#c4b5fd] hover:underline"
              >
                <i className="fas fa-magic mr-1"></i> Try sample voice fill: "House 14 DHA Phase 6, +92 300 1234567, code ROYAL15"
              </button>
            )}
          </div>
        </div>

        {/* Bottom Close / Turn Off Talking AI Control */}
        <div className="w-full max-w-md flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleCloseTalkMode}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-2xl transition-transform active:scale-95"
            title="Close AI & Turn Off Microphone"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Close AI
          </span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. BOTTOM-RIGHT POPUP CHAT WIDGET (DEFAULT CHAT MODE, EMPTY PRE-CHAT)
  // =========================================================================
  return (
    <div className="rh-ai-popup animate-in fade-in duration-150">
      {/* Header */}
      <div className="p-4 rh-hero-gradient text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <i className="fas fa-comment-dots text-white text-sm"></i>
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold tracking-tight">Why do it manually?</h2>
            <p className="text-[10px] opacity-90 truncate max-w-[140px]">{currentRestName}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSwitchToTalkMode}
            className="bg-white text-[#7c3aed] hover:bg-purple-50 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <i className="fas fa-microphone"></i>
            <span>Switch to Talk</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"
            aria-label="Close AI"
          >
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>
      </div>

      {/* Chat Messages Area (Clean Empty Pre-Chat State) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#faf9fe] dark:bg-[#0f0d17]">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[86%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'rh-btn-primary text-white font-semibold'
                  : 'bg-white dark:bg-[#1d192b] text-[#1e1b2e] dark:text-[#f3f0ff] border border-[#e4e1ee] dark:border-[#322b47] shadow-sm'
              }`}
            >
              {m.text}
            </div>

            {m.restaurants && m.restaurants.length > 0 && (
              <div className="w-full mt-2 space-y-1.5">
                {m.restaurants.map((r: any) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (onSelectRestaurant) {
                        onSelectRestaurant(r.id);
                        onClose();
                      }
                    }}
                    className="bg-white dark:bg-[#1d192b] p-2.5 rounded-xl border border-[#e4e1ee] dark:border-[#322b47] hover:border-[#7c3aed] cursor-pointer flex items-center gap-2.5 transition-all"
                  >
                    <SmartImage
                      src={r.cover_url || r.logo_url}
                      alt={r.name}
                      fallbackLabel={r.name}
                      className="w-11 h-11 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-extrabold truncate">{r.name}</h4>
                        <span className="text-[11px] font-bold text-[#7c3aed] dark:text-[#a78bfa]">
                          ★ {Number(r.rating_avg).toFixed(1)}
                        </span>
                      </div>
                      <p className="text-[10px] rh-text-muted truncate">
                        {r.cuisine} • {r.area}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {isSendingText && (
          <div className="text-xs font-semibold text-[#7c3aed] dark:text-[#a78bfa] flex items-center gap-2 px-2">
            <i className="fas fa-circle-notch fa-spin"></i>
            Thinking...
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSendText}
        className="p-3 bg-white dark:bg-[#1d192b] border-t border-[#e4e1ee] dark:border-[#322b47] flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          placeholder="Tell me what you feel like eating..."
          className="flex-1 bg-[#f3f1f9] dark:bg-[#181524] border border-[#e4e1ee] dark:border-[#322b47] rounded-xl px-3.5 py-2 text-xs outline-none focus:border-[#7c3aed]"
        />
        <button
          type="button"
          onClick={handleSwitchToTalkMode}
          className="w-9 h-9 rounded-xl bg-[#f5f3ff] dark:bg-[#7c3aed]/20 text-[#7c3aed] dark:text-[#a78bfa] flex items-center justify-center hover:opacity-85"
          title="Switch to Talk Mode"
        >
          <i className="fas fa-microphone text-xs"></i>
        </button>
        <button
          type="submit"
          disabled={!textInput.trim() || isSendingText}
          className="rh-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold disabled:opacity-40"
        >
          <i className="fas fa-paper-plane"></i>
        </button>
      </form>
    </div>
  );
};
