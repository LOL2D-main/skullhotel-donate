import { storeTransaction } from './_transactionStore.js';

/**
 * SePay Webhook Endpoint
 * 
 * SePay sends a POST request here immediately when a new transaction occurs.
 * Payload format:
 * {
 *   "id": 92704,
 *   "gateway": "MBBank",
 *   "transactionDate": "2024-07-02 11:08:33",
 *   "accountNumber": "0792362190",
 *   "code": "",
 *   "content": "DH ABCDEF donate SkullHotel NGUYEN NHAT THIEN",
 *   "transferType": "in",
 *   "transferAmount": 50000,
 *   "accumulated": 1050000,
 *   "referenceCode": "FT24012345678"
 * }
 * 
 * Must respond with HTTP 200 + { success: true } within 30 seconds.
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const data = req.body;

    // Validate: must have an id and be an incoming transfer
    if (!data || !data.id) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    // Only process incoming transfers
    if (data.transferType === 'in' && parseFloat(data.transferAmount) > 0) {
      storeTransaction(data);
      console.log(`[Webhook] Stored transaction #${data.id}: ${data.transferAmount}đ - "${data.content}"`);
    }

    // SePay requires this exact response format
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error processing:', error);
    // Still return 200 to prevent SePay from retrying endlessly
    return res.status(200).json({ success: true });
  }
}
