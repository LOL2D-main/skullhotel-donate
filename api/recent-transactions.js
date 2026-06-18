export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.SEPAY_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing API Token in Environment' });
  }

  try {
    const response = await fetch('https://my.sepay.vn/userapi/transactions/list?limit=15', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    const data = await response.json();
    
    if (data.status === 200 && data.transactions) {
      const validTransactions = data.transactions.filter(t => parseFloat(t.amount_in) > 0);
      
      const formatted = validTransactions.map(t => {
        let name = "Một nhà tài trợ";
        const content = t.transaction_content || '';
        
        // New format: "SH ABCDEF donate SkullHotel NGUYEN NHAT THIEN"
        // Extract name after "donate skullhotel" (case-insensitive)
        const skullhotelMatch = content.match(/donate\s+skullhotel\s+(.+)/i);
        if (skullhotelMatch && skullhotelMatch[1]) {
          // Clean up: remove trailing unique codes or bank-added suffixes
          name = skullhotelMatch[1].replace(/\s+[A-Z0-9]{4,6}$/i, '').trim();
        }
        
        // Fallback: old format — name before "donate" or "chuyen tien"
        if (name === "Một nhà tài trợ") {
          const oldMatch = content.match(/(?:APPMB\d+\s+\d+\s+)?([A-Za-z\s]+?)(?:\s+chuyen tien|\s+chuyen khoan|\s+donate)/i);
          if (oldMatch && oldMatch[1]) {
            name = oldMatch[1].trim();
          } else if (content.toUpperCase().includes("DONATE SKULLHOTEL")) {
            const parts = content.toUpperCase().split("DONATE SKULLHOTEL");
            // Try to get name from after "DONATE SKULLHOTEL"
            if (parts[1] && parts[1].trim().length > 2) {
              name = parts[1].trim();
            } else if (parts[0] && parts[0].trim().length > 2) {
              name = parts[0].replace(/^SH\s+[A-Z0-9]+\s*/i, '').trim();
            }
          } else {
            // Last resort: use first 3 meaningful words
            const words = content.split(' ')
              .filter(w => w.length > 1 && !/^(SH|APPMB|FT)\d*/i.test(w))
              .slice(0, 3)
              .join(' ')
              .replace(/[^a-zA-Z0-9\s]/g, '');
            if (words.length > 3) name = words;
          }
        }

        // Limit name length
        if (name.length > 20) name = name.substring(0, 20) + '...';
        // Clean up if name is just spaces or codes
        if (name.trim().length < 2) name = "Một nhà tài trợ";

        return {
          id: t.id,
          amount: parseFloat(t.amount_in),
          date: t.transaction_date,
          name: name
        };
      });
      
      return res.status(200).json({ success: true, transactions: formatted.slice(0, 10) });
    }
    
    return res.status(400).json({ success: false, message: 'Invalid response from SePay', data });

  } catch (error) {
    console.error('Fetch recent transactions error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
