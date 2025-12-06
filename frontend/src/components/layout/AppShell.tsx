import React from 'react';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-purple-500/20">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-purple-400">Labyricorn</h1>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
