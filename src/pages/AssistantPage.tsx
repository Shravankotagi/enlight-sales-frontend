import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { menuRoleLabel } from '../utils/roleLabel';
import { chatbotApi, visitsApi } from '../lib/api';
import {
  Sparkles,
  Send,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
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
  FileText,
  MapPin,
  X,
  Loader2,
} from 'lucide-react';
import AssistantAttachMenu from '../components/AssistantAttachMenu';
import { createVisitGpsSession, type GpsReading } from '../utils/visitGps';
import { visitCityLabel } from '../utils/visitForm';
import KnowledgeBaseModal from '../components/KnowledgeBaseModal';
import MarkdownMessage from '../components/MarkdownMessage';
import InteractiveButtons, { type InteractiveButton } from '../components/chat/InteractiveButtons';
import InteractiveCatalogMenu, { type InteractiveListData } from '../components/chat/InteractiveCatalogMenu';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at?: string;
  interactiveType?: 'buttons' | 'list' | 'text';
  interactiveButtons?: InteractiveButton[] | null;
  interactiveList?: InteractiveListData | null;
  image?: { base64: string; mimeType: string } | null;
  gps?: { latitude: number; longitude: number; accuracy?: number } | null;
}

interface ChatSession {
  id: string;
  channel: string;
  started_at: string;
  last_active_at: string;
  title?: string;
}

const ACTIVE_SESSION_KEY = 'enlight_active_chat_session_id';
const MESSAGES_CACHE_KEY = 'enlight_active_chat_messages';

const TECHNICAL_PAYLOAD_DISPLAY_MAP: Record<string, string> = {
  menu_1: '1. Log New Inquiry',
  menu_2: '2. Update Inquiry',
  menu_3: '3. Log New Order',
  menu_4: '4. Update Order',
  menu_5: '5. Log Field Visit',
  menu_6: '6. Update Field Visit',
  menu_7: '7. New Customer Acquisition',
  menu_8: '8. Log Customer Complaint',
  menu_9: '9. Update Customer Complaint',
  menu_10: '10. General Query',

  start_log_inquiry: '1. Log New Inquiry',
  start_update_inquiry: '2. Update Inquiry',
  start_log_order: '3. Log New Order',
  start_update_order: '4. Update Order',
  start_log_visit: '5. Log Field Visit',
  start_update_visit: '6. Update Field Visit',
  start_new_customer: '7. New Customer Acquisition',
  start_log_complaint: '8. Log Customer Complaint',
  start_update_complaint: '9. Update Customer Complaint',
  start_general_query: '10. General Query',

  btn_repeat_log_inquiry: 'Log Another Inquiry',
  btn_repeat_update_inquiry: 'Update Another Inquiry',
  btn_repeat_log_order: 'Record Another Order',
  btn_repeat_update_order: 'Update Another Order',
  btn_repeat_log_visit: 'Log Another Visit',
  btn_repeat_update_visit: 'Update Another Visit',
  btn_repeat_new_customer: 'Onboard Another Customer',
  btn_repeat_log_new_customer: 'Onboard Another Customer',
  btn_repeat_log_complaint: 'Log Another Complaint',
  btn_repeat_update_complaint: 'Update Another Complaint',

  btn_confirm_yes: 'Save / Yes',
  btn_confirm_edit: 'Edit Details',
  btn_confirm_cancel: 'Cancel',
  btn_post_menu: 'Menu',
  btn_cust_yes: 'Yes, Add Customer',
  btn_cust_no: 'No / Cancel',
  btn_resume_yes: 'Yes, Continue',
  btn_resume_no: 'No, Go to Menu',
  btn_att_no: 'No',

  proc_1: 'Pending prices',
  proc_2: 'All inquiries',
  proc_3: 'Log a Base Price',
  proc_4: 'My team',

  menu_price: 'Add Price to Inquiry',
  btn_price_save: 'Save',
};

