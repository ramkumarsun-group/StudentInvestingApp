import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DpaPage from './page';

describe('DpaPage', () => {
  it('renders without crashing', () => {
    expect(() => renderToStaticMarkup(<DpaPage />)).not.toThrow();
  });

  it('contains "Data Processing Agreement" heading', () => {
    const html = renderToStaticMarkup(<DpaPage />);
    expect(html).toContain('Data Processing Agreement');
  });

  it('contains "FERPA" text', () => {
    const html = renderToStaticMarkup(<DpaPage />);
    expect(html).toContain('FERPA');
  });
});
