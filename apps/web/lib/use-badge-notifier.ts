import { useEffect } from 'react';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNotificationStore } from './notification-store';

interface BadgeRow {
  id: string;
  name: string;
  earned_at: string | null;
}

/**
 * Pure factory — creates a badge notifier subscription against a QueryClient.
 * Extracted from the hook so it can be tested without a React environment.
 *
 * Seeds prevEarnedIds from existing cache to avoid toasting badges earned in
 * prior sessions on mount.
 *
 * Returns the unsubscribe function.
 */
export function createBadgeNotifier(
  qc: QueryClient,
  onNewBadge: (name: string) => void,
): () => void {
  const prevEarnedIds = new Set<string>();

  // Seed from badges already in cache (earned before this session)
  const existing = (qc.getQueryData(['badges']) as { data: BadgeRow[] } | undefined)?.data ?? [];
  existing.filter((b) => b.earned_at !== null).forEach((b) => prevEarnedIds.add(b.id));

  const unsubscribe = qc.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryKey[0] !== 'badges') return;

    const badges = (event.query.state.data as { data: BadgeRow[] } | undefined)?.data ?? [];
    badges
      .filter((b) => b.earned_at !== null)
      .forEach((b) => {
        if (!prevEarnedIds.has(b.id)) {
          prevEarnedIds.add(b.id);
          onNewBadge(b.name);
        }
      });
  });

  return unsubscribe;
}

/**
 * Watches the ['badges'] query cache and fires a sonner toast for each newly-earned badge.
 * Mount once in AppShell via <BadgeNotifier /> — not per-page.
 */
export function useBadgeNotifier() {
  const qc = useQueryClient();
  useEffect(
    () =>
      createBadgeNotifier(qc, (name) => {
        toast.success(`Badge unlocked: ${name} 🏅`);
        useNotificationStore.getState().addNotification('badge_unlock', `Badge unlocked: ${name} 🏅`);
      }),
    [qc],
  );
}
