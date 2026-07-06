/* OneShort 手機版 RWD 稽核腳本（見同目錄 SKILL.md 與 .agent/rules/style.md §13）
 * 只對 dev 環境執行。會以 quick-login 建立/重用測試帳號，並建立臨時 party/guild
 * 供詳情頁稽核（結束時自動刪除）。輸出 results.json + 截圖至 AUDIT_OUT。
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const FRONTEND = path.join(ROOT, 'frontend');
const { chromium, request } = require(path.join(FRONTEND, 'node_modules', '@playwright/test'));

const BASE = process.env.AUDIT_BASE || 'http://localhost:3000';
const API = process.env.AUDIT_API || 'http://localhost:8080/api/v2/';
// 預設輸出到 .claude 路徑（root repo 已 gitignore .claude/），即使從 .codex 副本執行也不會污染 git
const OUT = process.env.AUDIT_OUT || path.join(ROOT, '.claude', 'skills', 'mobile-rwd-audit', 'audit-out');
const SKIP_DETAIL = process.env.AUDIT_SKIP_DETAIL === '1';
const PERSONA_CODE = process.env.AUDIT_PERSONA_CODE || 'RW1ED78';
const PERSONA_PIN = process.env.AUDIT_PERSONA_PIN || '123456';

// 全站路由（與 .agent/rules/style.md §13.2 對齊；新頁面請同步補進來）
const ALL_ROUTES = ['/find', '/guilds', '/parties/create', '/applications', '/history', '/me'];
const ROUTES = process.env.AUDIT_ROUTES
  ? process.env.AUDIT_ROUTES.split(',').map((s) => s.trim()).filter(Boolean)
  : ALL_ROUTES;
const SPOT_WIDTHS = [390, 430, 768];

fs.mkdirSync(OUT, { recursive: true });
const ANNOUNCEMENT = { key: 'oneshort_last_announcement', version: '2026-04-11' };

const IPHONE = {
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

/* 頁面內量測：水平溢位、<44 觸控目標、<12px 文字、<16px 輸入框、fixed 元素、viewport meta */
const AUDIT_JS = () => {
  const doc = document.documentElement;
  const cw = doc.clientWidth;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity || '1') > 0.01;
  };
  const ident = (el) => {
    const tag = el.tagName.toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).slice(0, 4).join('.');
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24);
    return `${tag}${cls ? '.' + cls : ''}${label ? ` "${label}"` : ''}`;
  };
  const overflowEls = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if ((r.right > cw + 1 || r.left < -1) && visible(el)) {
      overflowEls.push({ el: ident(el), left: Math.round(r.left), right: Math.round(r.right) });
      if (overflowEls.length >= 15) break;
    }
  }
  const smallTargets = [];
  const sel = 'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, [role="tab"], [role="menuitem"]';
  for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) {
      smallTargets.push({ el: ident(el), w: Math.round(r.width), h: Math.round(r.height) });
      if (smallTargets.length >= 40) break;
    }
  }
  const tinyText = [];
  for (const el of document.querySelectorAll('body *')) {
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText || !visible(el)) continue;
    const fs2 = parseFloat(getComputedStyle(el).fontSize);
    if (fs2 < 11.5) {
      tinyText.push({ el: ident(el), fontSize: fs2 });
      if (tinyText.length >= 20) break;
    }
  }
  const inputsUnder16 = [];
  for (const el of document.querySelectorAll(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea',
  )) {
    if (!visible(el)) continue;
    const fs2 = parseFloat(getComputedStyle(el).fontSize);
    if (fs2 < 15.5) inputsUnder16.push({ el: ident(el), fontSize: fs2 });
  }
  const fixedEls = [];
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if ((s.position === 'fixed' || s.position === 'sticky') && visible(el)) {
      const r = el.getBoundingClientRect();
      fixedEls.push({ el: ident(el), pos: s.position, top: Math.round(r.top), bottom: Math.round(r.bottom), z: s.zIndex });
      if (fixedEls.length >= 12) break;
    }
  }
  const meta = document.querySelector('meta[name="viewport"]');
  return {
    scrollW: doc.scrollWidth, clientW: cw, hOverflow: doc.scrollWidth > cw,
    viewportMeta: meta ? meta.content : null,
    overflowEls, smallTargets, tinyText, inputsUnder16, fixedEls,
  };
};

