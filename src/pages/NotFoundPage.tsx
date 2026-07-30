import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  useEffect(() => {
    document.title = '404 — Enlight Sales OS';
  }, []);

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="text-center">
        <p className="text-8xl font-black text-gray-200 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors mx-auto"
        >
          <Home size={18} /> ← Go back to Home
        </button>
      </div>
    </div>
  );
}
