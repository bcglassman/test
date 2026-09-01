/**
 * A stand-in for Directus, for local development and screenshots.
 *
 * Serves the handful of read endpoints the site uses from fixtures. It is not a
 * Directus emulator and is never deployed — it exists so the site can be run
 * and reviewed without the full stack up.
 *
 *   node mock/server.mjs &
 *   DIRECTUS_URL=http://127.0.0.1:8055 npm run build
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const PORT = Number(process.env.MOCK_PORT ?? 8055);
const data = JSON.parse(await readFile(new URL('./fixtures.json', import.meta.url)));

const matchers = {
  activities: (items, params) => {
    let out = items;
    const slug = params.get('filter[slug][_eq]');
    if (slug) out = out.filter((a) => a.slug === slug);
    const category = params.get('filter[category][slug][_eq]');
    if (category) out = out.filter((a) => a.category?.slug === category);
    const region = params.get('filter[venue][region][_eq]');
    if (region) out = out.filter((a) => a.venue?.region === region);
    const solo = params.get('filter[solo_friendly][_in]');
    if (solo) out = out.filter((a) => solo.split(',').includes(a.solo_friendly));
    const pressure = params.get('filter[pressure_level][_eq]');
    if (pressure) out = out.filter((a) => a.pressure_level === pressure);
    const cost = params.get('filter[cost_band][_eq]');
    if (cost) out = out.filter((a) => a.cost_band === cost);
    return out;
  },
  sessions: (items, params) => {
    const activity = params.get('filter[activity][_eq]');
    return activity ? items.filter((s) => s.activity === activity) : items;
  },
  activity_interest_stats: (items, params) => {
    const activity = params.get('filter[activity][_eq]');
    return activity ? items.filter((s) => s.activity === activity) : items;
  },
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const collection = url.pathname.replace('/items/', '');

  if (url.pathname === '/server/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  const items = data[collection];
  if (!items) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ errors: [{ message: `no fixture for ${collection}` }] }));
  }

  const filtered = (matchers[collection] ?? ((x) => x))(items, url.searchParams);
  const limit = Number(url.searchParams.get('limit') ?? 100);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data: filtered.slice(0, limit) }));
}).listen(PORT, '127.0.0.1', () => {
  console.log(`mock directus on http://127.0.0.1:${PORT}`);
});
