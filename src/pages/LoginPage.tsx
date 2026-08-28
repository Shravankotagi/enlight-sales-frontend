import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Phone,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Lock,
  Sparkles,
} from 'lucide-react';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');
const defaultBackend = isLocal
  ? 'http://localhost:3000'
  : 'https://enlight-sales-backend-production-b720.up.railway.app';
let rawBackend = import.meta.env.VITE_BACKEND_URL || defaultBackend;
if (
  rawBackend &&
  !rawBackend.startsWith('http://') &&
  !rawBackend.startsWith('https://')
) {
  rawBackend = `https://${rawBackend}`;
}
const BACKEND = rawBackend.replace(/\/+$/, '');

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');

  const handleRequestOtp = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `91${phone.replace(/\D/g, '').slice(-10)}`,
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `Backend server error (${res.status})` };
      }
      if (!res.ok)
        throw new Error(
          data.error || data.message || `Failed to send OTP (${res.status})`,
        );
      if (data.data?.dev_otp) setDevOtp(data.data.dev_otp);
      setStep('otp');
    } catch (err: any) {
      setError(
        err.message ||
          'Unable to connect to backend service. Please check backend server.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `91${phone.replace(/\D/g, '').slice(-10)}`,
          otp,
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `Backend server error (${res.status})` };
      }
      if (!res.ok)
        throw new Error(
          data.error || data.message || `Invalid OTP (${res.status})`,
        );
      login(data.data.token, data.data.employee);
      navigate('/');
    } catch (err: any) {
      setError(
        err.message || 'Verification failed. Please check backend service.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/60 relative overflow-hidden flex items-center justify-center p-4 sm:p-6 font-sans select-none">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-300/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-300/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] border border-slate-200/90 p-8 sm:p-10 z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Icon Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-4 ring-blue-50 mb-4 transition-transform hover:scale-105">
            <Sparkles size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Enlight Sales OS
          </h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1.5 flex items-center justify-center gap-1.5">
            <span>Enlight Metals Private Limited</span>
          </p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                WhatsApp Phone Number
              </label>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-slate-50/60 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 transition-all shadow-2xs">
                <span className="inline-flex items-center gap-1.5 px-3.5 bg-slate-100/80 border-r border-slate-200 text-slate-700 text-sm font-bold select-none">
                  <Phone size={14} className="text-slate-500" />
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  maxLength={10}
                  autoFocus
                  className="flex-1 px-3.5 py-3 text-sm text-slate-900 font-mono font-medium placeholder-slate-400 bg-transparent outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleRequestOtp()}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                We'll send a 6-digit secure login code to your WhatsApp.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium animate-in fade-in duration-150">
                {error}
              </div>
            )}

            <button
              onClick={handleRequestOtp}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Sending Code...</span>
                </>
              ) : (
                <>
                  <span>Send OTP on WhatsApp</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setError('');
                    setOtp('');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={12} />
                  <span>Change number</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="• • • • • •"
                  maxLength={6}
                  autoFocus
                  className="w-full px-4 py-3.5 bg-slate-50/60 border border-slate-200 rounded-xl text-center text-xl font-bold font-mono tracking-[0.35em] text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-2xs"
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                />
              </div>

              <p className="text-[11px] text-slate-500 mt-2 text-center">
                Enter the 6-digit code sent to{' '}
                <strong className="text-slate-800 font-mono">
                  +91 {phone}
                </strong>
              </p>

              {devOtp && (
                <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
                  <span className="font-medium">Testing Mode Active:</span>
                  <span className="font-mono text-sm font-bold bg-amber-200/80 px-2 py-0.5 rounded-md text-amber-950">
                    {devOtp}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium animate-in fade-in duration-150">
                {error}
              </div>
            )}

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Verify &amp; Sign In</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Security Trust Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
          <Lock size={12} className="text-slate-400" />
          <span>Enterprise Secure Login • 256-Bit SSL Encrypted</span>
        </div>
      </div>
    </div>
  );
}
