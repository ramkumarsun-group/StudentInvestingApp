import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthHeroPanel } from './AuthHeroPanel';

describe('AuthHeroPanel', () => {
  it('renders StockPlay logo wordmark', () => {
    const html = renderToStaticMarkup(<AuthHeroPanel />);
    expect(html).toContain('StockPlay');
    expect(html).toContain('SP');
  });

  it('renders headline copy', () => {
    const html = renderToStaticMarkup(<AuthHeroPanel />);
    expect(html).toContain('Invest smarter');
    expect(html).toContain('Learn by doing');
  });

  it('renders sub-copy', () => {
    const html = renderToStaticMarkup(<AuthHeroPanel />);
    expect(html).toContain('$100,000');
    expect(html).toContain('No risk, real skills');
  });

  it('renders trust badge with FERPA text', () => {
    const html = renderToStaticMarkup(<AuthHeroPanel />);
    expect(html).toContain('FERPA Compliant');
    expect(html).toContain('Free to start');
  });

  it('renders sparkline SVG visual element', () => {
    const html = renderToStaticMarkup(<AuthHeroPanel />);
    expect(html).toContain('<svg');
    expect(html).toContain('stroke="#acc7ff"');
  });

  it('applies className prop', () => {
    const html = renderToStaticMarkup(<AuthHeroPanel className="hidden lg:flex" />);
    expect(html).toContain('hidden lg:flex');
  });

  it('uses primary design token color on portfolio value', () => {
    const html = renderToStaticMarkup(<AuthHeroPanel />);
    expect(html).toContain('#acc7ff');
  });
});
