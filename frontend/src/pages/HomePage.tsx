import { useHealthCheck } from '../hooks/useHealthCheck';

export function HomePage() {
  const { data, isLoading, isError, error } = useHealthCheck();

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-purple-400">
        Welcome to Labyricorn
      </h1>
      <p className="text-cyan-400 text-lg">
        A cyberpunk-themed portfolio platform
      </p>
      
      {/* API Health Status Card */}
      <div className="mt-8 p-6 bg-slate-900/50 border border-purple-500/20 rounded-lg backdrop-blur-sm">
        <h2 className="text-2xl font-semibold text-purple-300 mb-4">
          API Status
        </h2>
        
        {isLoading && (
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
            <p className="text-slate-400">Checking API status...</p>
          </div>
        )}
        
        {isError && (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-md">
            <p className="text-red-400 font-semibold mb-1">Connection Error</p>
            <p className="text-red-300 text-sm">{error?.message || 'Unable to connect to the API'}</p>
          </div>
        )}
        
        {data && !isLoading && !isError && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-green-400 font-semibold">API Online</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-3 bg-slate-800/50 rounded border border-purple-500/10">
                <p className="text-slate-400 text-sm">Status</p>
                <p className="text-purple-300 font-mono text-lg">{data.status}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded border border-cyan-500/10">
                <p className="text-slate-400 text-sm">Version</p>
                <p className="text-cyan-300 font-mono text-lg">{data.version}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-900/50 border border-purple-500/20 rounded-lg backdrop-blur-sm">
        <h2 className="text-2xl font-semibold text-purple-300 mb-4">
          Getting Started
        </h2>
        <p className="text-slate-300">
          This is the base setup for the Labyricorn platform. The backend API is running
          and ready to serve requests.
        </p>
      </div>
    </div>
  );
}
