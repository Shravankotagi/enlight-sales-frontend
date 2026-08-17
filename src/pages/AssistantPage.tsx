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
  title?: string;
}

const ACTIVE_SESSION_KEY = 'enlight_active_chat_session_id';

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
      const rawData = res.data?.data || res.data || {};
      const sessionList: ChatSession[] = Array.isArray(rawData?.sessions)
        ? rawData.sessions
        : Array.isArray(rawData)
        ? rawData
        : [];
      setSessions(sessionList);

      const savedSessionId = sessionStorage.getItem(ACTIVE_SESSION_KEY);
      if (savedSessionId && savedSessionId !== 'new' && sessionList.some((s) => s.id === savedSessionId)) {
        selectSession(savedSessionId);
      } else if (!savedSessionId && sessionList.length > 0) {
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
      sessionStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
      setLoading(true);
      setError(null);
      const res = await chatbotApi.getSessionMessages(sessionId);
      const rawData = res.data?.data || res.data || {};
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
    sessionStorage.setItem(ACTIVE_SESSION_KEY, 'new');
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

      const titleSnippet =
        textToSend.length > 35
          ? textToSend.slice(0, 35).trim() + '...'
          : textToSend.trim();

      if (sessionId) {
        setActiveSessionId(sessionId);
        sessionStorage.setItem(ACTIVE_SESSION_KEY, sessionId);

        setSessions((prevSessions) => {
          const existing = prevSessions.find((s) => s.id === sessionId);
          const updatedSession: ChatSession = {
            id: sessionId,
            channel: 'web',
            started_at: existing?.started_at || new Date().toISOString(),
            last_active_at: new Date().toISOString(),
            title: existing?.title || titleSnippet,
          };
          const filtered = prevSessions.filter((s) => s.id !== sessionId);
          return [updatedSession, ...filtered];
        });
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
            className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-mono text-xs font-semibold my-1 mx-1 hover:bg-amber-100 transition-colors shadow-2xs"
            title={`Cited Source Document: ${sourceTitle}`}
          >
            <BookOpen size={12} className="shrink-0 text-amber-600" />
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
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      {/* Top Header Bar with Scope Indicator */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 border border-blue-200/60 rounded-xl shadow-2xs">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900 tracking-tight">
                Enlight Sales AI Assistant
              </h1>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                v1.0 Ready
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Conversational Sales OS & Knowledge Base RAG Assistant
            </p>
          </div>
        </div>

        {/* Identity & Scope Badge */}
        <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 px-3.5 py-1.5 rounded-xl">
          <Shield size={16} className="text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="text-gray-500">Scope Indicator: </span>
            <span className="font-semibold text-gray-900">
              {activeEmployee?.name || 'Authorized User'}
            </span>
            <span className="ml-2 uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Main Container: Sidebar + Chat Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Session History */}
        <div className="w-72 bg-gray-50/70 border-r border-gray-200 flex flex-col p-4 space-y-4">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-xs active:scale-98"
          >
            <Plus size={18} />
            <span>New Conversation</span>
          </button>

          <div className="flex items-center justify-between px-1 text-xs font-semibold text-gray-500">
            <span>Recent Conversations</span>
            <button
              onClick={loadSessions}
              className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
              title="Refresh sessions"
            >
              <RefreshCw size={12} className={fetchingSessions ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {!Array.isArray(sessions) || sessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
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
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold shadow-2xs'
                        : 'text-gray-700 hover:bg-gray-200/60 hover:text-gray-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare
                        size={14}
                        className={isSelected ? 'text-blue-600' : 'text-gray-400'}
                      />
                      <span className="truncate">
                        {sess.title || (sess.id ? `Session #${sess.id.slice(0, 8)}` : 'New Conversation')}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {formattedDate}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Safety & Cap Notice */}
          <div className="p-3 bg-white border border-gray-200 rounded-xl text-[11px] text-gray-600 space-y-1 shadow-2xs">
            <div className="flex items-center gap-1.5 font-semibold text-gray-800">
              <Shield size={13} className="text-blue-600" />
              <span>RBAC & Cost Protection</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight">
              Data queries are dual-layer scoped to your identity. Daily Gemini spend is capped at $5.00/day.
            </p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-50/40 overflow-hidden">
          {/* Chat Messages List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {(!Array.isArray(messages) || messages.length === 0) && !loading ? (
              <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-6 my-auto">
                <div className="p-4 bg-blue-50 border border-blue-200/60 rounded-2xl text-blue-600 shadow-2xs">
                  <Sparkles size={36} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    Welcome to Enlight Sales OS Assistant
                  </h2>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
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
                        className="flex flex-col p-4 bg-white hover:bg-blue-50/60 border border-gray-200 hover:border-blue-300 rounded-xl transition-all shadow-2xs group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <IconComp size={18} className="text-blue-600 group-hover:scale-110 transition-transform" />
                          <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-600 transition-colors" />
                        </div>
                        <span className="text-xs font-bold text-gray-900 group-hover:text-blue-700">
                          {qp.label}
                        </span>
                        <span className="text-[11px] text-gray-500 line-clamp-2 mt-1">
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
                      className={`p-2 rounded-xl shrink-0 shadow-2xs ${
                        isUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-blue-600'
                      }`}
                    >
                      {isUser ? <User size={16} /> : <Bot size={16} />}
                    </div>

                    <div
                      className={`p-4 rounded-2xl text-sm shadow-2xs ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-tr-none font-normal'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
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
              <div className="flex items-center gap-3 mr-auto max-w-xs p-3.5 bg-white border border-gray-200 rounded-2xl rounded-tl-none shadow-2xs text-xs text-gray-500">
                <Bot size={16} className="text-blue-600 animate-pulse" />
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>Assistant is analyzing...</span>
                  <span className="animate-ping font-bold">.</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-6 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 shadow-2xs">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="p-4 bg-white border-t border-gray-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-3 bg-gray-50 border border-gray-300 focus-within:border-blue-500 focus-within:bg-white px-4 py-2.5 rounded-xl transition-all shadow-2xs"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about pipeline deals, customer 360, SOP rules, churn radar..."
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all active:scale-95 shrink-0 shadow-2xs"
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
