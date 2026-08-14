// Screenshot the signed-in dormant dashboard deterministically: seed a fake
// Supabase session in localStorage and answer every Supabase request with
// canned rows. Dev-only harness - never shipped.
import puppeteer from 'puppeteer-core';

const out = process.argv[2] || 'shot-signedin.png';
const DAY = 24 * 60 * 60 * 1000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
const dateKey = (daysAgo) => iso(daysAgo).slice(0, 10);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: USER_ID,
  role: 'authenticated',
  email: 'demo@mindflow.app',
  exp: Math.floor(Date.now() / 1000) + 86400,
})}.sig`;
const session = {
  access_token: jwt,
  token_type: 'bearer',
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  refresh_token: 'fake-refresh',
  user: {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@mindflow.app',
    created_at: iso(400),
    app_metadata: {},
    user_metadata: {},
  },
};

// ---- canned data: dormant account, last studied ~65 days ago -------------
const PROFILE = {
  id: USER_ID,
  email: 'demo@mindflow.app',
  is_pro: false,
  is_admin: false,
  ai_usage_count: 2,
  streak_count: 0,
  total_focus_minutes: 743,
  full_name: null,
  avatar_url: null,
  stripe_customer_id: null,
  pro_expires_at: null,
  last_usage_date: dateKey(65),
};
const DECK_OVERVIEW = [
  { id: 'd1', user_id: USER_ID, title: 'Biochemistry — metabolism', created_at: iso(120), total: 42, matured: 12, in_progress: 21, due: 13, last_reviewed: iso(65) },
  { id: 'd2', user_id: USER_ID, title: 'Pharmacology', created_at: iso(100), total: 28, matured: 4, in_progress: 16, due: 10, last_reviewed: iso(72) },
  { id: 'd3', user_id: USER_ID, title: 'Anatomy basics', created_at: iso(20), total: 30, matured: 0, in_progress: 0, due: 0, last_reviewed: null },
];
const TOPICS = [
  { id: 't1', user_id: USER_ID, name: 'Organic chemistry', exam_date: dateKey(-24), created_at: iso(120) },
  { id: 't2', user_id: USER_ID, name: 'Pharmacокinetics'.replace('ок', 'ok'), exam_date: null, created_at: iso(100) },
];
const RECALL_ATTEMPTS = [
  { id: 'r1', user_id: USER_ID, topic_id: 't1', score: 62, grade: 'B', created_at: iso(66) },
  { id: 'r2', user_id: USER_ID, topic_id: 't1', score: 48, grade: 'C', created_at: iso(80) },
  { id: 'r3', user_id: USER_ID, topic_id: 't2', score: 55, grade: 'C', created_at: iso(70) },
];
const FOCUS_SESSIONS = [
  { id: 'f1', user_id: USER_ID, topic_id: 't1', title: 'Glycolysis', mode: 'pomodoro', duration_seconds: 1500, started_at: iso(65) },
  { id: 'f2', user_id: USER_ID, topic_id: 't1', title: 'TCA cycle', mode: 'pomodoro', duration_seconds: 1500, started_at: iso(70) },
  { id: 'f3', user_id: USER_ID, topic_id: 't2', title: 'Half-lives', mode: 'flowmodoro', duration_seconds: 2100, started_at: iso(78) },
];
const DAILY_ACTIVITY = [65, 66, 70, 71, 72, 78, 80, 81].map((d) => ({
  id: `a${d}`, user_id: USER_ID, date: dateKey(d), minutes_focused: d % 3 === 0 ? 55 : 20,
}));
const FLASHCARD_ROWS = DECK_OVERVIEW.flatMap((d, i) =>
  Array.from({ length: 6 }, (_, j) => ({ deck_id: d.id, box: (j % 5) + 1 }))
);
const DUE_TOTAL = 23;

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1400 });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.setRequestInterception(true);
page.on('request', (req) => {
  const u = new URL(req.url());
  if (!u.hostname.endsWith('.supabase.co')) return req.continue();
  const p = u.pathname;
  if (req.method() === 'OPTIONS') {
    return req.respond({
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers':
          'authorization, apikey, content-type, prefer, accept-profile, content-profile, x-client-info, x-supabase-api-version, range',
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE, HEAD, OPTIONS',
        'access-control-expose-headers': 'content-range',
      },
      body: '',
    });
  }
  const json = (body, headers = {}) =>
    req.respond({
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'content-range',
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  const wantsObject = (req.headers()['accept'] || '').includes('pgrst.object');

  if (p.startsWith('/auth/v1/user')) return json(session.user);
  if (p.startsWith('/auth/v1/token')) return json(session);
  if (p.startsWith('/auth/v1/')) return json({});

  if (p.includes('/rest/v1/profiles')) return json(wantsObject ? PROFILE : [PROFILE]);
  if (p.includes('/rest/v1/deck_overview')) return json(DECK_OVERVIEW);
  if (p.includes('/rest/v1/flashcards')) {
    if (req.method() === 'HEAD') {
      return req.respond({
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'content-range',
          'content-range': `0-0/${DUE_TOTAL}`,
        },
        body: '',
      });
    }
    return json(FLASHCARD_ROWS);
  }
  if (p.includes('/rest/v1/daily_activity')) return json(DAILY_ACTIVITY);
  if (p.includes('/rest/v1/topics')) return json(TOPICS);
  if (p.includes('/rest/v1/recall_attempts')) return json(RECALL_ATTEMPTS);
  if (p.includes('/rest/v1/focus_sessions')) return json(FOCUS_SESSIONS);
  return json([]);
});

// Seed the session before the app boots.
await page.evaluateOnNewDocument(
  (key, value) => localStorage.setItem(key, value),
  'sb-mfzsyazsvuzyiexgzxbw-auth-token',
  JSON.stringify(session)
);

await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 8000));
await page.screenshot({ path: out.replace(/\.png$/, '-mid.png') });
console.log('mid-state text:', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300));
await new Promise((r) => setTimeout(r, 6000));

// Entrance-scene frames: the first load may burn the scene during compile,
// so replay it on a warm reload - clear the scene flag, reload, and grab
// two mid-flight frames plus nothing else (the settled shot comes after).
const seqBase = out.replace(/\.png$/, '');
await page.evaluate(() => sessionStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
// Burst capture: 10 frames across the window where the app re-boots and the
// scene plays; several will catch the choreography mid-flight.
await new Promise((r) => setTimeout(r, 400));
for (let i = 0; i < 14; i++) {
  await page.screenshot({ path: `${seqBase}-b${i}.png` });
  await new Promise((r) => setTimeout(r, 130));
}
await new Promise((r) => setTimeout(r, 1200));

console.log('TEXT:', (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 700));
await page.screenshot({ path: out });
// Rail expansion state: hover the rail, let the spring settle, capture.
await page.mouse.move(34, 400);
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: out.replace(/\.png$/, '-rail.png') });
await page.mouse.move(700, 400);
console.log('saved:', out, 'plus scene burst frames -b0..b13');
if (errors.length) console.log('--- errors:\n' + errors.slice(0, 10).join('\n'));
await browser.close();
