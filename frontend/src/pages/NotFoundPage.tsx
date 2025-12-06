import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-9xl font-bold text-purple-500 animate-pulse">
          404
        </h1>
        <h2 className="text-3xl font-semibold text-cyan-400">
          Page Not Found
        </h2>
        <p className="text-slate-400 text-lg max-w-md mx-auto">
          The page you're looking for has vanished into the digital void.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          to="/"
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Return Home
        </Link>
      </div>
      <div className="mt-8 p-4 border border-purple-500/20 rounded-lg bg-slate-900/30 backdrop-blur-sm">
        <p className="text-sm text-slate-500 font-mono">
          ERROR_CODE: 0x404_NOT_FOUND
        </p>
      </div>
    </div>
  );
}