async function auditPage(page, name) {
  await page.waitForTimeout(1200);
  const result = { name, url: page.url() };
  try { Object.assign(result, await page.evaluate(AUDIT_JS)); } catch (e) { result.error = String(e).slice(0, 200); }
  const safe = name.replace(/[^a-z0-9\-]/gi, '_');
  await page.screenshot({ path: path.join(OUT, `${safe}.png`) }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, `${safe}-full.png`), fullPage: true }).catch(() => {});
  return result;
}

async function gotoSafe(page, url) {
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); } catch { /* dev 首次編譯慢，已載入即可 */ }
}

(async () => {
  const results = [];

  // ---- quick-login（重用固定稽核帳號，避免累積測試帳號）----
  const api = await request.newContext({ baseURL: API });
  let login = await api.post('auth/quick-login', { data: { character_code: PERSONA_CODE, pin: PERSONA_PIN } });
  if (!login.ok()) {
    // 帳號不存在時帶完整欄位建立
    login = await api.post('auth/quick-login', {
      data: { character_code: PERSONA_CODE, pin: PERSONA_PIN, display_name: 'RWD稽核', job_class_id: 100, level: 200 },
    });
  }
  if (!login.ok()) throw new Error('quick-login failed: ' + login.status() + ' ' + (await login.text()).slice(0, 300));
  const auth = await login.json();
  const characterId = auth.current_character && auth.current_character.id;
  const storageState = await api.storageState();

  // ---- 臨時資料（party/guild 詳情頁用；結束時刪除）----
  let partyId = null, guildId = null;
  if (!SKIP_DETAIL) {
    const now = Date.now();
    const pRes = await api.post('parties', { data: {
      leader_character_id: characterId, type: 'BOSS', title: 'RWD稽核用-勿加入',
      target_name: '稽核測試', target_option_id: null, target_map_id: null, channel: '1', max_members: 2,
      scheduled_at: null,
      recruit_until: new Date(now + 30 * 60 * 1000).toISOString(),
      active_until: new Date(now + 60 * 60 * 1000).toISOString(),
      slots: [
        { job_class: 100, min_level: 200, max_level: null, filled_by: characterId, is_filled: true, is_required: true, slot_order: 1 },
        { job_class: null, min_level: null, max_level: null, filled_by: null, is_filled: false, is_required: true, slot_order: 2, note: '稽核' },
      ],
      note: 'RWD 稽核暫時資料', join_requires_password: false, join_password: null,
      join_requires_approval: true, allow_quick_login_players: true,
    } });
    if (pRes.ok()) { const b = await pRes.json(); partyId = (b.party && b.party.id) || b.id; }
    else results.push({ name: 'setup-party', error: pRes.status() + ' ' + (await pRes.text()).slice(0, 200) });

    const gRes = await api.post('guilds', { data: {
      name: 'RWD稽核用勿加入', description: 'RWD 稽核暫時資料，稽核後刪除', join_mode: 'OPEN',
      member_limit: null, icon_url: null,
    } });
    if (gRes.ok()) { const b = await gRes.json(); const g = b.guild || b.data || b; guildId = g.id; }
    else results.push({ name: 'setup-guild', error: gRes.status() + ' ' + (await gRes.text()).slice(0, 200) });
  }

  const browser = await chromium.launch();

  // ---- 未登入頁（home / login）----
  {
    const ctx = await browser.newContext(IPHONE);
    await ctx.addInitScript(({ key, version }) => { try { localStorage.setItem(key, version); } catch {} }, ANNOUNCEMENT);
    const page = await ctx.newPage();
    await gotoSafe(page, BASE + '/');
    results.push(await auditPage(page, 'home-375'));
    await gotoSafe(page, BASE + '/login');
    results.push(await auditPage(page, 'login-375'));
    await ctx.close();
  }

  // ---- 已登入 375 走訪 ----
  const ctx = await browser.newContext({ ...IPHONE, storageState });
  await ctx.addInitScript(({ key, version }) => { try { localStorage.setItem(key, version); } catch {} }, ANNOUNCEMENT);
  const page = await ctx.newPage();

  for (const route of ROUTES) {
    await gotoSafe(page, BASE + route);
    results.push(await auditPage(page, `${route.replace(/\//g, '_')}-375`));
  }

  // ---- 詳情頁 + guild tab 列 ----
  if (partyId) {
    await gotoSafe(page, `${BASE}/parties/${partyId}`);
    results.push(await auditPage(page, 'party-detail-375'));
  }
  if (guildId) {
    await gotoSafe(page, `${BASE}/guilds/${guildId}`);
    const r = await auditPage(page, 'guild-detail-375');
    try {
      r.tabBar = await page.evaluate(() => {
        const bar = document.querySelector('.os-guild-tab-bar');
        if (!bar) return null;
        return { overflowX: getComputedStyle(bar).overflowX, scrollW: bar.scrollWidth, clientW: bar.clientWidth, scrollable: bar.scrollWidth > bar.clientWidth };
      });
    } catch {}
    results.push(r);
    for (const tabName of ['成員', '隊伍']) {
      try {
        await page.locator('.os-guild-tab-bar button, .os-guild-tab-bar [role="tab"]').filter({ hasText: tabName }).first().click({ timeout: 4000 });
        results.push(await auditPage(page, `guild-tab-${tabName}-375`));
      } catch (e) { results.push({ name: `guild-tab-${tabName}-375`, skipped: String(e).slice(0, 120) }); }
    }
  }

  // ---- overlays ----
  // 每個 overlay 前重新載入 /find，避免前一個 sheet/backdrop 未關閉擋住後續點擊
  const tryOverlay = async (name, fn) => {
    await gotoSafe(page, BASE + '/find');
    await page.waitForTimeout(1200);
    try {
      await fn();
      await page.waitForTimeout(800);
      results.push(await auditPage(page, name));
    } catch (e) { results.push({ name, skipped: String(e).slice(0, 160) }); }
  };
  await tryOverlay('overlay-chat-sheet-375', () => page.locator('.os-chat-sheet-bubble').first().click({ timeout: 5000 }));
  await tryOverlay('overlay-create-sheet-375', () => page.getByRole('button', { name: '建立', exact: true }).click({ timeout: 5000 }));
  await tryOverlay('overlay-quick-wizard-375', async () => {
    await page.getByRole('button', { name: '建立', exact: true }).click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.getByText('快速隊伍', { exact: true }).click({ timeout: 4000 });
  });
  await tryOverlay('overlay-nav-drawer-375', () => page.getByRole('button', { name: '開啟選單' }).click({ timeout: 5000 }));
  await tryOverlay('overlay-notifications-375', () => page.locator('button[aria-label*="通知"]').first().click({ timeout: 5000 }));
  await tryOverlay('overlay-usermenu-375', () => page.getByRole('button', { name: '使用者選單' }).click({ timeout: 5000 }));

  // ---- 其他寬度抽查（核心頁）----
  const spotRoutes = ROUTES.filter((r) => ['/find', '/parties/create', '/history'].includes(r));
  for (const w of SPOT_WIDTHS) {
    await page.setViewportSize({ width: w, height: 812 });
    for (const route of spotRoutes) {
      await gotoSafe(page, BASE + route);
      results.push(await auditPage(page, `${route.replace(/\//g, '_')}-${w}`));
    }
  }

  await ctx.close();
  await browser.close();

  // ---- 清理 ----
  const cleanup = {};
  if (guildId) { const d = await api.delete(`guilds/${guildId}`); cleanup.guild = d.ok() ? 'deleted' : 'delete failed ' + d.status(); }
  if (partyId) {
    const d = await api.delete(`parties/${partyId}`).catch(() => null);
    cleanup.party = d && d.ok() ? 'deleted' : 'kept (30min 後自動過期)';
  }
  await api.dispose();

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ base: BASE, persona: PERSONA_CODE, cleanup, results }, null, 2));
  console.log('DONE. pages audited:', results.length, 'cleanup:', JSON.stringify(cleanup));
  console.log('output:', OUT);
  for (const r of results) {
    console.log(
      `- ${r.name}: ${r.skipped ? 'SKIP ' + r.skipped : r.error ? 'ERR ' + r.error
        : `hOverflow=${r.hOverflow} small=${(r.smallTargets || []).length} tiny=${(r.tinyText || []).length} inputs<16=${(r.inputsUnder16 || []).length}`}`,
    );
  }
})().catch((e) => { console.error('AUDIT FAILED:', e); process.exit(1); });
