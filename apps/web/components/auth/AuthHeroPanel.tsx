import { cn } from '@/lib/utils';

// P5: stable unique ID avoids SVG gradient collision if the component is ever
// rendered twice in the same document (e.g. tests, Storybook).
const GRADIENT_ID = 'hero-sparkline-grad';

export function AuthHeroPanel({ className }: { className?: string }) {
  return (
    // P1: base includes `flex` so the panel is self-contained; parent passes
    // `hidden lg:flex` to control visibility, which overrides safely.
    <div
      className={cn(
        'flex flex-col items-center justify-center bg-[#1e2022] border-r border-[#2e3035] p-12',
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-12">
        <div className="w-10 h-10 bg-[#acc7ff] rounded-xl flex items-center justify-center font-bold text-[#121416] text-sm">
          SP
        </div>
        <span className="text-xl font-bold text-white">StockPlay</span>
      </div>

      {/* Headline */}
      <h2 className="text-4xl font-bold text-[#e2e2e5] leading-tight mb-4">
        Invest smarter.<br />Learn by doing.
      </h2>

      {/* Sub-copy */}
      <p className="text-lg text-[#c1c6d6] mb-10 max-w-sm">
        Practice with $100,000 in virtual cash. No risk, real skills.
      </p>

      {/* Static sparkline chart illustration */}
      <div className="w-full max-w-sm bg-[#121416] rounded-2xl p-5 mb-10">
        <p className="text-xs text-[#8b909f] mb-1">Portfolio Value</p>
        <p className="text-2xl font-bold text-[#acc7ff] mb-4">$107,340</p>
        <svg viewBox="0 0 280 80" className="w-full" aria-hidden="true">
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#acc7ff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#acc7ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 70 L35 58 L70 62 L105 45 L140 38 L175 30 L210 22 L245 18 L280 10"
            fill="none"
            stroke="#acc7ff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M0 70 L35 58 L70 62 L105 45 L140 38 L175 30 L210 22 L245 18 L280 10 L280 80 L0 80 Z"
            fill={`url(#${GRADIENT_ID})`}
          />
        </svg>
        <p className="text-xs text-[#acc7ff] mt-2">+7.3% all time</p>
      </div>

      {/* Trust badge */}
      <p className="text-sm text-[#8b909f]">
        FERPA Compliant · Free to start · No credit card
      </p>
    </div>
  );
}
