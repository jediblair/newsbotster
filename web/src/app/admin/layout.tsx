export const dynamic = 'force-dynamic';
import { redirect }   from 'next/navigation';
import { getSession } from '@/lib/auth';
import Link           from 'next/link';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session)              redirect('/login');
  if (session.role !== 'admin') redirect('/');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin nav bar */}
      <nav className="bg-ink text-white px-6 py-3 flex items-center gap-6 text-sm">
        <span className="font-bold tracking-widest uppercase">Admin</span>
        <Link href="/admin"             className="hover:text-gray-300">Dashboard</Link>
        <Link href="/admin/stats"       className="hover:text-gray-300">Statistics</Link>
        <Link href="/admin/sources"     className="hover:text-gray-300">Sources</Link>
        <Link href="/admin/crawlers"    className="hover:text-gray-300">Crawlers</Link>
        <Link href="/admin/users"       className="hover:text-gray-300">Users</Link>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/" className="hover:text-gray-300">← Front page</Link>
          <span className="text-gray-400">{session.email}</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
