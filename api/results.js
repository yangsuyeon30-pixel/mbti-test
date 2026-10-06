// Upstash REST직결 (SDK 불필요). 환경변수: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// (Vercel KV env: KV_REST_API_URL / KV_REST_API_TOKEN 도 자동 인식)
const BASE = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const KEY = 'mbti_records';

async function store(path, method, body) {
  const res = await fetch(BASE + path, {
    method: method || 'GET',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : body,
  });
  if (!res.ok) throw new Error('store ' + res.status);
  return res.json();
}
async function load() {
  if (!BASE || !TOKEN) throw new Error('no store env');
  const j = await store('/get/' + KEY);
  const v = j.result;
  if (v == null) return [];
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
  return Array.isArray(v) ? v : [];
}
async function save(records) {
  await store('/set/' + KEY, 'POST', JSON.stringify(records));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const records = await load();
      records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return res.status(200).json({ records });
    }
    if (req.method === 'POST') {
      let data = req.body;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
      data = data || {};
      const records = await load();

      if (data.action === 'add' && data.record && data.record.id) {
        if (!records.some((r) => r.id === data.record.id)) {
          records.unshift(data.record);
          await save(records);
        }
        return res.status(200).json({ ok: true });
      }
      if (data.action === 'delete' && data.id) {
        await save(records.filter((r) => r.id !== String(data.id)));
        return res.status(200).json({ ok: true });
      }
      if (data.id && data.type) {
        if (!records.some((r) => r.id === data.id)) {
          records.unshift(data);
          await save(records);
        }
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ ok: false });
    }
    return res.status(405).json({ ok: false });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
