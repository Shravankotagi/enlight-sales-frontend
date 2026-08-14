import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { chatbotApi } from '../lib/api';
import {
  Sparkles,
  Send,
  Plus,
  MessageSquare,
  Shield,
  BookOpen,
  AlertTriangle,
  RefreshCw,
  User,
  Bot,
  ChevronRight,
  TrendingUp,
  BarChart2,
  Users,
  Search,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at?: string;
}

interface ChatSession {
  id: string;
  channel: string;
  started_at: string;
  last_active_at: string;
}

export default function AssistantPage() {
  const { employee, viewingAs } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingSessions, setFetchingSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeEmployee = viewingAs || employee;
  const role = (activeEmployee?.role || 'salesperson').toLowerCase();
  const isManagerOrAdmin = role === 'manager' || role === 'admin';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const loadSessions = async () => {
    try {
      setFetchingSessions(true);
      const res = await chatbotApi.getSessions();
      const rawData = res.data;
      const sessionList: ChatSession[] = Array.isArray(rawData?.sessions)
        ? rawData.sessions
        : Array.isArray(rawData)
        ? rawData
        : [];
      setSessions(sessionList);
      if (sessionList.length > 0 && !activeSessionId) {
        selectSession(sessionList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load chat sessions:', err);
    } finally {
      setFetchingSessions(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const selectSession = async (sessionId: string) => {
    try {
      setActiveSessionId(sessionId);
      setLoading(true);
      setError(null);
      const res = await chatbotApi.getSessionMessages(sessionId);
      const rawData = res.data;
      const msgList: ChatMessage[] = Array.isArray(rawData?.messages)
        ? rawData.messages
        : Array.isArray(rawData)
        ? rawData
        : [];
      setMessages(msgList);
    } catch (err: any) {
      console.error('Failed to load session messages:', err);
      setError('Could not load session history.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = () => {
    setActiveSessionId(null);
    setMessages([]);
    setError(null);
    setInputText('');
  };

  const handleSend = async (promptTextOverride?: string) => {
    const textToSend = promptTextOverride || inputText.trim();
    if (!textToSend || loading) return;

    setInputText('');
    setError(null);

    // Optimistic user turn addition
    const tempUserMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await chatbotApi.sendMessage({
        message: textToSend,
        sessionId: activeSessionId || undefined,
      });

      const resData = res.data?.data || res.data || {};
      const sessionId = resData.sessionId || resData.session_id;
      const reply = resData.reply || 'Request completed.';

      if (sessionId && sessionId !== activeSessionId) {
        setActiveSessionId(sessionId);
        loadSessions();
      }

      const assistantMsg: ChatMessage = {
        id: 'asst-' + Date.now(),
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errReply =
        err.response?.data?.message || err.message || 'Error processing your request.';
      setError(errReply);
      const errAsstMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `⚠️ ${errReply}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errAsstMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Quick prompt suggestions based on role
  const quickPrompts = isManagerOrAdmin
    ? [
        { label: 'Team Pipeline Summary', text: 'Show me the team pipeline summary and grand value across sales reps.', icon: TrendingUp },
        { label: 'Customer Churn Radar', text: 'Which customer accounts have high or medium churn risk right now?', icon: Users },
        { label: 'Lost Deal Analytics', text: 'Analyze lost deals and top revenue loss reasons over the last 90 days.', icon: BarChart2 },
        { label: 'Company Knowledge Base', text: 'What is our policy on volume discounts and gross margin thresholds in the Sales SOP?', icon: BookOpen },
      ]
    : [
        { label: 'My Active Open Deals', text: 'Show my active open deals and quotations in the pipeline.', icon: TrendingUp },
        { label: 'Customer 360 Overview', text: 'What is the 360 overview for our top customer accounts?', icon: Users },
        { label: 'Sales SOP Guidelines', text: 'Search the Knowledge Base for discount rules and quotation policies.', icon: Search },
      ];

  // Parse citation tags in assistant replies: e.g. [Source: Sales SOP 2026]
  const renderFormattedMessage = (text: string) => {
    const citationRegex = /\[Source:\s*([^\]]+)\]/g;
    const parts = text.split(citationRegex);

    if (parts.length === 1) {
      return <p className="whitespace-pre-wrap leading-relaxed">{text}</p>;
    }

    const elements: any[] = [];
    let i = 0;
    while (i < parts.length) {
      elements.push(<span key={`text-${i}`}>{parts[i]}</span>);
      if (i + 1 < parts.length) {
        const sourceTitle = parts[i + 1];
        elements.push(
          <span
            key={`cite-${i}`}
            className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-mono text-xs font-semibold my-1 mx-1 hover:bg-amber-500/20 transition-colors"
            title={`Cited Source Document: ${sourceTitle}`}
          >
            <BookOpen size={12} className="shrink-0 text-amber-500" />
            Source: {sourceTitle}
          </span>,
        );
        i += 2;
      } else {
        i += 1;
      }
    }

    return <div className="whitespace-pre-wrap leading-relaxed">{elements}</div>;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-900 text-slate-100 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Top Header Bar with Scope Indicator */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Enlight Sales AI Assistant
              </h1>
              <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full text-xs font-semibold">
                v1.0 Ready
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Conversational Sales OS & Knowledge Base RAG Assistant
            </p>
          </div>
        </div>

        {/* Identity & Scope Badge */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
          <Shield size={16} className="text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="text-slate-400">Scope Indicator: </span>
            <span className="font-semibold text-white">
              {activeEmployee?.name || 'Authorized User'}
            </span>
            <span className="ml-2 uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Main Container: Sidebar + Chat Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Session History */}
        <div className="w-72 bg-slate-950/70 border-r border-slate-800 flex flex-col p-4 space-y-4">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-blue-600/20 active:scale-98"
          >
            <Plus size={18} />
            <span>New Conversation</span>
          </button>

          <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-400">
            <span>Recent Conversations</span>
            <button
              onClick={loadSessions}
              className="p-1 hover:text-white transition-colors"
              title="Refresh sessions"
            >
              <RefreshCw size={12} className={fetchingSessions ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {!Array.isArray(sessions) || sessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No past sessions found. Start a new conversation!
              </div>
            ) : (
              sessions.map((sess) => {
                const isSelected = sess.id === activeSessionId;
                const formattedDate = sess.last_active_at
                  ? new Date(sess.last_active_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Active';

                return (
                  <button
                    key={sess.id}
                    onClick={() => selectSession(sess.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 text-white border border-blue-500/40 font-medium'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare
                        size={14}
                        className={isSelected ? 'text-blue-400' : 'text-slate-500'}
                      />
                      <span className="truncate">
                        Session #{sess.id ? sess.id.slice(0, 8) : 'New'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {formattedDate}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Safety & Cap Notice */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Shield size={13} className="text-blue-400" />
              <span>RBAC & Cost Protection</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Data queries are dual-layer scoped to your identity. Daily Gemini spend is capped at $5.00/day.
            </p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          {/* Chat Messages List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {(!Array.isArray(messages) || messages.length === 0) && !loading ? (
              <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-6 my-auto">
                <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-blue-400">
                  <Sparkles size={36} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-white">
                    Welcome to Enlight Sales OS Assistant
                  </h2>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Ask questions about your pipeline, active deals, Knowledge Base SOPs, reorder queues, or churn risks.
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="grid grid-cols-2 gap-3 w-full text-left">
                  {quickPrompts.map((qp, idx) => {
                    const IconComp = qp.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSend(qp.text)}
                        className="flex flex-col p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 rounded-xl transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <IconComp size={18} className="text-blue-400 group-hover:scale-110 transition-transform" />
                          <ChevronRight size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                        </div>
                        <span className="text-xs font-semibold text-white group-hover:text-blue-300">
                          {qp.label}
                        </span>
                        <span className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                          {qp.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              Array.isArray(messages) &&
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3.5 max-w-3xl ${
                      isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-blue-400 border border-slate-700'
                      }`}
                    >
                      {isUser ? <User size={16} /> : <Bot size={16} />}
                    </div>

                    <div
                      className={`p-4 rounded-2xl text-sm ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none shadow-lg'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        renderFormattedMessage(msg.content || '')
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Thinking / Loading indicator */}
            {loading && (
              <div className="flex items-center gap-3 mr-auto max-w-xs p-4 bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-none">
                <Bot size={16} className="text-blue-400 animate-pulse" />
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <span>Assistant is analyzing...</span>
                  <span className="animate-ping font-bold">.</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-6 mb-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="p-4 bg-slate-950 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-3 bg-slate-900 border border-slate-800 focus-within:border-blue-500 px-4 py-2.5 rounded-xl transition-all"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about pipeline deals, customer 360, SOP rules, churn radar..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-all active:scale-95 shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
