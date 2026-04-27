import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

try { process.loadEnvFile('.env'); } catch(e) {}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
};

// ── EasyPost tracking (all carriers) ───────────────────────────────────────
const STATUS_MAP = {
  delivered:           'delivered',
  out_for_delivery:    'out_for_delivery',
  available_for_pickup:'out_for_delivery',
  in_transit:          'in_transit',
  pre_transit:         'pre_shipment',
  return_to_sender:    'exception',
  failure:             'exception',
  cancelled:           'exception',
  error:               'exception',
  unknown:             'in_transit',
};

const CARRIER_KEY_MAP = {
  usps: 'usps', unitedstatespostalservice: 'usps',
  fedex: 'fedex', federalexpress: 'fedex',
  ups: 'ups', unitedparcelservice: 'ups',
  dhl: 'dhl', dhlexpress: 'dhl', dhlecommerce: 'dhl',
};

async function trackEasyPost(trackingCode) {
  const auth = Buffer.from(process.env.EASYPOST_API_KEY + ':').toString('base64');
  const r = await fetch('https://api.easypost.com/v2/trackers', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tracker: { tracking_code: trackingCode } }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Tracking lookup failed (${r.status}). Check your tracking number and try again.`);
  }
  const d = await r.json();

  const statusCategory = STATUS_MAP[d.status] || 'in_transit';
  const carrierRaw = (d.carrier || '').toLowerCase().replace(/[\s_-]/g, '');
  const carrierKey = CARRIER_KEY_MAP[carrierRaw] || carrierRaw;

  const events = (d.tracking_details || []).map(e => ({
    timestamp: e.datetime ? new Date(e.datetime).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '',
    description: e.message || '',
    location: [e.tracking_location?.city, e.tracking_location?.state, e.tracking_location?.zip]
      .filter(Boolean).join(', '),
  }));

  const latestMsg = d.tracking_details?.[0]?.message;
  const summary = latestMsg || (d.status || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return {
    carrier: carrierKey,
    trackingNumber: d.tracking_code || trackingCode,
    status: statusCategory,
    statusCategory,
    summary,
    estimatedDelivery: d.est_delivery_date ? d.est_delivery_date.split('T')[0] : null,
    deliveredAt: statusCategory === 'delivered' ? (d.tracking_details?.[0]?.datetime || null) : null,
    origin: null,
    destination: null,
    service: d.carrier_detail?.service_code || null,
    events,
  };
}

// ── API route handler ───────────────────────────────────────────────────────
async function handleApiTrack(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const number = url.searchParams.get('number');

  if (!number) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Missing tracking number' }));
  }

  try {
    const result = await trackEasyPost(number);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[/api/track]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ── HTTP server ─────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  if (urlPath === '/api/track') return handleApiTrack(req, res);

  let filePath = urlPath === '/' ? '/index.html' : urlPath;

  const safePath = normalize(filePath).replace(/^(\.\.[\\/])+/, '');
  const absPath = join(__dirname, safePath);

  const tryServe = async (p) => {
    const data = await readFile(p);
    const ext  = extname(p).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/html; charset=utf-8' });
    res.end(data);
    return true;
  };

  try { await tryServe(absPath); return; } catch {}
  try { await tryServe(absPath + '.html'); return; } catch {}
  try { await tryServe(join(absPath, 'index.html')); return; } catch {}

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`\n  TrackHive dev server running at http://localhost:${PORT}\n`);
});
