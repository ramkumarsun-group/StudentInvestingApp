import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AuthLayout from './layout';

describe('AuthLayout', () => {
  it('renders children', () => {
    const html = renderToStaticMarkup(
      <AuthLayout><div id="form-child">Login Form</div></AuthLayout>
    );
    expect(html).toContain('Login Form');
    expect(html).toContain('form-child');
  });

  it('renders two-column grid with lg:grid-cols-2', () => {
    const html = renderToStaticMarkup(
      <AuthLayout><span>form</span></AuthLayout>
    );
    expect(html).toContain('lg:grid-cols-2');
  });

  it('hero panel hidden on mobile via hidden lg:flex', () => {
    const html = renderToStaticMarkup(
      <AuthLayout><span>form</span></AuthLayout>
    );
    expect(html).toContain('hidden lg:flex');
  });

  it('form column has correct centering classes', () => {
    const html = renderToStaticMarkup(
      <AuthLayout><span>form</span></AuthLayout>
    );
    expect(html).toContain('flex flex-col items-center justify-center');
  });

  it('uses surface background token class', () => {
    const html = renderToStaticMarkup(
      <AuthLayout><span>form</span></AuthLayout>
    );
    // Uses semantic token class bg-surface rather than hard-coded hex #121416
    expect(html).toContain('bg-surface');
  });
});
