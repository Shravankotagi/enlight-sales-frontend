import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi, BACKEND_URL } from '../lib/api';
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  KeyRound,
  Sparkles,
} from 'lucide-react';

export type SteelCategory =
  | 'Flat Steel'
  | 'Structural Steel'
  | 'Pipes & Tubes'
  | 'Value Added Products';

const PRODUCT_CATEGORIES: SteelCategory[] = [
  'Flat Steel',
  'Structural Steel',
  'Pipes & Tubes',
  'Value Added Products',
];

const BRAND_STATS = [
  { value: '25+', label: 'Steel Products & Grades Available' },
  { value: '20+', label: 'Industrial Sectors Served' },
  { value: '1000+', label: 'Buyers Onboarded' },
  { value: '100+', label: 'Sourcing & Supply Partners' },
];

function CategoryMark({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
      {name === 'Flat Steel' && (
        <>
          <path d="M3 19 16 16l13 3-13 3z" fill="#e4ebf1" />
          <path d="M3 19 16 22v3.5L3 22.5z" fill="#b4c0ca" />
          <path d="M16 22 29 19v3.5L16 25.5z" fill="#7c8996" />
          <path d="M3 13.5 16 10.5l13 3L16 16.5z" fill="#f7f9fb" />
          <path d="M3 13.5 16 16.5V19L3 16z" fill="#c5d0da" />
          <path d="M16 16.5 29 13.5V16L16 19z" fill="#8d99a6" />
          <path d="M6 13.6 16 11.2l10 2.4" fill="none" stroke="#d71920" strokeWidth="1.1" />
        </>
      )}
      {name === 'Structural Steel' && (
        <>
          <path d="M6 7h15l4 3H10z" fill="#f4f7fa" />
          <path d="M6 7h15v3.5H6z" fill="#d5dee6" />
          <path d="M21 7l4 3v3.5l-4-3z" fill="#8d99a6" />
          <path d="M11 10.5h5v10h-5z" fill="#c5ced8" />
          <path d="M16 10.5l4 3v10l-4-3z" fill="#7e8b99" />
          <path d="M6 20.5h15l4 3H10z" fill="#e7eef3" />
          <path d="M6 20.5h15V24H6z" fill="#b7c2cc" />
          <path d="M21 20.5l4 3V27l-4-3z" fill="#6d7a88" />
        </>
      )}
      {name === 'Pipes & Tubes' && (
        <>
          <path d="M12 9h11v14H12z" fill="#a8b4c0" />
          <path d="M12 9h11v4H12z" fill="#d7e0e8" />
          <ellipse cx="23" cy="16" rx="3.4" ry="7" fill="#8d99a6" />
          <ellipse cx="12" cy="16" rx="4" ry="7" fill="#f4f7fa" />
          <ellipse cx="12" cy="16" rx="1.8" ry="3.4" fill="#243044" />
        </>
      )}
      {name === 'Value Added Products' && (
        <>
          <ellipse cx="16" cy="16" rx="11" ry="11" fill="#c5ced8" stroke="#8b97a4" strokeWidth="0.8" />
          <ellipse cx="16" cy="16" rx="7.2" ry="7.2" fill="#eef3f7" />
          <ellipse cx="16" cy="16" rx="3" ry="3" fill="#6e7c8a" />
          <path d="M14.3 4.5h3.4V27.5h-3.4z" fill="#d71920" />
        </>
      )}
    </svg>
  );
}

function IndiaFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 12" className={className} aria-hidden="true">
      <rect width="18" height="4" fill="#FF9933" />
      <rect y="4" width="18" height="4" fill="#FFFFFF" />
      <rect y="8" width="18" height="4" fill="#138808" />
      <circle cx="9" cy="6" r="1.55" fill="none" stroke="#000080" strokeWidth="0.35" />
      <circle cx="9" cy="6" r="0.28" fill="#000080" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() =>
    new URLSearchParams(window.location.search).get('reason') === 'deactivated'
      ? 'Your account has been deactivated. Please contact your admin.'
      : '',
  );
  const [devOtp, setDevOtp] = useState('');

  const handleRequestOtp = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.requestOtp(phone);
      const data = res.data;
      if (data.data?.dev_otp) setDevOtp(data.data.dev_otp);
      setStep('otp');
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (err.message === 'Network Error'
          ? `Unable to reach backend service (${BACKEND_URL}). Please verify backend server is running.`
          : err.message || 'Unable to connect to backend service.');
      setError(msg);
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
      const res = await authApi.verifyOtp(phone, otp);
      const data = res.data;
      login(data.data.token, data.data.employee);
      navigate('/home', { replace: true });
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (err.message === 'Network Error'
          ? `Unable to reach backend service (${BACKEND_URL}). Please verify backend server is running.`
          : err.message || 'Verification failed. Please check backend service.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-gradient-to-br from-rose-50/70 via-slate-50 to-blue-50/70 p-4 sm:p-6 lg:p-10 flex items-center justify-center relative overflow-hidden font-sans"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* Animated Subtle Dot Matrix Texture */}
      <div className="pointer-events-none absolute inset-0 login-dot-texture z-0" aria-hidden="true" />

      {/* Ambient Floating Glow Orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-rose-200/40 blur-3xl login-orb-1 z-0" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-200/35 blur-3xl login-orb-2 z-0" aria-hidden="true" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[550px] rounded-full bg-amber-100/35 blur-3xl login-orb-3 z-0" aria-hidden="true" />

      {/* Subtle Engineering Accent Crosshairs in corners */}
      <div className="pointer-events-none absolute top-8 left-8 text-slate-400/40 font-mono text-sm select-none hidden sm:block z-0" aria-hidden="true">+</div>
      <div className="pointer-events-none absolute top-8 right-8 text-slate-400/40 font-mono text-sm select-none hidden sm:block z-0" aria-hidden="true">+</div>
      <div className="pointer-events-none absolute bottom-8 left-8 text-slate-400/40 font-mono text-sm select-none hidden sm:block z-0" aria-hidden="true">+</div>
      <div className="pointer-events-none absolute bottom-8 right-8 text-slate-400/40 font-mono text-sm select-none hidden sm:block z-0" aria-hidden="true">+</div>

      {/* Centered Professional Modal Container */}
      <div className="relative w-full max-w-7xl rounded-[32px] overflow-hidden bg-white shadow-[0_25px_80px_-15px_rgba(0,0,0,0.12)] border border-slate-200/90 grid grid-cols-1 lg:grid-cols-12 z-10 backdrop-blur-xs">
        
        {/* 4. Left-Side Content: Branding, Title, Categories & Stats */}
        <aside className="lg:col-span-7 bg-[#fafbfc] border-b lg:border-b-0 lg:border-r border-slate-200/80 p-8 sm:p-10 lg:p-12 xl:p-14 flex flex-col justify-between">
          <div>
            {/* Complete Company Logo */}
            <div className="mb-8">
              <img
                src="/enlight-metals-logo.png"
                alt="Enlight Metals Logo"
                className="h-12 sm:h-18 w-auto object-contain object-left"
              />
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl lg:text-[2rem] font-black leading-snug tracking-tight text-slate-900 mb-8">
              India’s Trusted Industrial Metals Sourcing &amp; Supply Partner
            </h2>

            {/* Product Category Selector */}
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1f4bb8] mb-3.5 flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#d71920]" />
                Product Category
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRODUCT_CATEGORIES.map((item) => (
                  <div
                    key={item}
                    className="group relative flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white/80 hover:bg-white text-slate-800 hover:text-slate-950 border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 select-none"
                  >
                    <div className="p-1.5 rounded-xl bg-slate-100/80 group-hover:bg-red-50 transition-colors shrink-0">
                      <CategoryMark name={item} />
                    </div>
                    <span
                      className="truncate leading-tight font-bold text-sm tracking-tight text-slate-900 group-hover:text-slate-950"
                      style={{ fontFamily: "'Libre Baskerville', Georgia, serif", fontWeight: 700 }}
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Brand Key Stats */}
            <div className="pt-6 border-t border-slate-200/80 grid grid-cols-2 gap-x-6 gap-y-5">
              {BRAND_STATS.map(({ value, label }) => (
                <div key={label} className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {value}
                  </p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ISO Certification Badge */}
          <div className="mt-8 pt-4 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
            
            <span className="text-[11px] font-semibold text-[#1f4bb8] bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
              B2B Industrial
            </span>
          </div>
        </aside>

        {/* Right Column: Dedicated Login Panel with Official Enlight Metals Logo Blue (#2a469d) */}
        <main
          className="lg:col-span-5 relative p-8 sm:p-10 lg:p-12 xl:p-14 flex flex-col justify-between overflow-hidden shadow-2xl"
          style={{
            backgroundColor: '#2a469d',
            background: 'linear-gradient(160deg, #2a469d 0%, #233b86 100%)',
          }}
        >
          {/* Subtle Ambient Depth */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-black/15 blur-2xl" aria-hidden="true" />

          <div className="my-auto w-full py-4 sm:py-6 relative z-10">
            {/* Header: Enlight Sigma (Styled exactly as in Image 2) */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center px-5 py-2 rounded-2xl bg-white shadow-lg shadow-blue-950/25 border border-white/60 mb-2.5 select-none">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  Enlight <span className="text-[#1f4bb8]">Sigma</span>
                </h1>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-blue-100/90 uppercase tracking-wider mt-1">
                Enlight Metals Private Limited
              </p>
            </div>

            {/* Login Flow */}
            {step === 'phone' ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2.5">
                    WhatsApp Phone Number
                  </label>
                  {/* Indian Flag before mobile number field */}
                  <div className="flex rounded-2xl overflow-hidden border border-white/40 bg-white shadow-lg shadow-blue-950/20 focus-within:border-white focus-within:ring-4 focus-within:ring-white/30 transition-all">
                    <span className="inline-flex items-center gap-2 px-4 bg-slate-100/95 border-r border-slate-200 text-slate-800 text-sm font-bold select-none">
                      <IndiaFlag className="h-4 w-5 rounded-[2px] border border-slate-200 shadow-xs" />
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                      autoFocus
                      className="flex-1 px-4 py-3.5 sm:py-4 text-base text-slate-900 font-mono font-medium placeholder-slate-400 bg-white outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleRequestOtp()}
                    />
                  </div>
                  <p className="text-xs text-blue-100/90 mt-2 font-medium">
                    We'll send a 6-digit secure login code to your WhatsApp.
                  </p>
                </div>

                {error && (
                  <div className="p-3.5 bg-white/95 border border-rose-200 rounded-xl text-rose-700 text-xs sm:text-sm font-medium shadow-sm">
                    {error}
                  </div>
                )}

                {/* OTP Text: Strictly "Get OTP on WhatsApp" */}
                <button
                  onClick={handleRequestOtp}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#d71920] to-[#f43f5e] hover:from-[#b8141a] hover:to-[#e11d48] text-white font-bold py-4 rounded-2xl shadow-xl shadow-red-950/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base cursor-pointer active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Get OTP on WhatsApp</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="block text-xs font-bold text-white uppercase tracking-wider">
                      Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('phone');
                        setError('');
                        setOtp('');
                      }}
                      className="text-xs sm:text-sm font-semibold text-white hover:text-sky-100 underline flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft size={14} />
                      <span>Change number</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="• • • • • •"
                    maxLength={6}
                    autoFocus
                    className="w-full px-4 py-4 bg-white border border-white/40 rounded-2xl text-center text-2xl font-bold font-mono tracking-[0.4em] text-slate-900 shadow-lg shadow-blue-950/20 focus:bg-white focus:outline-none focus:ring-4 focus:ring-white/40 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  />

                  <p className="text-xs text-blue-100/90 mt-2.5 text-center font-medium">
                    Enter the 6-digit code sent to{' '}
                    <strong className="text-white font-mono">+91 {phone}</strong>
                  </p>

                  {devOtp && (
                    <div className="mt-3.5 p-3.5 bg-white/95 border border-white rounded-xl text-slate-900 text-xs sm:text-sm flex items-center justify-between shadow-sm">
                      <span className="font-semibold text-slate-700">Testing Mode Active:</span>
                      <span className="font-mono text-sm sm:text-base font-bold bg-blue-100 px-2.5 py-0.5 rounded-md text-blue-950">
                        {devOtp}
                      </span>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3.5 bg-white/95 border border-rose-200 rounded-xl text-rose-700 text-xs sm:text-sm font-medium shadow-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length < 6}
                  className="w-full bg-gradient-to-r from-[#d71920] to-[#f43f5e] hover:from-[#b8141a] hover:to-[#e11d48] text-white font-bold py-4 rounded-2xl shadow-xl shadow-red-950/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base cursor-pointer active:scale-[0.99]"
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
          </div>

          {/* Secure Footnote */}
          <div className="pt-6 border-t border-white/20 flex items-center justify-between text-xs text-blue-100/80 font-medium mt-auto relative z-10">
            <span className="text-blue-100/90 font-semibold">Enterprise Portal</span>
          </div>
        </main>
      </div>
    </div>
  );
}
