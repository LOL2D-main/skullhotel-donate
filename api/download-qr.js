export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  try {
    const response = await fetch(decodeURIComponent(url));
    if (!response.ok) throw new Error('Failed to fetch image');

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="SkullHotel_Donate_QR.png"');
    res.send(buffer);
  } catch (error) {
    console.error('Download QR error:', error);
    res.status(500).send('Error downloading image');
  }
}
