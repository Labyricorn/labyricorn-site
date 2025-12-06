import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { loginAsync, isLoggingIn, loginError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      await loginAsync({ username, password });
      // Redirect to home page on successful login
      navigate('/');
    } catch (error) {
      // Error is already handled by useAuth hook
      // loginError will be updated automatically
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-4xl font-bold text-purple-400 text-center">
        Login
      </h1>
      <div className="p-8 bg-slate-900/50 border border-purple-500/20 rounded-lg backdrop-blur-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {loginError && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-md text-red-400 text-sm">
              {loginError.message}
            </div>
          )}
          
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-cyan-400 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoggingIn}
              required
              className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your username"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-cyan-400 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoggingIn}
              required
              className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your password"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