export function formatUserDisplayMessage(content?: string): string {
  if (!content || typeof content !== 'string') return content || '';
  const trimmed = content.trim();
  const lower = trimmed.toLowerCase();

  if (TECHNICAL_PAYLOAD_DISPLAY_MAP[lower]) {
    return TECHNICAL_PAYLOAD_DISPLAY_MAP[lower];
  }

  if (lower.startsWith('btn_price_current')) return 'Price the current inquiry';

  // Dynamic fallback for any pattern like menu_X or btn_repeat_X
  if (/^menu_([1-9]|10)$/i.test(lower)) {
    const num = lower.replace(/^menu_/, '');
    return TECHNICAL_PAYLOAD_DISPLAY_MAP[`menu_${num}`] || `Option ${num}`;
  }

  if (lower.startsWith('btn_repeat_')) {
    const cleanAction = lower.replace(/^btn_repeat_/, '').replace(/_/g, ' ');
    return `Record Another ${cleanAction.replace(/\b\w/g, (c) => c.toUpperCase())}`;
  }

  return content;
}

function getSavedSessionId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_SESSION_KEY) || localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

function getCachedMessages(sessionId: string | null): ChatMessage[] {
  if (!sessionId || sessionId === 'new') return [];
  try {
    const raw = sessionStorage.getItem(`${MESSAGES_CACHE_KEY}_${sessionId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse cached chat messages:', err);
  }
  return [];
}

const COMPOSER_MAX_HEIGHT = 160;

function assistantAsksForVisitLocation(text: string) {
  return /log customer field visit|location is auto-fetched|location pin or city|type the city/i.test(text);
}

function fitComposer(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
}

export default function AssistantPage() {
  const { employee, viewingAs, roleName, isAdmin, isSalesManager, isProcurementManager, isProcurementPerson } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const initialSessionId = getSavedSessionId();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initialSessionId && initialSessionId !== 'new' ? initialSessionId : null
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getCachedMessages(initialSessionId)
  );
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingSessions, setFetchingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kbModalOpen, setKbModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const focusInput = () => {
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 50);
  };

  // Photo & GPS attachment state for field visits
  const [selectedPhoto, setSelectedPhoto] = useState<{
    file: File;
    previewUrl: string;
    base64: string;
  } | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'acquired' | 'error'>('idle');
  const [gpsStatusText, setGpsStatusText] = useState<string>('');
  const [visitFix, setVisitFix] = useState<GpsReading | null>(null);
  const [visitAddress, setVisitAddress] = useState('');
  const [visitLocationPrompt, setVisitLocationPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoSourceRef = useRef<'camera' | 'upload' | null>(null);
  const gpsSessionRef = useRef<ReturnType<typeof createVisitGpsSession> | null>(null);
  const visitWatchStarted = useRef(false);
  const pageMounted = useRef(true);

  const activeEmployee = viewingAs || employee;
  const role = (activeEmployee?.role || 'salesperson').toLowerCase();
  const isManagerOrAdmin =
    role === 'manager' || role === 'sales_manager' || role === 'admin';
  const isProcurement =
    role === 'procurement_person' || role === 'procurement_manager';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Keep texting cursor on the text input whenever loading ends or on initial mount
  useEffect(() => {
    if (!loading) {
      focusInput();
    }
  }, [loading]);

  useEffect(() => {
    pageMounted.current = true;
    return () => {
      pageMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (textInputRef.current) fitComposer(textInputRef.current);
  }, [inputText]);

  const beginVisitGps = () => {
    if (!gpsSessionRef.current) gpsSessionRef.current = createVisitGpsSession();
    const session = gpsSessionRef.current;
    if (visitWatchStarted.current) return session;
    visitWatchStarted.current = true;
    setVisitLocationPrompt((current) => current || 'Reading the visit location…');
    void session.watchForAddress().then(async (coords) => {
      if (!pageMounted.current) return;
      if (!coords) {
        visitWatchStarted.current = false;
        setVisitFix(null);
        setVisitAddress('');
        setVisitLocationPrompt('Type the city if GPS is unavailable.');
        return;
      }
      setVisitFix(coords);
      try {
        const res = await visitsApi.reverseGeocode(coords.latitude, coords.longitude);
        const body = res?.data?.data || res?.data;
        const address = visitCityLabel(body?.address) || visitCityLabel(body?.city);
        if (!pageMounted.current) return;
        setVisitAddress(address);
        setVisitLocationPrompt(address || 'Type the city if GPS is unavailable.');
      } catch {
        if (!pageMounted.current) return;
        setVisitLocationPrompt('Type the city if GPS is unavailable.');
      }
    });
    return session;
  };

  useEffect(() => {
    const latest = [...messages].reverse().find((msg) => msg.role === 'assistant');
    if (!latest || !assistantAsksForVisitLocation(latest.content || '')) return;
    beginVisitGps();
  }, [messages]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    const isPdf = type === 'application/pdf' || name.endsWith('.pdf');
    const isImage = type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/.test(name);
    if (!isPdf || isImage) {
      setError('Upload a PDF. Use Capture an image for photos.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedPhoto({
        file,
        previewUrl: isPdf ? '' : URL.createObjectURL(file),
        base64,
      });
      focusInput();
    };
    reader.readAsDataURL(file);
    setError(null);
    photoSourceRef.current = 'upload';
    setGpsLocation(null);
    setGpsStatus('idle');
    setGpsStatusText('');
  };

  const handleClearPhoto = () => {
    if (selectedPhoto?.previewUrl) {
      URL.revokeObjectURL(selectedPhoto.previewUrl);
    }
    setSelectedPhoto(null);
    setGpsLocation(null);
    setGpsStatus('idle');
    setGpsStatusText('');
    photoSourceRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    focusInput();
  };

  const loadSessions = async () => {
    try {
      setFetchingSessions(true);
      setSessionsError(null);
      const res = await chatbotApi.getSessions();
      const rawData = res.data?.data || res.data || {};
      const sessionList: ChatSession[] = Array.isArray(rawData?.sessions)
        ? rawData.sessions
        : Array.isArray(rawData)
        ? rawData
        : [];
      setSessions(sessionList);

      const savedSessionId = getSavedSessionId();
      if (savedSessionId && savedSessionId !== 'new') {
        selectSession(savedSessionId);
      } else if (!savedSessionId && sessionList.length > 0) {
        selectSession(sessionList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load chat sessions:', err);
      setSessionsError('Conversation history could not be loaded. Try again.');
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
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
      } catch {}

      // Pre-load from cache if available so there is zero empty screen jump
      const cached = getCachedMessages(sessionId);
      if (cached.length > 0) {
        setMessages(cached);
      }

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
      try {
        sessionStorage.setItem(`${MESSAGES_CACHE_KEY}_${sessionId}`, JSON.stringify(msgList));
      } catch {}
    } catch (err: any) {
      console.error('Failed to load session messages:', err);
      setError('Could not load session history.');
    } finally {
      setLoading(false);
      focusInput();
    }
  };

  const handleNewConversation = () => {
    setActiveSessionId(null);
    sessionStorage.setItem(ACTIVE_SESSION_KEY, 'new');
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, 'new');
    } catch {}
    setMessages([]);
    setError(null);
    setInputText('');
    visitWatchStarted.current = false;
    setVisitFix(null);
    setVisitAddress('');
    setVisitLocationPrompt('');
    handleClearPhoto();
    focusInput();
  };

  const handleSend = async (
    promptTextOverride?: string,
    displayTitle?: string,
  ) => {
    let textToSend = promptTextOverride || inputText.trim();
    if ((!textToSend && !selectedPhoto) || loading) return;

    const isPdfAttachment = selectedPhoto?.file.type === 'application/pdf';
    const mappedSend = formatUserDisplayMessage(textToSend);
    let userDisplayText = mappedSend !== textToSend
      ? mappedSend
      : (displayTitle || mappedSend || (selectedPhoto ? (isPdfAttachment ? 'Attached PDF document' : 'Attached image') : ''));

    // Parity with WhatsApp list selection: if user typed a menu number (1–10) while looking at the Catalog Menu
    if (!promptTextOverride && textToSend) {
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
      const isAwaitingCatalogMenu =
        lastAssistantMsg?.interactiveType === 'list' &&
        Array.isArray(lastAssistantMsg?.interactiveList?.sections) &&
        lastAssistantMsg.interactiveList.sections.length > 0;

      if (isAwaitingCatalogMenu) {
        const numMatch = textToSend.trim().match(/^(?:option\s*|choice\s*|#\s*)?(11|10|[1-9])\.?$/i);
        if (numMatch) {
          const selectedNum = numMatch[1];
          for (const sec of lastAssistantMsg.interactiveList?.sections || []) {
            const foundRow = sec.rows?.find(
              (r) => r.id === `menu_${selectedNum}` || r.title.startsWith(`${selectedNum}.`)
            );
            if (foundRow) {
              textToSend = foundRow.id || `menu_${selectedNum}`;
              userDisplayText = formatUserDisplayMessage(textToSend);
              if (userDisplayText === textToSend) userDisplayText = foundRow.title;
              break;
            }
          }
        }
      }
    }
    const photoToSend = selectedPhoto;
    const source = photoSourceRef.current;
    const lastAssistant = [...messages].reverse().find((msg) => msg.role === 'assistant');
    const wantsLocation = assistantAsksForVisitLocation(lastAssistant?.content || '');
    const gpsToSend =
      source === 'upload' ? null : source === 'camera' ? gpsLocation : wantsLocation ? visitFix : null;
    let outbound = textToSend || (photoToSend ? 'Attached image' : '');
    if (wantsLocation && visitAddress && source !== 'upload' && !outbound.includes(visitAddress)) {
      outbound = `${outbound}\nLocation: ${visitAddress}`.trim();
    }

    setInputText('');
    handleClearPhoto();
    setError(null);

    // Optimistic user turn addition
    const tempUserMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: userDisplayText,
      created_at: new Date().toISOString(),
      image: photoToSend ? { base64: photoToSend.base64, mimeType: photoToSend.file.type } : null,
      gps: gpsToSend || null,
    };
    setMessages((prev) => {
      const next = [...prev, tempUserMsg];
      if (activeSessionId) {
        try {
          sessionStorage.setItem(`${MESSAGES_CACHE_KEY}_${activeSessionId}`, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
    setLoading(true);

    try {
      const res = await chatbotApi.sendMessage({
        message: outbound,
        sessionId: activeSessionId || undefined,
        image: photoToSend ? { base64: photoToSend.base64, mimeType: photoToSend.file.type } : undefined,
        gps: gpsToSend || undefined,
        photoSource: source === 'camera' || source === 'upload' ? source : undefined,
      });

      const resData = res.data?.data || res.data || {};
      const sessionId = resData.sessionId || resData.session_id;
      const reply = resData.reply || 'Request completed.';
      const interactiveType = resData.interactiveType || 'text';
      const interactiveButtons = resData.interactiveButtons || null;
      const interactiveList = resData.interactiveList || null;

      const cleanSnippet = formatUserDisplayMessage(userDisplayText);
      const titleSnippet =
        cleanSnippet.length > 35
          ? cleanSnippet.slice(0, 35).trim() + '...'
          : cleanSnippet.trim();

      if (sessionId) {
        setActiveSessionId(sessionId);
        sessionStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
        try {
          localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
        } catch {}

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
        interactiveType,
        interactiveButtons,
        interactiveList,
      };
      setMessages((prev) => {
        const next = [...prev, assistantMsg];
        const targetId = sessionId || activeSessionId;
        if (targetId) {
          try {
            sessionStorage.setItem(`${MESSAGES_CACHE_KEY}_${targetId}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    } catch (err: any) {
      let errReply =
        err.response?.data?.message || err.message || 'Error processing your request.';
      if (
        err.code === 'ECONNABORTED' ||
        errReply.includes('timeout') ||
        errReply.includes('60000ms') ||
        errReply.includes('120000ms')
      ) {
        errReply =
          'The request took longer than expected to process. Please try again or refine your query.';
      }
      setError(errReply);
      const errAsstMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: errReply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => {
        const next = [...prev, errAsstMsg];
        if (activeSessionId) {
          try {
            sessionStorage.setItem(`${MESSAGES_CACHE_KEY}_${activeSessionId}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    } finally {
      setLoading(false);
      focusInput();
    }
  };

  // Quick prompt suggestions based on role
  const quickPrompts = isProcurement
    ? [
        { label: 'Pending prices', text: 'pending prices', icon: TrendingUp },
        { label: 'All inquiries', text: 'all inquiries', icon: Search },
        { label: 'Log a base price', text: 'log a base price', icon: FileText },
        ...(role === 'procurement_manager'
          ? [{ label: 'My team', text: 'my team', icon: Users }]
          : []),
      ]
    : isManagerOrAdmin
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

  // Resolves image source from raw base64, data URLs, or remote URLs
  const getImageSource = (img: any): string | null => {
    if (!img) return null;
    if (typeof img === 'string') {
      if (img.startsWith('data:') || img.startsWith('http://') || img.startsWith('https://')) {
        return img;
      }
      return `data:image/jpeg;base64,${img}`;
    }
    if (img.base64) {
      if (img.base64.startsWith('data:') || img.base64.startsWith('http://') || img.base64.startsWith('https://')) {
        return img.base64;
      }
      return `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`;
    }
    if (img.url) return img.url;
    return null;
  };

  // Streamlines menu prompt text for messages with interactive list cards
  const getDisplayContent = (msg: ChatMessage): string => {
    const raw = msg.content || '';
    if (msg.interactiveType === 'list' && msg.interactiveList?.sections && msg.interactiveList.sections.length > 0) {
      if (
        raw.includes('SalesOS Assistant') ||
        raw.includes('Log New Inquiry') ||
        /\b1\.\s+\*?\*?Log New Inquiry/i.test(raw)
      ) {
        let prefix = '';
        if (raw.includes('Activity cancelled')) {
          prefix = 'Activity cancelled.\n\n';
        } else if (raw.includes('currently in the')) {
          const parts = raw.split(/\n\nHere is the menu/i);
          if (parts.length > 1) {
            prefix = parts[0].trim() + '\n\n';
          } else {
            const firstPara = raw.split(/\n\n/)[0];
            if (firstPara) prefix = firstPara.trim() + '\n\n';
          }
        } else if (raw.includes('To start an activity, please select')) {
          prefix = 'To start an activity, please select the relevant option from the menu below:\n\n';
        }
        const rowCount = (msg.interactiveList?.sections || []).reduce(
          (sum, section) => sum + (section.rows?.length || 0),
          0,
        );
        const range = rowCount > 1 ? rowCount : 10;
        return `${prefix}Welcome to **SalesOS Assistant**!\n\nWhat would you like to do today? Reply with a number (1–${range}) or type what you'd like to do.`;
      }
      if (raw.includes('Procurement assistant') && raw.includes('Pending prices')) {
        const prefix = raw.includes('procurement manager')
          ? raw.split('Procurement assistant')[0].trim()
          : '';
        const intro = 'Procurement assistant. Choose an action.';
        return prefix ? `${prefix}\n\n${intro}` : intro;
      }
    }
    return raw;
  };

  return (
    <div className="flex flex-col min-h-[70dvh] lg:h-[calc(100dvh-3.5rem)] bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      {/* Top Header Bar with Scope Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 border border-blue-200/60 rounded-xl shadow-2xs">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900 tracking-tight">
                Enlight Sigma AI Assistant
              </h1>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                v1.0 Ready
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {isProcurement
                ? 'Pending prices, all inquiries, and base prices'
                : 'Conversational Sales OS & Knowledge Base RAG Assistant'}
            </p>
          </div>
        </div>

        {/* Header Right: Knowledge Base Action + Scope Badge */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(false)}
            className="lg:hidden px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            Chats
          </button>
          {isManagerOrAdmin && (
            <button
              onClick={() => setKbModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer"
              title="Upload and manage Knowledge Base documents & vectors"
            >
              <BookOpen size={14} className="text-blue-600" />
              <span>Manage Knowledge Base</span>
            </button>
          )}

          {/* Identity & Scope Badge */}
          <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 px-3.5 py-1.5 rounded-xl">
            <Shield size={16} className="text-emerald-600 shrink-0" />
            <div className="text-xs">
              <span className="text-gray-500">Scope Indicator: </span>
              <span className="font-semibold text-gray-900">
                {activeEmployee?.name || 'Authorized User'}
              </span>
              <span className="ml-2 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                {menuRoleLabel({ roleName, isAdmin, isSalesManager, isProcurementManager, isProcurementPerson })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container: Sidebar + Chat Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Session History */}
        <div
          className={`bg-gray-50/70 border-r border-gray-200 flex-col shrink-0 transition-[width,padding] duration-200 ${
            isSidebarCollapsed
              ? 'hidden lg:flex w-16 p-2'
              : 'absolute inset-y-0 left-0 z-20 flex w-72 p-4 shadow-xl lg:static lg:z-auto lg:shadow-none'
          }`}
        >
          <div className={`flex gap-2 ${isSidebarCollapsed ? 'flex-col' : 'items-center'}`}>
            <button
              onClick={handleNewConversation}
              className={`flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-xs active:scale-98 ${
                isSidebarCollapsed ? 'h-10 w-10' : 'flex-1 px-4 py-2.5'
              }`}
              title={isSidebarCollapsed ? 'New conversation' : undefined}
            >
              <Plus size={18} />
              {!isSidebarCollapsed && <span>New Conversation</span>}
            </button>
            <button
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
              className={`flex items-center justify-center text-gray-500 hover:text-blue-700 hover:bg-blue-50 border border-gray-200 rounded-xl transition-colors ${
                isSidebarCollapsed ? 'h-10 w-10' : 'h-10 w-10 shrink-0'
              }`}
              title={isSidebarCollapsed ? 'Expand conversation history' : 'Collapse conversation history'}
              aria-label={isSidebarCollapsed ? 'Expand conversation history' : 'Collapse conversation history'}
              aria-expanded={!isSidebarCollapsed}
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>

          {!isSidebarCollapsed && (
            <>
              <div className="flex items-center justify-between px-1 mt-4 text-xs font-semibold text-gray-500">
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
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mt-4">
                {sessionsError ? (
                  <div className="p-4 text-center text-xs text-red-600 border border-dashed border-red-200 rounded-xl bg-red-50">
                    {sessionsError}
                  </div>
                ) : !Array.isArray(sessions) || sessions.length === 0 ? (
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
                            {formatUserDisplayMessage(sess.title) || (sess.id ? `Session #${sess.id.slice(0, 8)}` : 'New Conversation')}
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
            </>
          )}
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
                    {isProcurement
                      ? 'List pending or all inquiries, or log a base price in rupees per MT.'
                      : 'Ask questions about your pipeline, active deals, Knowledge Base SOPs, reorder queues, or churn risks.'}
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                  {quickPrompts.map((qp, idx) => {
                    const IconComp = qp.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          handleSend(qp.text);
                          focusInput();
                        }}
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
              (() => {
                const lastAssistantIndex = messages
                  .map((m) => m.role)
                  .lastIndexOf('assistant');

                return messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  const isLatestAssistant = idx === lastAssistantIndex;

                  return (
                    <div
                      key={msg.id || idx}
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
                          <div className="space-y-2">
                            {(() => {
                              const isPdf = msg.image?.mimeType === 'application/pdf';
                              const imgSrc = getImageSource(msg.image);
                              if (isPdf) {
                                return (
                                  <div className="flex items-center gap-2 p-2 rounded-lg border border-blue-400 bg-blue-500/20">
                                    <FileText size={18} />
                                    <span>PDF document attached</span>
                                  </div>
                                );
                              }
                              return imgSrc ? (
                                <div className="rounded-lg overflow-hidden border border-blue-400 max-w-sm">
                                  <img
                                    src={imgSrc}
                                    alt="Visit attachment"
                                    className="w-full max-h-60 object-cover"
                                  />
                                </div>
                              ) : null;
                            })()}
                            {msg.gps && (
                              <div className="text-[11px] text-blue-100 flex items-center gap-1 font-mono">
                                <MapPin size={12} className="shrink-0" />
                                <span>
                                  {Number(msg.gps.latitude).toFixed(4)}, {Number(msg.gps.longitude).toFixed(4)}
                                  {msg.gps.accuracy ? ` (±${Math.round(Number(msg.gps.accuracy))}m)` : ''}
                                </span>
                              </div>
                            )}
                            {msg.content && <p className="whitespace-pre-wrap">{formatUserDisplayMessage(msg.content)}</p>}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <MarkdownMessage content={getDisplayContent(msg)} />

                            {/* Interactive 10-Option Catalog Menu */}
                            {msg.interactiveType === 'list' &&
                              msg.interactiveList && (
                                <InteractiveCatalogMenu
                                  interactiveList={msg.interactiveList}
                                  onSelect={(payload, title) => {
                                    handleSend(payload, title);
                                    focusInput();
                                  }}
                                  disabled={!isLatestAssistant || loading}
                                />
                              )}

                            {/* Interactive Quick-Reply Buttons */}
                            {msg.interactiveType === 'buttons' &&
                              Array.isArray(msg.interactiveButtons) &&
                              msg.interactiveButtons.length > 0 && (
                                <InteractiveButtons
                                  buttons={msg.interactiveButtons}
                                  onSelect={(payload, title) => {
                                    handleSend(payload, title);
                                    focusInput();
                                  }}
                                  disabled={!isLatestAssistant || loading}
                                />
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()
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
          <div className="sticky bottom-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white border-t border-gray-200">
            {/* Selected Photo & GPS Tag Preview Chip */}
            {selectedPhoto && (
              <div className="flex items-center gap-3 p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl mb-3 text-xs">
                {selectedPhoto.file.type === 'application/pdf' ? (
                  <div className="w-12 h-12 rounded-lg bg-white border border-blue-300 flex items-center justify-center shrink-0">
                    <FileText size={20} className="text-red-600" />
                  </div>
                ) : (
                  <img
                    src={selectedPhoto.previewUrl}
                    alt="Attachment preview"
                    className="w-12 h-12 rounded-lg object-cover border border-blue-300 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">
                    {selectedPhoto.file.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600 mt-0.5">
                    {selectedPhoto.file.type === 'application/pdf' ? (
                      <span className="text-gray-600">PDF document ready to send</span>
                    ) : gpsStatus === 'acquiring' && (
                      <>
                        <Loader2 size={13} className="animate-spin text-blue-600 shrink-0" />
                        <span className="text-blue-600">Acquiring GPS location...</span>
                      </>
                    )}
                    {gpsStatus === 'acquired' && (
                      <>
                        <MapPin size={13} className="text-emerald-600 shrink-0" />
                        <span className="text-emerald-700 font-medium">{gpsStatusText}</span>
                      </>
                    )}
                    {gpsStatus === 'error' && (
                      <>
                        <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                        <span className="text-amber-700">{gpsStatusText}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearPhoto}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white shrink-0 transition-colors"
                  title="Remove attachment"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-2 bg-gray-50 border border-gray-300 focus-within:border-blue-500 focus-within:bg-white px-3 py-2 rounded-xl transition-all shadow-2xs"
            >
              <AssistantAttachMenu
                disabled={loading}
                onUpload={() => fileInputRef.current?.click()}
                readGps={() => beginVisitGps().readForPhoto()}
                onCapture={(photoUrl, coords) => {
                  photoSourceRef.current = 'camera';
                  setSelectedPhoto({
                    file: new File([photoUrl], 'visit-photo.jpg', { type: 'image/jpeg' }),
                    previewUrl: photoUrl,
                    base64: photoUrl,
                  });
                  setGpsLocation(coords);
                  setGpsStatus('acquired');
                  setGpsStatusText(
                    `GPS Tagged: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} (±${Math.round(coords.accuracy)}m)`,
                  );
                  focusInput();
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <textarea
                ref={textInputRef}
                rows={1}
                value={inputText}
                aria-label="Message"
                onChange={(e) => {
                  setInputText(e.target.value);
                  fitComposer(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={selectedPhoto ? "Add notes for this attachment..." : isProcurement ? "Reply with a procurement number or a menu choice..." : "Ask about pipeline deals, customer 360, SOP rules, churn radar..."}
                className="max-h-40 min-h-[1.5rem] flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-5 text-gray-900 placeholder-gray-400 outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={(!inputText.trim() && !selectedPhoto) || loading}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all active:scale-95 shrink-0 shadow-2xs"
              >
                <Send size={16} />
              </button>
            </form>
            {visitLocationPrompt && assistantAsksForVisitLocation(
              [...messages].reverse().find((msg) => msg.role === 'assistant')?.content || '',
            ) && (
              <p className="mt-2 text-xs text-gray-500" aria-live="polite">
                {visitLocationPrompt}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Knowledge Base Management Modal */}
      <KnowledgeBaseModal
        isOpen={kbModalOpen}
        onClose={() => setKbModalOpen(false)}
        isAdmin={isManagerOrAdmin}
      />
    </div>
  );
}
