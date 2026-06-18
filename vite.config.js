import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// In-memory store for local dev (mirrors api/_transactionStore.js)
const devWebhookTransactions = new Map();

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      react(),
      {
        name: 'local-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {

            // ============================================================
            // POST /api/sepay-webhook — Webhook receiver (local dev)
            // ============================================================
            if (req.url && req.url.startsWith('/api/sepay-webhook') && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk.toString(); });
              req.on('end', () => {
                try {
                  const data = JSON.parse(body);
                  if (data && data.id && data.transferType === 'in' && parseFloat(data.transferAmount) > 0) {
                    devWebhookTransactions.set(data.id, {
                      content: (data.content || '').toLowerCase().replace(/\s+/g, ''),
                      amount: parseFloat(data.transferAmount) || 0,
                      timestamp: Date.now(),
                      raw: data,
                    });
                    console.log(`[Dev Webhook] Stored #${data.id}: ${data.transferAmount}đ`);
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                } catch (e) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: e.message }));
                }
              });
              return;
            }

            // ============================================================
            // GET /api/check-transaction — Payment check (local dev)
            // ============================================================
            if (req.url && req.url.startsWith('/api/check-transaction')) {
              const url = new URL(req.url, `http://${req.headers.host}`)
              const uniqueCode = url.searchParams.get('uniqueCode')
              const amount = parseFloat(url.searchParams.get('amount')) || 0
              const token = env.SEPAY_API_TOKEN

              if (!token || token === 'your_sepay_api_token_here') {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, mock: true }))
                return
              }

              if (!uniqueCode || uniqueCode.length < 4) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, error: 'Missing uniqueCode' }))
                return
              }

              // Layer 1: Check webhook cache
              const codeLower = uniqueCode.toLowerCase();
              for (const [, entry] of devWebhookTransactions) {
                if (entry.content.includes(codeLower) && entry.amount >= amount) {
                  console.log(`[Dev Check] Found in webhook cache`);
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ success: true, source: 'webhook', transaction: entry.raw }))
                  return
                }
              }

              // Layer 2: SePay API fallback
              try {
                const response = await fetch('https://my.sepay.vn/userapi/transactions/list?limit=50', {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                })

                if (!response.ok) {
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ success: false, error: 'SePay API error' }))
                  return
                }

                const data = await response.json()

                if (data && data.transactions) {
                  const matchedTx = data.transactions.find(t => {
                    const amountIn = parseFloat(t.amount_in) || 0;
                    if (amountIn < amount) return false;
                    const rawContent = (t.transaction_content || '').toLowerCase();
                    if (rawContent.includes(codeLower)) return true;
                    const contentClean = rawContent.replace(/[^a-z0-9]/g, '');
                    if (contentClean.includes(codeLower)) return true;
                    return false;
                  });

                  if (matchedTx) {
                    res.writeHead(200, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ success: true, source: 'api', transaction: matchedTx }))
                    return
                  }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false }))
              } catch (error) {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, error: error.message }))
              }
              return
            }

            // ============================================================
            // GET /api/recent-transactions (local dev)
            // ============================================================
            if (req.url && req.url.startsWith('/api/recent-transactions')) {
              const token = env.SEPAY_API_TOKEN
              if (!token || token === 'your_sepay_api_token_here') {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, transactions: [] }))
                return
              }
              try {
                const response = await fetch('https://my.sepay.vn/userapi/transactions/list?limit=15', {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                })
                const data = await response.json()
                if (data.status === 200 && data.transactions) {
                  const validTransactions = data.transactions.filter(t => parseFloat(t.amount_in) > 0);
                  const formatted = validTransactions.map(t => {
                    let name = "Một nhà tài trợ";
                    const content = t.transaction_content || '';
                    
                    const skullhotelMatch = content.match(/donate\s+skullhotel\s+(.+)/i);
                    if (skullhotelMatch && skullhotelMatch[1]) {
                      name = skullhotelMatch[1].replace(/\s+[A-Z0-9]{4,6}$/i, '').trim();
                    }
                    
                    if (name === "Một nhà tài trợ") {
                      const oldMatch = content.match(/(?:APPMB\d+\s+\d+\s+)?([A-Za-z\s]+?)(?:\s+chuyen tien|\s+chuyen khoan|\s+donate)/i);
                      if (oldMatch && oldMatch[1]) name = oldMatch[1].trim();
                      else if (content.toUpperCase().includes("DONATE SKULLHOTEL")) {
                        const parts = content.toUpperCase().split("DONATE SKULLHOTEL");
                        if (parts[1] && parts[1].trim().length > 2) name = parts[1].trim();
                        else if (parts[0]) name = parts[0].replace(/^SH\s+[A-Z0-9]+\s*/i, '').trim();
                      } else {
                        const words = content.split(' ').filter(w => w.length > 1).slice(0, 3).join(' ').replace(/[^a-zA-Z0-9\s]/g, '');
                        if (words.length > 3) name = words;
                      }
                    }
                    if (name.length > 20) name = name.substring(0, 20) + '...';
                    if (name.trim().length < 2) name = "Một nhà tài trợ";
                    
                    return { id: t.id, amount: parseFloat(t.amount_in), date: t.transaction_date, name: name }
                  });
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ success: true, transactions: formatted.slice(0, 10) }))
                  return
                }
              } catch (e) {
                // ignore
              }
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, transactions: [] }))
              return
            }

            next()
          })
        }
      }
    ]
  }
})
