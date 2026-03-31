import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#121416]">
      {/* Sidebar — visible lg+ only */}
      <Sidebar className="hidden lg:flex" />

      {/* Main content — offset by sidebar on lg+.
          P7: on mobile the bottom padding must clear the BottomNav height
          (4rem) plus any iOS safe-area inset below it. */}
      <main className="lg:ml-[220px] pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 min-h-screen">
        {children}
      </main>

      {/* Bottom nav — visible <lg only */}
      <BottomNav className="flex lg:hidden" />
    </div>
  );
}
