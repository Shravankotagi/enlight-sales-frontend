import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronLeft } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught runtime render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="max-w-lg mx-auto my-12 p-6 bg-white rounded-2xl border border-rose-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-2xs">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Unable to Display Page
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            {this.state.error?.message ||
              'A rendering issue occurred while loading this view. You can retry or return to Customer Health.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset?.();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer">
              <RefreshCw size={13} />
              Retry
            </button>
            <a
              href="/customers"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer">
              <ChevronLeft size={14} />
              Back to Customer Health
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
