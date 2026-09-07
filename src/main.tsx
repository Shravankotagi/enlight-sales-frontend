import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000, // 30s cache prevents refetching on every tab switch while Realtime handles live updates
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false, // Prevent bursts of network queries on window focus (Realtime keeps data fresh)
      refetchOnReconnect: true,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { fontFamily: 'Inter, sans-serif', fontSize: '14px' },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
