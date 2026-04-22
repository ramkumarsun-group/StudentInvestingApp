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
    // P-16: assert the exact CSS variable name AND the variable is defined in globals.css
    // (guards against misspelling —color-primry vs --color-primary)
    expect(html).toContain('var(--color-primary)');
    // Structural guard: globals.css must define --color-primary (not just referenced in JSX)
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf-8');
    expect(css).toContain('--color-primary:');
  });

  it('applies className prop', () => {
    const html = renderToStaticMarkup(<AuthHeroPanel className="hidden lg:flex" />);
    expect(html).toContain('hidden lg:flex');
  });

  it('uses primary semantic token class on portfolio value', () => {
    const html = renderToStaticMarkup(<AuthHeroPanel />);
    // Uses semantic token class text-primary rather than hard-coded hex
    expect(html).toContain('text-primary');
  });
});
