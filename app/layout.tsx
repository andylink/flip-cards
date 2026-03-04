import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'FlipForge',
  description: 'Design and play custom learning flip-cards.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
            <Link className="text-lg font-semibold" href="/">
              FlipForge
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link className="focus-ring rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800" href="/">
                Dashboard
              </Link>
              <Link
                className="focus-ring rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                href="/sets/new"
              >
                New Set
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
