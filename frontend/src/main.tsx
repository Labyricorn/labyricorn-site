import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { initializeCsrf } from './services/api'

// Create QueryClient instance with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3, // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      staleTime: 1000 * 60, // Data is fresh for 1 minute
      refetchOnWindowFocus: false, // Don't refetch on window focus
    },
    mutations: {
      retry: 1, // Retry failed mutations once
    },
  },
});

// Initialize CSRF token on app startup
initializeCsrf().catch((error) => {
  console.error('Failed to initialize CSRF token:', error);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
