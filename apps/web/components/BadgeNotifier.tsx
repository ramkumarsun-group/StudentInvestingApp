'use client';

import { useBadgeNotifier } from '@/lib/use-badge-notifier';

/**
 * Headless client component that mounts useBadgeNotifier once in the app shell.
 * Renders nothing — side-effects only.
 */
export function BadgeNotifier() {
  useBadgeNotifier();
  return null;
}
