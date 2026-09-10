import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, X, Send, Bot, Loader2, AlertCircle, 
  CheckCircle2, Sparkles, Plus, Trash2, Tag, Building2, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  actions?: string[];
  metadata?: any;
}

export const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      text: "👋 Hi! I'm the SeatSync AI Concierge. I can help you search live workspace availability, book seats, reserve meeting rooms, buy day passes, and manage your credits.",
      isBot: true,
      actions: ['Find seats in Bangalore', 'Book a Day Pass', 'Find meeting room for 6', 'Check wallet balance']
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
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm experiencing a momentary connection issue with the server. Please try again.",
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
        booking_type: payload.booking_type || 'SEAT',
        location_id: payload.location_id,
        branch_id: payload.branch_id,
        seat_id: payload.seat_id,
        day_pass_id: payload.day_pass_id,
        room_id: payload.room_id,
        booking_date: payload.booking_date,
        time_slot_id: payload.time_slot_id,
        start_time: payload.start_time,
        end_time: payload.end_time
      });
      
      if (res.data.id) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: `🎉 Booking confirmed! Booking ID: #${res.data.id.substring(0, 8).toUpperCase()}. ₹${res.data.amount} credits have been deducted from your wallet.`,
          isBot: true,
          actions: ['View My Bookings', 'Check Wallet Balance']
        }]);
      }
    } catch (err: any) {
      const errorText = err.response?.data?.detail || "Failed to finalize booking.";
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: `❌ Could not complete booking: ${errorText}`,
        isBot: true,
        actions: errorText.includes('Insufficient') ? ['Add Credits'] : ['Try Again']
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
        text: `❌ Could not create payment session: ${err.response?.data?.detail}`,
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
          text: `✅ Booking #${payload.booking_id.substring(0, 8).toUpperCase()} has been cancelled and ₹${res.data.amount} has been refunded to your wallet.`,
          isBot: true,
          actions: ['View My Bookings', 'Check Wallet Balance']
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
      const p = msg.metadata.payload;
      return (
        <div className="mt-3 p-3.5 bg-blue-50/90 rounded-xl border border-blue-200 text-xs text-gray-800 space-y-2">
          <p className="font-bold text-[#005691] flex items-center gap-1.5 text-xs">
            <Sparkles size={14} /> Ready to Confirm Booking
          </p>
          <div className="space-y-1 text-[11px] text-gray-600 bg-white p-2.5 rounded-lg border border-blue-100">
            <div><strong>Type:</strong> {p.booking_type || 'Workspace'}</div>
            <div><strong>Date:</strong> {p.booking_date}</div>
            {p.amount && <div><strong>Amount:</strong> ₹{p.amount}</div>}
          </div>
          <button 
            onClick={() => handleBookingConfirm(p)}
            className="w-full py-2 bg-[#007bc0] hover:bg-[#005691] text-white rounded-lg font-bold text-xs shadow transition-all flex items-center justify-center gap-1.5"
            disabled={loading}
          >
            <CheckCircle2 size={14} /> Confirm & Deduct Credits
          </button>
        </div>
      );
    }
    
    if (msg.metadata.action === 'REQUIRE_TOPUP_CONFIRMATION') {
      return (
        <div className="mt-3 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
          <p className="font-bold text-emerald-800 mb-2">Prepaid Wallet Top-up</p>
          <button 
            onClick={() => handleTopupConfirm(msg.metadata.payload)}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow transition-all flex items-center justify-center gap-1.5"
            disabled={loading}
          >
            <Plus size={14} /> Proceed to Stripe Checkout (₹{msg.metadata.payload.amount})
          </button>
        </div>
      );
    }
    
    if (msg.metadata.action === 'REQUIRE_CANCEL_CONFIRMATION') {
      return (
        <div className="mt-3 p-3.5 bg-red-50 rounded-xl border border-red-200 text-xs">
          <p className="font-bold text-red-800 mb-2">Cancel Reservation?</p>
          <button 
            onClick={() => handleCancelConfirm(msg.metadata.payload)}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow transition-all flex items-center justify-center gap-1.5"
            disabled={loading}
          >
            <Trash2 size={14} /> Confirm Cancellation & Refund
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-[#005691] to-[#007bc0] text-white flex items-center justify-center shadow-xl hover:scale-105 transition-all z-50 ${isOpen ? 'hidden' : ''}`}
        title="Chat with AI Concierge"
      >
        <MessageSquare size={24} />
      </button>

      {/* Floating Chat Modal */}
      <div className={`fixed bottom-6 right-6 w-96 h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 transition-all duration-300 origin-bottom-right overflow-hidden ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#005691] to-[#007bc0] text-white flex justify-between items-center shrink-0 shadow">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">SeatSync AI Concierge</h3>
              <p className="text-[10px] text-blue-100 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online & Ready
              </p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Message Trail */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gray-50/50">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                msg.isBot 
                  ? 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm' 
                  : 'bg-[#007bc0] text-white rounded-tr-none shadow'
              }`}>
                <div className="whitespace-pre-wrap">{msg.text}</div>
                {renderMetadata(msg)}
                
                {/* Action Chips */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                    {msg.actions.map(action => (
                      <button
                        key={action}
                        onClick={() => {
                          if (action === 'View My Bookings') navigate('/my-bookings');
                          else if (action === 'Add Credits') navigate('/wallet');
                          else sendMessage(action);
                        }}
                        className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#007bc0] text-[11px] font-semibold hover:bg-[#007bc0] hover:text-white transition-all"
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
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={14} className="animate-spin text-[#007bc0]" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3 bg-white border-t border-gray-200 shrink-0">
          <form 
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex gap-2"
          >
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI concierge to book seats, passes..."
              className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#007bc0]/30 focus:border-[#007bc0] transition-all"
              disabled={loading}
            />
            <button 
              type="submit" 
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-[#007bc0] hover:bg-[#005691] text-white flex items-center justify-center transition-all disabled:opacity-50 shadow shrink-0"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default ChatbotWidget;
