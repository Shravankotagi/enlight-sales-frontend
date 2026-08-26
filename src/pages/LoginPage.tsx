import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const defaultBackend = isLocal ? 'http://localhost:3000' : 'https://enlight-sales-backend-production.up.railway.app';
const rawBackend = import.meta.env.VITE_BACKEND_URL || defaultBackend;
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
    if (!phone || phone.length < 10) {
      setError('Enter a valid phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `91${phone.replace(/\D/g, '').slice(-10)}` }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `Backend server error (${res.status})` };
      }
      if (!res.ok) throw new Error(data.error || data.message || `Failed to send OTP (${res.status})`);
      if (data.data?.dev_otp) setDevOtp(data.data.dev_otp);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Unable to connect to backend service. Please check backend server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError('Enter the 6-digit OTP');
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
          otp
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `Backend server error (${res.status})` };
      }
      if (!res.ok) throw new Error(data.error || data.message || `Invalid OTP (${res.status})`);
      login(data.data.token, data.data.employee);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check backend service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Enlight Sales OS</h1>
          <p className="text-slate-500 text-sm mt-1">Enlight Metals Private Limited</p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                WhatsApp Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0
                  border-slate-300 bg-slate-50 text-slate-500 text-sm">
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="9876543210"
                  maxLength={10}
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-r-lg
                    text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleRequestOtp}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium
                hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'Sending OTP...' : 'Send OTP on WhatsApp'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Enter OTP sent to +91 {phone}
              </label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit OTP"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg
                  text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                  tracking-widest text-center text-lg font-mono"
                onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
              />
              {devOtp && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                   <strong>Testing Mode Active</strong> — Your OTP is: <span className="font-mono text-sm font-bold text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded">{devOtp}</span>
                </div>
              )}
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium
                hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'Verifying...' : 'Login'}
            </button>

            <button
              onClick={() => { setStep('phone'); setError(''); setOtp(''); }}
              className="w-full text-slate-500 text-sm hover:text-slate-700">
              ← Change number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
