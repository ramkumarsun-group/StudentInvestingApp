import { AuthHeroPanel } from '@/components/auth/AuthHeroPanel';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface grid lg:grid-cols-2">
      {/* Hero panel — desktop only, hidden on mobile */}
      <AuthHeroPanel className="hidden lg:flex" />

      {/* Form column — full width on mobile, right column on desktop */}
      <div className="flex flex-col items-center justify-center p-8 bg-surface">
        {children}
      </div>
    </div>
  );
}
