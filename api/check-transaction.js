import { findTransaction } from './_transactionStore.js';

/**
 * Check Transaction Endpoint
 * 
 * Called by the frontend every 4 seconds while waiting for payment.
 * Uses a 2-layer lookup:
 *   1. Check in-memory cache (populated by webhook — instant)
 *   2. Fallback: query SePay API transaction list (authoritative but slower)
 * 
 * Query params:
 *   - uniqueCode: The 6-char code embedded in the transfer content
 *   - amount: Expected minimum transfer amount
 */
export default async function handler(req, res) {
  // CORS + no-cache headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const uniqueCode = url.searchParams.get('uniqueCode');
  const amount = parseFloat(url.searchParams.get('amount')) || 0;

  if (!uniqueCode || uniqueCode.length < 4) {
    return res.status(400).json({ success: false, error: 'Missing or invalid uniqueCode' });
  }

  const token = process.env.SEPAY_API_TOKEN || process.env.VITE_SEPAY_API_TOKEN;

  if (!token || token === 'your_sepay_api_token_here') {
    // Dev/mock mode: simulate success after a delay
    return res.status(200).json({ success: false, mock: true });
  }

  // ============================================================
  // LAYER 1: Check webhook cache (instant — sub-millisecond)
  // ============================================================
  const cachedTx = findTransaction(uniqueCode, amount);
  if (cachedTx) {
    console.log(`[Check] Found in webhook cache: #${cachedTx.id}`);
    return res.status(200).json({
      success: true,
      source: 'webhook',
      transaction: cachedTx,
    });
  }

  // ============================================================
  // LAYER 2: Fallback — query SePay API (slower, but authoritative)
  // ============================================================
  try {
    const response = await fetch('https://my.sepay.vn/userapi/transactions/list?limit=50', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[Check] SePay API returned ${response.status}`);
      return res.status(200).json({ success: false, error: 'SePay API error' });
    }

    const data = await response.json();
    
    if (!data || !data.transactions || !Array.isArray(data.transactions)) {
      return res.status(200).json({ success: false });
    }

    const codeLower = uniqueCode.toLowerCase();

    // Find a matching transaction
    const matchedTx = data.transactions.find(t => {
      // Must be incoming money
      const amountIn = parseFloat(t.amount_in) || 0;
      if (amountIn < amount) return false;

      // Normalize the transaction content for matching
      const rawContent = (t.transaction_content || '').toLowerCase();
      
      // Strategy 1: Direct match — uniqueCode appears in the content
      if (rawContent.includes(codeLower)) return true;

      // Strategy 2: Remove all spaces and special chars, then check
      const contentClean = rawContent.replace(/[^a-z0-9]/g, '');
      if (contentClean.includes(codeLower)) return true;

      return false;
    });

    if (matchedTx) {
      console.log(`[Check] Found via SePay API: #${matchedTx.id}`);
      return res.status(200).json({
        success: true,
        source: 'api',
        transaction: matchedTx,
      });
    }

    return res.status(200).json({ success: false });
  } catch (error) {
    console.error('[Check] Error:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}
