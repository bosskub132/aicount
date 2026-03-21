export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
        {children}
      </div>
    </main>
  );
}
