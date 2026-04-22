/**
 * Shared badge sharing utilities extracted from badges/page.tsx.
 * These are exported so they can be unit-tested in isolation.
 */

/**
 * Downloads a badge image using a body-appended anchor (required for Firefox).
 * Defers URL.revokeObjectURL by 100ms to allow the browser to fetch the blob.
 */
export async function downloadBadgeCard(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Shares a badge using the Web Share API.
 * Silently swallows AbortError (user cancelled); logs all other errors.
 */
export async function shareBadge(shareOptions: ShareData): Promise<void> {
  try {
    await navigator.share(shareOptions);
  } catch (err) {
    if ((err as { name?: string })?.name !== 'AbortError') {
      console.error('Badge share failed:', err);
    }
  }
}
