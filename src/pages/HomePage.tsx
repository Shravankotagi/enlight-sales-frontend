import { useQuery } from '@tanstack/react-query';
import { kraApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import {
  AlertCircle, Clock, CheckCircle,
  TrendingUp, Users, Home
} from 'lucide-react';


const COLOR_MAP: Record<string, { border: string; bg: string; icon: string }> = {
  red: { border: 'border-red-200', bg: 'bg-red-50', icon: 'text-red-500' },
  orange: { border: 'border-orange-200', bg: 'bg-orange-50', icon: 'text-orange-500' },
  yellow: { border: 'border-yellow-200', bg: 'bg-yellow-50', icon: 'text-yellow-600' },
  blue: { border: 'border-blue-200', bg: 'bg-blue-50', icon: 'text-blue-500' },
  green: { border: 'border-green-200', bg: 'bg-green-50', icon: 'text-green-600' },
};

const ICON_MAP: Record<string, React.ElementType> = {
  review_queue: AlertCircle,
  stale_deals: Clock,
  followups_due: Users,
  visit_target: TrendingUp,
  complaints_pending: AlertCircle,
  monthly_progress: CheckCircle,
};

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

export default function HomePage() {
  const navigate = useNavigate();
  const { employee } = useAuth();

  useEffect(() => {
    document.title = 'Home — Enlight Sales OS';
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['action-queue'],
    queryFn: () => kraApi.getActionQueue().then(r => r.data.data),
    refetchInterval: 5 * 60 * 1000,
  });

  const actions = data?.actions || [];
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
            {employee?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting}, {employee?.name?.split(' ')[0] || 'there'}! 👋
            </h1>
            <p className="text-gray-500 text-sm">{today}</p>
          </div>
        </div>
      </div>

      {/* Action Queue */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Home size={18} className="text-blue-500" />
          Your Action Queue
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border rounded-xl p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-16 mb-3" />
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">All caught up!</h3>
            <p className="text-gray-400 text-sm">No actions needed right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {actions.map((action: any, i: number) => {
              const colors = COLOR_MAP[action.color] || COLOR_MAP.blue;
              const IconComp = ICON_MAP[action.type] || CheckCircle;
              return (
                <div
                  key={i}
                  onClick={() => navigate(action.link)}
                  className={`border-l-4 ${colors.border} ${colors.bg} rounded-xl p-4 cursor-pointer hover:shadow-md transition-all group`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[action.priority]}`}>
                      {action.priority.toUpperCase()}
                    </span>
                    <div className={`w-8 h-8 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <span className={`text-sm font-bold ${colors.icon}`}>{action.count}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <IconComp size={18} className={`${colors.icon} flex-shrink-0 mt-0.5`} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{action.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{action.subtitle}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Links</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Pipeline', path: '/' },
            { label: 'Intelligence', path: '/intelligence' },
            { label: 'Reports', path: '/reports' },
            { label: 'Pricing', path: '/pricing' },
            { label: 'Customers', path: '/customers' },
          ].map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
