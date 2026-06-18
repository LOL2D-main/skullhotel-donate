/**
 * Shared in-memory transaction store.
 * 
 * On Vercel Serverless, module-level variables persist as long as
 * the warm instance is alive (typically 5-15 minutes of inactivity).
 * Webhook and polling requests hitting the same instance will share this Map.
 * 
 * This is NOT a database — it's a fast cache layer.
 * The SePay API list endpoint is always used as the authoritative fallback.
 */

// Map<transactionId, { content, amount, timestamp, raw }>
const webhookTransactions = new Map();

// Auto-cleanup: remove entries older than 10 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000; // check every 1 minute
const MAX_AGE_MS = 10 * 60 * 1000;  // 10 minutes

let cleanupTimer = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of webhookTransactions) {
      if (now - entry.timestamp > MAX_AGE_MS) {
        webhookTransactions.delete(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't let the timer keep the process alive
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Store a transaction received via webhook.
 */
function storeTransaction(tx) {
  webhookTransactions.set(tx.id, {
    content: (tx.content || '').toLowerCase().replace(/\s+/g, ''),
    contentRaw: tx.content || '',
    amount: parseFloat(tx.transferAmount) || 0,
    timestamp: Date.now(),
    raw: tx,
  });
  startCleanup();
}

/**
 * Find a matching transaction in the webhook cache.
 * @param {string} uniqueCode - The 6-char unique code to match
 * @param {number} expectedAmount - Minimum amount expected
 * @returns {object|null} The matching transaction or null
 */
function findTransaction(uniqueCode, expectedAmount) {
  const code = uniqueCode.toLowerCase();
  for (const [, entry] of webhookTransactions) {
    if (entry.content.includes(code) && entry.amount >= expectedAmount) {
      return entry.raw;
    }
  }
  return null;
}

export { webhookTransactions, storeTransaction, findTransaction };
