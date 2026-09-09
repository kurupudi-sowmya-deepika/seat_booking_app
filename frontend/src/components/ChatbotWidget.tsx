import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  actions?: string[];
  metadata?: any;
}

const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      text: 'Hi! I am the SeatSync AI Assistant. How can I help you today?',
      isBot: true,
      actions: ['Book a Seat', 'Check Availability', 'My Bookings', 'Add Credits']
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), text, isBot: false };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/chatbot/message', {
        conversation_id: convId,
        message: text
      });
      
      setConvId(res.data.conversation_id);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: res.data.message,
        isBot: true,
        actions: res.data.suggested_actions,
        metadata: res.data.metadata
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting to my servers right now.",
        isBot: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingConfirm = async (payload: any) => {
    try {
      setLoading(true);
      const res = await api.post('/bookings/', {
        seat_id: payload.seat_id,
        booking_date: payload.booking_date,
        time_slot_id: payload.time_slot_id
      });
      
      if (res.data.id) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: `✅ Booking confirmed! Your booking ID is ${res.data.id.substring(0,8)}. I have deducted the credits from your wallet.`,
          isBot: true,
          actions: ['View My Bookings']
        }]);
      }
    } catch (err: any) {
      const errorText = err.response?.data?.detail || "Failed to create booking.";
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: `❌ Could not confirm booking: ${errorText}`,
        isBot: true,
        actions: errorText.includes('credits') ? ['Add Credits'] : []
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleTopupConfirm = async (payload: any) => {
    try {
      setLoading(true);
      const res = await api.post('/wallet/topup', { amount: payload.amount });
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: `❌ Could not start topup: ${err.response?.data?.detail}`,
        isBot: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirm = async (payload: any) => {
    try {
      setLoading(true);
      const res = await api.post(`/bookings/${payload.booking_id}/cancel`);
      if (res.data) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: `✅ Booking ${payload.booking_id.substring(0,8)} has been cancelled and credits refunded.`,
          isBot: true
        }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: `❌ Could not cancel booking: ${err.response?.data?.detail}`,
        isBot: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMetadata = (msg: Message) => {
    if (!msg.metadata || !msg.metadata.action) return null;
    
    if (msg.metadata.action === 'REQUIRE_BOOKING_CONFIRMATION') {
      return (
        <div className="mt-3 p-3 bg-[rgba(0,0,0,0.3)] rounded-lg border border-[var(--border-color)] text-sm">
          <p className="font-semibold text-white mb-2 flex items-center gap-1"><AlertCircle size={14}/> Action Required</p>
          <button 
            onClick={() => handleBookingConfirm(msg.metadata.payload)}
            className="btn btn-primary w-full py-1 text-xs mt-2"
            disabled={loading}
          >
            Confirm & Pay with Wallet
          </button>
        </div>
      );
    }
    
    if (msg.metadata.action === 'REQUIRE_TOPUP_CONFIRMATION') {
      return (
        <div className="mt-3 p-3 bg-[rgba(0,0,0,0.3)] rounded-lg border border-[var(--border-color)] text-sm">
          <button 
            onClick={() => handleTopupConfirm(msg.metadata.payload)}
            className="btn btn-primary w-full py-1 text-xs mt-2"
            disabled={loading}
          >
            Proceed to Secure Payment (₹{msg.metadata.payload.amount})
          </button>
        </div>
      );
    }
    
    if (msg.metadata.action === 'REQUIRE_CANCEL_CONFIRMATION') {
      return (
        <div className="mt-3 p-3 bg-[rgba(0,0,0,0.3)] rounded-lg border border-[var(--border-color)] text-sm">
          <button 
            onClick={() => handleCancelConfirm(msg.metadata.payload)}
            className="btn btn-danger w-full py-1 text-xs mt-2"
            disabled={loading}
          >
            Yes, Cancel Booking
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[var(--primary-color)] text-white flex-center shadow-[0_0_20px_rgba(var(--primary-color-rgb),0.5)] hover:scale-110 transition-transform z-50 ${isOpen ? 'hidden' : ''}`}
      >
        <MessageSquare size={24} />
      </button>

      {/* Chat Window */}
      <div className={`fixed bottom-6 right-6 w-96 h-[600px] max-h-[80vh] glass-panel flex flex-col z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[rgba(255,255,255,0.02)] rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-color flex-center text-white">
              <Bot size={18} />
            </div>
            <h3 className="font-semibold text-white">SeatSync AI</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${msg.isBot ? 'bg-[rgba(255,255,255,0.05)] text-text-secondary border border-[rgba(255,255,255,0.05)] rounded-tl-none' : 'bg-primary-color text-white rounded-tr-none'}`}>
                <div className="whitespace-pre-wrap">{msg.text}</div>
                {renderMetadata(msg)}
                
                {/* Actions */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.actions.map(action => (
                      <button
                        key={action}
                        onClick={() => {
                          if (action === 'View My Bookings') navigate('/my-bookings');
                          else sendMessage(action);
                        }}
                        className="px-3 py-1 rounded-full border border-[var(--primary-color)] text-[var(--primary-color)] text-xs hover:bg-[var(--primary-color)] hover:text-white transition-colors"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] rounded-2xl rounded-tl-none p-3">
                <Loader2 size={16} className="animate-spin text-primary-color" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] rounded-b-xl">
          <form 
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex gap-2"
          >
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-primary-color transition-colors"
              disabled={loading}
            />
            <button 
              type="submit" 
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-lg bg-primary-color text-white flex-center disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default ChatbotWidget;
