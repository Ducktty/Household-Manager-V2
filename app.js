/* ===========================================================
   家当管家 v1 · 业务逻辑
   =========================================================== */

/* ------------------------------------------------------------
   1. 常量 & 工具
   ------------------------------------------------------------ */
const STORAGE_KEY = 'jiadang_products_v1';
const CART_KEY = 'jiadang_cart_v1';
const PROMPT_KEY = 'jiadang_last_prompt_v1';

const CATEGORIES = ['食品', '饮料', '乳制品', '清洁用品', '生活用纸', '个护', '调料', '其他'];

/* emoji 字典(按名称猜) */
const EMOJI_DICT = [
  { kws: ['牛奶', 'milk'], e: '🥛' },
  { kws: ['酱油', 'soy'], e: '🧴' },
  { kws: ['醋', 'vinegar'], e: '🧴' },
  { kws: ['油', 'oil'], e: '🫒' },
  { kws: ['可乐', 'cola', '雪碧', '汽水', '矿泉水', '水', '饮料', 'juice', '茶'], e: '🥤' },
  { kws: ['啤酒', 'beer'], e: '🍺' },
  { kws: ['牙膏', 'toothpaste'], e: '🪥' },
  { kws: ['牙刷'], e: '🪥' },
  { kws: ['洗发', 'shampoo'], e: '🧴' },
  { kws: ['沐浴', 'shower'], e: '🧼' },
  { kws: ['纸巾', 'tissue', '面纸'], e: '🧻' },
  { kws: ['卷纸', '厕纸', '卫生纸'], e: '🧻' },
  { kws: ['洗衣液', '洗衣粉', 'detergent', '蓝月亮', '汰渍', '立白'], e: '🧴' },
  { kws: ['洗洁精', 'dish'], e: '🧴' },
  { kws: ['米', 'rice'], e: '🍚' },
  { kws: ['面', 'noodle', '面条', 'pasta'], e: '🍜' },
  { kws: ['蛋', 'egg'], e: '🥚' },
  { kws: ['面包', 'bread'], e: '🍞' },
  { kws: ['饼干', 'crackers', 'cookie'], e: '🍪' },
  { kws: ['糖', 'candy', 'chocolate', '巧克力'], e: '🍫' },
  { kws: ['咖啡', 'coffee'], e: '☕' },
  { kws: ['药', 'pill', '药片'], e: '💊' },
  { kws: ['盐', 'salt'], e: '🧂' },
];

function guessEmoji(name) {
  const n = (name || '').toLowerCase();
  for (const item of EMOJI_DICT) {
    if (item.kws.some(k => n.includes(k.toLowerCase()))) return item.e;
  }
  return '📦';
}

function guessUnit(name) {
  const n = (name || '').toLowerCase();
  if (/牛奶|水|汁|饮料|可乐|雪碧|矿泉水|juice|water|cola|油|醋|酱油|洗发|沐浴|洗衣|洗洁|液|oil|soy|shampoo|detergent/.test(n)) return '瓶';
  if (/纸巾|面纸|卷纸|厕纸|tissue/.test(n)) return '包';
  if (/米|面|粉/.test(n)) return '袋';
  if (/牙膏/.test(n)) return '支';
  return '盒';
}

function fmtYuan(n) {
  if (n == null || isNaN(n)) return '¥0';
  return '¥' + Number(n).toFixed(2).replace(/\.00$/, '');
}

function fmtDate(d) {
  if (!d) return '--';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return `${dt.getMonth() + 1}-${String(dt.getDate()).padStart(2, '0')}`;
}

function fmtMonth(d) {
  if (!d) return '--';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return `${dt.getMonth() + 1} 月购入`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function uid() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/* ------------------------------------------------------------
   2. 数据层(localStorage)
   ------------------------------------------------------------ */
let PRODUCTS = [];
let CART = [];
let lastPrompt = '';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    PRODUCTS = raw ? JSON.parse(raw) : seedProducts();
  } catch (e) {
    console.warn('load products failed', e);
    PRODUCTS = seedProducts();
  }
  try {
    const raw = localStorage.getItem(CART_KEY);
    CART = raw ? JSON.parse(raw) : [];
  } catch (e) {
    CART = [];
  }
  lastPrompt = localStorage.getItem(PROMPT_KEY) || defaultPrompt();
  // 第一次启动时,把种子数据写回(让用户看到默认 3 件)
  if (!localStorage.getItem(STORAGE_KEY)) {
    saveProducts();
  }
}

function saveProducts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PRODUCTS));
  } catch (e) { console.warn('save failed', e); }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
  } catch (e) { console.warn('save cart failed', e); }
}

function savePrompt() {
  try {
    localStorage.setItem(PROMPT_KEY, lastPrompt);
  } catch (e) { /* noop */ }
}

/* 默认种子数据(3 个产品,符合 SPEC v1.0 的演示) */
function seedProducts() {
  const today = todayStr();
  return [
    {
      id: uid(),
      name: '伊利纯牛奶 1L',
      category: '乳制品',
      unit: '盒',
      cycle: 7,
      qty: 1,
      usualPrice: 65,
      history: [
        { date: '2026-03-15', qty: 1, price: 45, star: true },
        { date: '2026-04-12', qty: 1, price: 68 },
        { date: '2026-05-28', qty: 1, price: 72 },
        { date: '2026-07-09', qty: 1, price: 65 },
      ],
    },
    {
      id: uid(),
      name: '蓝月亮洗衣液 2kg',
      category: '清洁用品',
      unit: '瓶',
      cycle: 60,
      qty: 0.4,
      usualPrice: 40,
      history: [
        { date: '2026-04-20', qty: 1, price: 35, star: true },
        { date: '2026-06-15', qty: 1, price: 42 },
        { date: '2026-08-02', qty: 1, price: 40 },
      ],
    },
    {
      id: uid(),
      name: '可口可乐 330ml',
      category: '饮料',
      unit: '瓶',
      cycle: 3,
      qty: 6,
      usualPrice: 3.5,
      history: [
        { date: '2026-06-30', qty: 6, price: 18, star: false },
        { date: '2026-07-10', qty: 6, price: 21 },
      ],
    },
  ];
}

/* ------------------------------------------------------------
   3. 业务计算
   ------------------------------------------------------------ */
function getStatus(p) {
  if (!p.cycle || p.cycle <= 0) return 'ok';
  const days = p.qty * p.cycle;
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'warn';
  return 'ok';
}

function getStatusText(p) {
  const s = getStatus(p);
  if (s === 'urgent') return '紧急';
  if (s === 'warn') return '注意';
  return '充足';
}

function getForecastDays(p) {
  if (!p.cycle || p.cycle <= 0) return null;
  return Math.max(0, Math.round(p.qty * p.cycle));
}

function sortByUrgency(list) {
  const order = { urgent: 0, warn: 1, ok: 2 };
  return [...list].sort((a, b) => {
    const sa = getStatus(a), sb = getStatus(b);
    if (order[sa] !== order[sb]) return order[sa] - order[sb];
    return getForecastDays(a) - getForecastDays(b);
  });
}

function getPriceStats(p) {
  const hist = p.history || [];
  if (!hist.length) return null;
  const prices = hist.map(h => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const last = hist[hist.length - 1];
  const minEntry = hist.find(h => h.price === min);
  return { min, max, last, minEntry, lastEntry: last };
}

/* 模糊匹配(子串包含,不限位置) */
function fuzzyMatch(query, name) {
  if (!query) return false;
  return name.toLowerCase().includes(query.toLowerCase());
}

function findByExactName(name) {
  return PRODUCTS.find(p => p.name === name);
}

function findSimilar(query) {
  if (!query || query.length < 1) return [];
  return PRODUCTS.filter(p => fuzzyMatch(query, p.name));
}

/* ------------------------------------------------------------
   4. 页面导航
   ------------------------------------------------------------ */
const SCREENS = ['home', 'scan', 'gemini', 'detail', 'roi', 'paste', 'calc', 'manual', 'edit', 'cart', 'history'];
let currentScreen = 'home';
let screenHistory = ['home'];

function showScreen(name, opts = {}) {
  if (!SCREENS.includes(name)) {
    console.warn('unknown screen', name);
    return;
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  currentScreen = name;
  if (opts.pushHistory !== false) {
    if (screenHistory[screenHistory.length - 1] !== name) {
      screenHistory.push(name);
    }
  }
  // 滚到顶部
  const body = el?.querySelector('.screen-body');
  if (body) body.scrollTop = 0;
}

/* 每个屏幕的默认父级(back 跳到哪) */
const PARENT = {
  home: 'home',
  scan: 'home',
  gemini: 'home',
  detail: 'home',
  paste: 'home',
  manual: 'home',
  cart: 'home',
  roi: 'detail',
  calc: 'detail',
  edit: 'detail',
  history: 'detail',
};

function goBack() {
  const parent = PARENT[currentScreen] || 'home';
  // 弹出堆栈中所有与当前屏幕及其后续侧分支相关的项
  while (screenHistory.length > 0) {
    const top = screenHistory[screenHistory.length - 1];
    if (top === currentScreen) { screenHistory.pop(); continue; }
    // 如果是侧分支(比如从 detail 跳到 calc,跳到 roi,跳到 cart,这种 calc/roi/cart 残留)
    if (top !== parent && isAncestorOf(parent, top)) { screenHistory.pop(); continue; }
    break;
  }
  showScreen(parent, { pushHistory: false });
  return true;
}

/* 粗略判断:a 是否是 b 的祖先(沿 PARENT 链) */
function isAncestorOf(a, b) {
  let cur = b;
  while (cur && cur !== 'home') {
    if (cur === a) return true;
    cur = PARENT[cur];
  }
  return a === 'home';
}

/* ------------------------------------------------------------
   5. Toast / 模态
   ------------------------------------------------------------ */
let toastTimer = null;
function toast(msg, duration = 1800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

function confirmDialog({ title = '确认', body = '是否继续?', confirmText = '确定', danger = false, onConfirm }) {
  const backdrop = document.getElementById('modal-backdrop');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  const confirmBtn = document.getElementById('modal-confirm');
  confirmBtn.textContent = confirmText;
  confirmBtn.classList.toggle('danger', !!danger);
  backdrop.style.display = 'flex';

  const close = () => { backdrop.style.display = 'none'; };

  document.getElementById('modal-cancel').onclick = close;
  confirmBtn.onclick = () => {
    close();
    if (onConfirm) onConfirm();
  };
  backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
}

/* ------------------------------------------------------------
   6. 首页渲染
   ------------------------------------------------------------ */
function renderHome() {
  // 数量
  document.getElementById('home-count').textContent = PRODUCTS.length;

  // 警告横幅
  const urgent = sortByUrgency(PRODUCTS).filter(p => getStatus(p) !== 'ok');
  const banner = document.getElementById('alert-banner');
  if (urgent.length > 0) {
    banner.style.display = 'flex';
    document.getElementById('alert-t1').textContent = `${urgent.length} 件快用完了`;
    document.getElementById('alert-t2').textContent = urgent.slice(0, 3).map(p => p.name).join('、') + ' 需要补货';
  } else {
    banner.style.display = 'none';
  }

  // 列表
  const list = document.getElementById('product-list');
  const empty = document.getElementById('product-empty');
  if (PRODUCTS.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    const sorted = sortByUrgency(PRODUCTS);
    list.innerHTML = sorted.map(p => renderProductCard(p)).join('');
    bindProductCardEvents();
  }

  // 购物车 badge
  renderCartBadge();
}

function renderProductCard(p) {
  const status = getStatus(p);
  const days = getForecastDays(p);
  const emoji = guessEmoji(p.name);
  const statusText = getStatusText(p);
  const daysText = days != null ? `剩 ${p.qty} ${p.unit} · 预计 ${days} 天后用完` : `剩 ${p.qty} ${p.unit}`;
  const maxDays = 7;
  const progressPct = days == null ? 100 : Math.max(8, Math.min(100, (days / maxDays) * 100));

  return `
    <div class="product-card" data-id="${p.id}">
      <div class="emoji">${emoji}</div>
      <div class="info">
        <div class="name">
          <span>${escapeHtml(p.name)}</span>
          <span class="status status-${status}">${statusText}</span>
        </div>
        <div class="meta">${daysText}</div>
        <div class="progress"><div class="progress-fill ${status}" style="width:${progressPct}%"></div></div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function bindProductCardEvents() {
  document.querySelectorAll('#product-list .product-card').forEach(card => {
    const id = card.dataset.id;
    let pressTimer = null;
    let longPressTriggered = false;
    let startX = 0, startY = 0;

    const start = (e) => {
      longPressTriggered = false;
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX;
      startY = pt.clientY;
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        if (navigator.vibrate) navigator.vibrate(40);
        showLongPressMenu(id);
      }, 700);  // 延长到 700ms,降低误触
    };

    const cancel = () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    };

    // 触屏:touchstart + touchend + touchmove(移动 > 12px 取消)
    card.addEventListener('touchstart', start, { passive: true });
    card.addEventListener('touchend', cancel);
    card.addEventListener('touchcancel', cancel);
    card.addEventListener('touchmove', (e) => {
      if (!e.touches || !e.touches[0]) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) cancel();
    }, { passive: true });

    // 桌面:mouse
    card.addEventListener('mousedown', start);
    card.addEventListener('mouseup', cancel);
    card.addEventListener('mouseleave', cancel);

    // 桌面右键拦截
    card.addEventListener('contextmenu', (e) => e.preventDefault());

    // click 是 final 动作:tap 和 click 都会触发,但只响应未被 longpress 拦截的
    card.addEventListener('click', (e) => {
      if (longPressTriggered) { longPressTriggered = false; e.stopPropagation(); e.preventDefault(); return; }
      openDetail(id);
    });
  });
}

/* 长按菜单 */
let longPressTargetId = null;
function showLongPressMenu(id) {
  longPressTargetId = id;
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  document.getElementById('longpress-title').textContent = p.name;
  document.getElementById('longpress-backdrop').style.display = 'flex';
}
function hideLongPressMenu() {
  document.getElementById('longpress-backdrop').style.display = 'none';
  longPressTargetId = null;
}

/* ------------------------------------------------------------
   7. 详情页
   ------------------------------------------------------------ */
let currentProductId = null;
let draftQty = null;     // 草稿,未保存
let draftDirectInput = ''; // 直接输入框的值

function openDetail(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  currentProductId = id;
  draftQty = p.qty;
  draftDirectInput = '';
  renderDetail();
  showScreen('detail');
}

function renderDetail() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  const emoji = guessEmoji(p.name);
  document.getElementById('detail-emoji').textContent = emoji;
  document.getElementById('detail-name').textContent = p.name;
  document.getElementById('detail-cat').textContent = `${p.category} · ${p.unit}`;
  document.getElementById('detail-qty').textContent = p.qty;
  document.getElementById('detail-unit').textContent = p.unit;
  document.getElementById('detail-qty-display').textContent = p.qty;
  document.getElementById('detail-qty-direct').value = '';

  // 草稿状态
  const dirty = draftQty !== p.qty;
  document.getElementById('qty-dirty').style.display = dirty ? 'block' : 'none';

  // 预测
  const days = getForecastDays({ ...p, qty: draftQty });
  const forecastEl = document.getElementById('detail-forecast');
  const daysEl = document.getElementById('detail-forecast-days');
  if (days == null) {
    forecastEl.style.display = 'none';
  } else {
    forecastEl.style.display = 'flex';
    daysEl.textContent = days;
    forecastEl.classList.remove('warn', 'danger', 'ok');
    if (days <= 3) {
      forecastEl.classList.add('danger');
      forecastEl.lastElementChild.innerHTML = `预计 <strong id="detail-forecast-days">${days}</strong> 天后用完,该补货啦!`;
    } else if (days <= 7) {
      forecastEl.classList.add('warn');
      forecastEl.lastElementChild.innerHTML = `预计 <strong id="detail-forecast-days">${days}</strong> 天后用完`;
    } else {
      forecastEl.classList.add('ok');
      forecastEl.lastElementChild.innerHTML = `预计 <strong id="detail-forecast-days">${days}</strong> 天后用完,库存充足`;
    }
  }

  // 价格统计
  const stats = getPriceStats(p);
  if (stats) {
    document.getElementById('detail-price-min').textContent = fmtYuan(stats.min);
    document.getElementById('detail-price-min-date').textContent = fmtMonth(stats.minEntry.date);
    document.getElementById('detail-price-max').textContent = fmtYuan(stats.max);
    document.getElementById('detail-price-max-date').textContent = fmtMonth(stats.lastEntry.date === stats.minEntry ? stats.lastEntry.date : stats.minEntry.date);
    document.getElementById('detail-price-last').textContent = fmtYuan(stats.last.price);
    document.getElementById('detail-price-last-date').textContent = fmtMonth(stats.last.date);
  } else {
    document.getElementById('detail-price-min').textContent = '¥--';
    document.getElementById('detail-price-min-date').textContent = '无记录';
    document.getElementById('detail-price-max').textContent = '¥--';
    document.getElementById('detail-price-max-date').textContent = '无记录';
    document.getElementById('detail-price-last').textContent = '¥--';
    document.getElementById('detail-price-last-date').textContent = '无记录';
  }

  // 历史
  const hist = p.history || [];
  const histEl = document.getElementById('history-list');
  if (hist.length === 0) {
    histEl.innerHTML = '<div class="history-empty">暂无购买记录</div>';
  } else {
    histEl.innerHTML = [...hist].reverse().map((h, i) => {
      const realIdx = hist.length - 1 - i;
      return `
      <div class="history-row clickable" data-idx="${realIdx}">
        <div class="date">${fmtDate(h.date)}</div>
        <div class="qty">${h.qty} ${p.unit}</div>
        <div class="price">${h.star ? '<span class="star">⭐</span>' : ''}${fmtYuan(h.price)}</div>
      </div>
    `;
    }).join('');
    histEl.querySelectorAll('.history-row').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        openHistEditor(idx);
      });
    });
  }
}

function changeQty(delta) {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  draftQty = Math.max(0, Number((draftQty + delta).toFixed(2)));
  document.getElementById('detail-qty-display').textContent = draftQty;
  document.getElementById('detail-qty').textContent = draftQty;
  // 更新 dirty 提示
  document.getElementById('qty-dirty').style.display = (draftQty !== p.qty) ? 'block' : 'none';
  // 更新预测
  const days = getForecastDays({ ...p, qty: draftQty });
  const daysEl = document.getElementById('detail-forecast-days');
  if (days != null) daysEl.textContent = days;
}

function saveQty() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  // 草稿模式:草稿 = 当前才报错
  if (draftQty === p.qty) {
    toast('没变化,不用保存');
    return;
  }
  p.qty = draftQty;
  saveProducts();
  document.getElementById('qty-dirty').style.display = 'none';
  toast('已保存');
  // 刷新预测样式
  renderDetail();
}

function directInputQty(val) {
  if (val === '' || isNaN(val)) return;
  draftQty = Math.max(0, Number(val));
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  document.getElementById('detail-qty-display').textContent = draftQty;
  document.getElementById('detail-qty').textContent = draftQty;
  document.getElementById('qty-dirty').style.display = (draftQty !== p.qty) ? 'block' : 'none';
  const days = getForecastDays({ ...p, qty: draftQty });
  const daysEl = document.getElementById('detail-forecast-days');
  if (days != null) daysEl.textContent = days;
}

function deleteCurrentProduct() {
  if (!currentProductId) return;
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  confirmDialog({
    title: '删除产品',
    body: `确定删除 "${p.name}" 吗?这会同时清除所有购买历史。`,
    confirmText: '删除',
    danger: true,
    onConfirm: () => {
      PRODUCTS = PRODUCTS.filter(x => x.id !== currentProductId);
      saveProducts();
      currentProductId = null;
      renderHome();
      showScreen('home', { pushHistory: false });
      toast('已删除');
    },
  });
}

/* ------------------------------------------------------------
   8. 编辑产品页
   ------------------------------------------------------------ */
function openEdit() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  document.getElementById('edit-name').value = p.name;
  document.getElementById('edit-category').value = p.category;
  document.getElementById('edit-unit').value = p.unit;
  document.getElementById('edit-cycle').value = p.cycle;
  document.getElementById('edit-usual-price').value = p.usualPrice || '';
  showScreen('edit');
}

function saveEdit() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  const name = document.getElementById('edit-name').value.trim();
  const cycle = parseInt(document.getElementById('edit-cycle').value, 10);
  if (!name) { toast('请填产品名称'); return; }
  if (!cycle || cycle <= 0) { toast('请填有效的使用周期'); return; }
  p.name = name;
  p.category = document.getElementById('edit-category').value;
  p.unit = document.getElementById('edit-unit').value.trim() || '件';
  p.cycle = cycle;
  p.usualPrice = parseFloat(document.getElementById('edit-usual-price').value) || p.usualPrice || 0;
  saveProducts();
  renderDetail();
  showScreen('detail', { pushHistory: false });
  toast('已保存');
}

/* ------------------------------------------------------------
   8.5 历史记录编辑 + 管理页
   ------------------------------------------------------------ */
let editingHistIdx = -1;   // 当前编辑/查看的历史 index(在 product.history 里的位置)

function openHistoryPage() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  renderHistoryPage();
  showScreen('history');
}

function renderHistoryPage() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  const hist = p.history || [];
  document.getElementById('history-page-sub').textContent = `${p.name} · 共 ${hist.length} 条记录`;
  const list = document.getElementById('history-page-list');
  const empty = document.getElementById('history-page-empty');
  if (hist.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = [...hist].reverse().map((h, i) => {
    const realIdx = hist.length - 1 - i;  // 反向后的 index → 原始 index
    return `
      <div class="history-page-item" data-idx="${realIdx}">
        <div class="icon">📅</div>
        <div class="info">
          <div class="top">${fmtDate(h.date)} · ${h.qty} ${p.unit}</div>
          <div class="sub">${h.star ? '⭐ 历史最低价' : '点击可编辑 / 删除'}</div>
        </div>
        <div class="price">${h.star ? '<span class="star">⭐</span>' : ''}${fmtYuan(h.price)}</div>
        <span class="arrow">›</span>
      </div>
    `;
  }).join('');
  list.querySelectorAll('.history-page-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx, 10);
      openHistEditor(idx);
    });
  });
}

function openHistEditor(idx) {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p || !p.history || !p.history[idx]) return;
  editingHistIdx = idx;
  const h = p.history[idx];
  document.getElementById('hist-edit-date').value = h.date || todayStr();
  document.getElementById('hist-edit-qty').value = h.qty;
  document.getElementById('hist-edit-price').value = h.price;
  document.getElementById('hist-edit-unit').textContent = p.unit;
  document.getElementById('hist-edit-backdrop').style.display = 'flex';
}

function closeHistEditor() {
  document.getElementById('hist-edit-backdrop').style.display = 'none';
  editingHistIdx = -1;
}

function saveHistEditor() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p || editingHistIdx < 0) return;
  const h = p.history[editingHistIdx];
  if (!h) return;
  const date = document.getElementById('hist-edit-date').value || todayStr();
  const qty = parseFloat(document.getElementById('hist-edit-qty').value);
  const price = parseFloat(document.getElementById('hist-edit-price').value);
  if (!qty || qty <= 0) { toast('请填有效的数量'); return; }
  if (isNaN(price) || price < 0) { toast('请填有效的价格'); return; }
  h.date = date;
  h.qty = qty;
  h.price = price;
  // 重算 star: 当前最低价标星
  const prices = p.history.map(x => x.price);
  const min = Math.min(...prices);
  p.history.forEach(x => { x.star = (x.price === min); });
  saveProducts();
  closeHistEditor();
  renderHistoryPage();
  renderDetail();
  toast('已保存');
}

function deleteHistEditor() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p || editingHistIdx < 0) return;
  const h = p.history[editingHistIdx];
  if (!h) return;
  p.history.splice(editingHistIdx, 1);
  if (p.history.length > 0) {
    const prices = p.history.map(x => x.price);
    const min = Math.min(...prices);
    p.history.forEach(x => { x.star = (x.price === min); });
  }
  saveProducts();
  closeHistEditor();
  renderHistoryPage();
  renderDetail();
  toast('已删除');
}

/* ------------------------------------------------------------
   9. 手动输入页(智能版)
   ------------------------------------------------------------ */
let manualMode = 'new';   // 'new' | 'append'
let manualTargetProduct = null;   // 简化模式下,选中的产品

function openManual(prefill = {}) {
  manualMode = 'new';
  manualTargetProduct = null;
  document.getElementById('manual-title').textContent = '手动添加产品';
  document.getElementById('manual-subtitle').textContent = '买回来的东西没拍照?填一下';
  document.getElementById('manual-save-text').textContent = '保存到库存';
  document.getElementById('manual-tip').textContent = '💡 填了名称,系统会提示是否已有同款';

  document.getElementById('manual-name').value = prefill.name || '';
  document.getElementById('manual-qty').value = prefill.qty || 1;
  document.getElementById('manual-price').value = prefill.price || 0;
  document.getElementById('manual-date').value = prefill.date || todayStr();

  // 根据预填名称猜单位
  if (prefill.name) {
    document.getElementById('manual-unit').value = guessUnit(prefill.name);
  } else {
    document.getElementById('manual-unit').value = '盒';
  }
  document.getElementById('manual-cycle').value = 30;
  document.getElementById('manual-category').value = '食品';
  document.getElementById('manual-unit-label').textContent = document.getElementById('manual-unit').value;

  // 候选
  refreshManualSuggestions();
  updateManualNewFields();

  showScreen('manual');
}

function refreshManualSuggestions() {
  const name = document.getElementById('manual-name').value.trim();
  const wrap = document.getElementById('manual-suggestions');
  const list = document.getElementById('manual-suggestion-list');
  if (manualMode === 'append' || !name) {
    wrap.style.display = 'none';
    return;
  }
  const matches = findSimilar(name);
  if (matches.length === 0) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  list.innerHTML = matches.map(p => `
    <button class="suggestion-item" data-id="${p.id}">
      <span class="em">${guessEmoji(p.name)}</span>
      <span class="info">
        <span class="n">${escapeHtml(p.name)}</span>
        <span class="m">剩 ${p.qty} ${p.unit} · 上次 ${fmtYuan(p.usualPrice || 0)}/${p.unit}</span>
      </span>
      <span class="arrow">›</span>
    </button>
  `).join('');
  list.querySelectorAll('.suggestion-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      switchToAppendMode(id);
    });
  });
}

function switchToAppendMode(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  manualMode = 'append';
  manualTargetProduct = p;
  document.getElementById('manual-title').textContent = '加进现有库存';
  document.getElementById('manual-subtitle').textContent = `已识别:${p.name}`;
  document.getElementById('manual-save-text').textContent = '加入库存';
  document.getElementById('manual-tip').textContent = '💡 加这次买的数量、价格即可,其他字段沿用上次';
  document.getElementById('manual-suggestions').style.display = 'none';
  document.getElementById('manual-unit-label').textContent = p.unit;
  document.getElementById('manual-name').value = p.name;
  document.getElementById('manual-name').disabled = true;
  updateManualNewFields();
}

function updateManualNewFields() {
  document.getElementById('manual-new-fields').style.display = manualMode === 'new' ? 'block' : 'none';
  document.getElementById('manual-name').disabled = manualMode === 'append';
}

function saveManual() {
  // 防重复提交
  const btn = document.getElementById('btn-manual-save');
  if (btn.disabled) return;
  btn.disabled = true;
  setTimeout(() => { btn.disabled = false; }, 1500);

  const name = document.getElementById('manual-name').value.trim();
  const qty = parseFloat(document.getElementById('manual-qty').value);
  const price = parseFloat(document.getElementById('manual-price').value);
  const date = document.getElementById('manual-date').value || todayStr();
  if (!name) { toast('请填产品名称'); return; }
  if (!qty || qty <= 0) { toast('请填数量'); return; }
  if (isNaN(price) || price < 0) { toast('请填价格'); return; }

  if (manualMode === 'append' && manualTargetProduct) {
    const p = manualTargetProduct;
    p.qty = (p.qty || 0) + qty;
    p.history = p.history || [];
    p.history.push({ date, qty, price });
    p.usualPrice = p.usualPrice || price;
    saveProducts();
    renderHome();
    goBackToHome();
    toast('已加入库存');
  } else {
    const unit = document.getElementById('manual-unit').value.trim() || guessUnit(name) || '件';
    const cycle = parseInt(document.getElementById('manual-cycle').value, 10) || 30;
    const category = document.getElementById('manual-category').value;
    const newP = {
      id: uid(),
      name,
      category,
      unit,
      cycle,
      qty,
      usualPrice: price,
      history: [{ date, qty, price }],
    };
    PRODUCTS.push(newP);
    saveProducts();
    renderHome();
    goBackToHome();
    toast('已保存到库存');
  }
}

/* 保存后强制返回首页(跳详情会让人以为“未生效”重复点) */
function goBackToHome() {
  // 清掉堆栈,只留 home,避免 back 按钮点回去
  screenHistory = ['home'];
  currentScreen = 'home';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-home').classList.add('active');
  const body = document.getElementById('screen-home').querySelector('.screen-body');
  if (body) body.scrollTop = 0;
}

/* ------------------------------------------------------------
   10. 粘贴答案页
   ------------------------------------------------------------ */
let pasteResult = null;  // { name, qty, price, date, isExisting, targetId }

function openPaste(prefill = {}) {
  document.getElementById('paste-name').value = prefill.name || '';
  document.getElementById('paste-qty').value = prefill.qty || 1;
  document.getElementById('paste-price').value = prefill.price || 0;
  document.getElementById('paste-date').value = prefill.date || todayStr();
  document.getElementById('paste-unit-label').textContent = '件';
  showScreen('paste');
}

async function readClipboard() {
  // 1) 优先用 Clipboard API
  if (navigator.clipboard && navigator.clipboard.readText) {
    try {
      const txt = await navigator.clipboard.readText();
      return { ok: true, value: (txt || '').trim() };
    } catch (e) {
      console.warn('clipboard API read failed:', e.message);
    }
  }
  // 2) 降级:用 execCommand('paste') 在临时 textarea 上
  try {
    const ta = document.createElement('textarea');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    const ok = document.execCommand('paste');
    const v = ta.value;
    document.body.removeChild(ta);
    if (ok && v) return { ok: true, value: v.trim() };
  } catch (e) {
    console.warn('execCommand paste failed:', e.message);
  }
  return { ok: false, value: '' };
}

async function handlePasteFromClip() {
  const res = await readClipboard();
  if (res.ok && res.value) {
    document.getElementById('paste-name').value = res.value;
    toast('已读入剪贴板');
  } else {
    // 读取失败——iOS Safari / 部分安卓上 Clipboard API 受限
    // 改为: focus 到输入框,让用户手动长按粘入
    const ta = document.getElementById('paste-name');
    ta.focus();
    ta.setSelectionRange(0, 0);
    toast('读不到剪贴板,请长按输入框手动粘入', 2500);
  }
}

function nextFromPaste() {
  // 防重复提交
  const btn = document.getElementById('btn-paste-next');
  if (btn.disabled) return;
  btn.disabled = true;
  setTimeout(() => { btn.disabled = false; }, 1500);

  const name = document.getElementById('paste-name').value.trim();
  const qty = parseFloat(document.getElementById('paste-qty').value) || 1;
  const price = parseFloat(document.getElementById('paste-price').value) || 0;
  const date = document.getElementById('paste-date').value || todayStr();
  if (!name) { toast('请填产品名称'); return; }

  // 智能判断:同款?
  const exact = findByExactName(name);
  if (exact) {
    confirmDialog({
      title: '加到现有库存?',
      body: `家里已有"${name}",要加 ${qty} 个到现有库存吗?`,
      confirmText: '加进去',
      onConfirm: () => {
        exact.qty = (exact.qty || 0) + qty;
        exact.history = exact.history || [];
        exact.history.push({ date, qty, price });
        exact.usualPrice = exact.usualPrice || price;
        saveProducts();
        renderHome();
        goBackToHome();
        toast('已加入库存');
      },
    });
  } else {
    // 跳手动输入页(预填)。取消按钮防重复重启用
    openManual({ name, qty, price, date });
  }
}

/* ------------------------------------------------------------
   11. Gemini 引导页
   ------------------------------------------------------------ */
function defaultPrompt() {
  return `请识别图中产品的完整名称(品牌+产品名+规格)。

要求:
1. 重要:保持产品包装上的原语言!如果包装上是英文(如 "Coca-Cola" "Colgate"),就返回英文;如果是中文,就返回中文;不要主动翻译。
2. 返回格式:品牌 + 产品名 + 规格/容量
3. 如果有多个规格(40g/100g 等),请以包装上最明显的为准
4. 只返回产品名这一行,不要任何解释
5. 如果图片不清晰或不是产品包装,仅回复:无法识别`;
}

function openGemini() {
  lastPrompt = lastPrompt || defaultPrompt();
  savePrompt();
  document.getElementById('gemini-prompt-text').textContent = lastPrompt;
  // 自动复制
  copyToClipboard(lastPrompt);
  toast('Prompt 已自动复制到剪贴板');
  // 标记 step 1 为已完成
  document.getElementById('step-1').classList.add('active');
  showScreen('gemini');
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fallthrough */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (e) {
    return false;
  }
}

function openGeminiApp() {
  // 动态创建 <a target="_blank"> 触发跳转,避免被 iOS Safari / 部分安卓浏览器拦截
  const url = 'https://gemini.google.com/app';
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
  toast('已打开 Gemini,复制答案后返回');
}

/* ------------------------------------------------------------
   12. 拍照页 → Gemini / 手动
   ------------------------------------------------------------ */
let lastPhotoDataUrl = null;

function openScan() {
  showScreen('scan');
  // 重置抽屉
  document.getElementById('scan-sheet').classList.remove('show');
  document.getElementById('sheet-backdrop').classList.remove('show');
  document.getElementById('scan-photo-preview').style.display = 'none';
}

function handleCameraFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    lastPhotoDataUrl = e.target.result;
    document.getElementById('scan-photo-img').src = lastPhotoDataUrl;
    document.getElementById('scan-photo-preview').style.display = 'block';
    document.getElementById('scan-sheet-sub').textContent = '选个方式识别产品';
    showScanSheet();
  };
  reader.readAsDataURL(file);
}

function showScanSheet() {
  document.getElementById('scan-sheet').classList.add('show');
  document.getElementById('sheet-backdrop').classList.add('show');
}
function hideScanSheet() {
  document.getElementById('scan-sheet').classList.remove('show');
  document.getElementById('sheet-backdrop').classList.remove('show');
}

/* ------------------------------------------------------------
   13. 计算器 / ROI 结果
   ------------------------------------------------------------ */
let roiData = null;   // 算出来的结果

function openCalc() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  document.getElementById('calc-emoji').textContent = guessEmoji(p.name);
  document.getElementById('calc-name').textContent = p.name;
  document.getElementById('calc-cat').textContent = `${p.category} · ${p.unit}`;
  // 单位标签
  ['calc-unit-label', 'calc-unit-label2', 'calc-unit-label3'].forEach(id => {
    document.getElementById(id).textContent = '/ ' + p.unit;
  });
  document.getElementById('calc-unit-label2').textContent = p.unit;
  // 预填
  const stats = getPriceStats(p);
  const usual = p.usualPrice || (stats ? stats.last.price : 0) || 0;
  document.getElementById('calc-usual-price').value = usual;
  document.getElementById('calc-cycle').value = p.cycle || 30;
  document.getElementById('calc-batch-qty').value = 3;
  document.getElementById('calc-batch-price').value = usual ? Math.round(usual * 0.7 * 100) / 100 : 0;
  showScreen('calc');
}

function computeRoi() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  const usual = parseFloat(document.getElementById('calc-usual-price').value) || 0;
  const cycle = parseFloat(document.getElementById('calc-cycle').value) || 30;
  const batchQty = parseFloat(document.getElementById('calc-batch-qty').value) || 1;
  const batchPrice = parseFloat(document.getElementById('calc-batch-price').value) || 0;

  const total = batchQty * batchPrice;
  const days = cycle * batchQty;
  const perDay = total / days;
  const usualPerDay = usual / cycle;
  const savePct = usualPerDay > 0 ? ((usualPerDay - perDay) / usualPerDay) * 100 : 0;
  const saved = (usualPerDay - perDay) * days;

  let level = 'warn', title = '一般 🟡', subtitle = '比平时略便宜,看自己需求';
  if (savePct >= 20) { level = 'good'; title = '建议囤货 🟢'; subtitle = '这次批量买比平时便宜'; }
  else if (savePct < 5) { level = 'bad'; title = '不建议 🔴'; subtitle = '比平时还贵或差不多'; }

  roiData = {
    product: p,
    usual, cycle, batchQty, batchPrice,
    total, days, perDay, usualPerDay, savePct, saved, level,
  };
  renderRoi();
  showScreen('roi');
}

function renderRoi() {
  if (!roiData) return;
  const r = roiData;
  const p = r.product;

  // 图标
  const icon = document.getElementById('roi-icon');
  icon.classList.remove('good', 'warn', 'bad');
  icon.classList.add(r.level);
  // 替换 icon svg:good/warn/bad 不同
  const svg = icon.querySelector('svg');
  if (r.level === 'bad') {
    svg.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
  } else {
    svg.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
  }

  document.getElementById('roi-title').textContent = r.title;
  document.getElementById('roi-subtitle').textContent = r.subtitle;

  const tag = document.getElementById('roi-tag');
  tag.classList.remove('good', 'warn', 'bad');
  tag.classList.add(r.level);
  document.getElementById('roi-save-pct').textContent = r.savePct >= 0
    ? `单次成本省 ${Math.round(r.savePct)}%`
    : `比平时贵 ${Math.abs(Math.round(r.savePct))}%`;

  document.getElementById('roi-total').textContent = fmtYuan(r.total);
  document.getElementById('roi-total-sub').textContent = `${r.batchQty} ${p.unit} × ${fmtYuan(r.batchPrice)}`;
  document.getElementById('roi-days').textContent = `${r.days} 天`;
  document.getElementById('roi-days-sub').textContent = `≈ ${Math.round(r.days / 30)} 个月`;
  document.getElementById('roi-per-day').textContent = fmtYuan(r.perDay);
  document.getElementById('roi-per-day-sub').textContent = `平时 ${fmtYuan(r.usualPerDay)}`;
  document.getElementById('roi-saved').textContent = r.saved >= 0 ? fmtYuan(r.saved) : fmtYuan(r.saved);
  document.getElementById('roi-compare-save').textContent = r.saved >= 0 ? `省 ${fmtYuan(r.saved)}` : `多花 ${fmtYuan(-r.saved)}`;

  document.getElementById('roi-usual-daily').textContent = fmtYuan(r.usualPerDay) + ' / 天';
  document.getElementById('roi-batch-daily').textContent = fmtYuan(r.perDay) + ' / 天';

  // 进度条
  const fill = document.getElementById('roi-bar-fill');
  fill.classList.remove('green', 'warn', 'bad');
  fill.classList.add(r.level === 'good' ? 'green' : r.level === 'warn' ? 'warn' : 'bad');
  const max = Math.max(r.usualPerDay, r.perDay, 0.01);
  const widthPct = Math.max(8, Math.min(100, (r.perDay / max) * 100));
  fill.style.width = widthPct + '%';

  document.getElementById('roi-tip-days').textContent = r.days;
}

function addToCartFromRoi() {
  if (!roiData) return;
  const r = roiData;
  const p = r.product;
  // 检查是否已存在
  const exist = CART.find(c => c.productId === p.id);
  if (exist) {
    exist.qty += r.batchQty;
    exist.total += r.total;
    exist.addedAt = new Date().toISOString();
  } else {
    CART.push({
      productId: p.id,
      name: p.name,
      unit: p.unit,
      qty: r.batchQty,
      total: r.total,
      addedAt: new Date().toISOString(),
    });
  }
  saveCart();
  renderCartBadge();
  toast('已加入采购清单');
  // 跳到清单
  setTimeout(() => {
    renderCart();
    showScreen('cart');
  }, 600);
}

function renderCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (CART.length === 0) {
    badge.style.display = 'none';
  } else {
    badge.style.display = 'block';
    badge.textContent = CART.length;
  }
}

function renderCart() {
  const list = document.getElementById('cart-list');
  const empty = document.getElementById('cart-empty');
  const clearBtn = document.getElementById('btn-cart-clear');
  const total = CART.reduce((s, c) => s + c.total, 0);
  const count = CART.reduce((s, c) => s + c.qty, 0);
  document.getElementById('cart-summary').textContent = `${count} 件待采购`;
  document.getElementById('cart-total').textContent = fmtYuan(total);
  if (CART.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    clearBtn.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  clearBtn.style.display = 'flex';
  list.innerHTML = CART.map((c, i) => `
    <div class="cart-item" data-idx="${i}">
      <div class="em">${guessEmoji(c.name)}</div>
      <div class="info">
        <div class="n">${escapeHtml(c.name)}</div>
        <div class="m">${c.qty} ${c.unit} · 添加于 ${fmtTime(c.addedAt)}</div>
      </div>
      <div class="price">${fmtYuan(c.total)}</div>
      <button class="cart-remove" data-idx="${i}">移除</button>
    </div>
  `).join('');
  list.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      CART.splice(idx, 1);
      saveCart();
      renderCart();
      renderCartBadge();
      toast('已移除');
    });
  });
}

function fmtTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d)) return '--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function clearCart() {
  confirmDialog({
    title: '清空清单',
    body: '确定清空采购清单吗?',
    confirmText: '清空',
    danger: true,
    onConfirm: () => {
      CART = [];
      saveCart();
      renderCart();
      renderCartBadge();
      toast('已清空');
    },
  });
}

/* ------------------------------------------------------------
   14. 后台剪贴板自动检测
   ------------------------------------------------------------ */
function setupClipboardAutoDetect() {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (currentScreen !== 'gemini' && currentScreen !== 'scan') return;
    const res = await readClipboard();
    if (!res.ok || !res.value) return;
    const txt = res.value;
    // 简单启发式:长度 1-50,含中文/英文字符,不是明显价格
    if (txt.length < 1 || txt.length > 50) return;
    if (/^[\d.,¥$￥]+$/.test(txt)) return;  // 跳过纯数字
    if (currentScreen === 'gemini' || currentScreen === 'scan') {
      openPaste({ name: txt });
      toast('已从剪贴板读入');
    }
  });
}

/* ------------------------------------------------------------
   15. 事件绑定
   ------------------------------------------------------------ */
function bindEvents() {
  // ===== 首页 =====
  document.getElementById('btn-scan').addEventListener('click', openScan);
  document.getElementById('btn-manual').addEventListener('click', () => openManual());
  document.getElementById('btn-go-cart').addEventListener('click', () => {
    renderCart();
    showScreen('cart');
  });

  // ===== 拍照页 =====
  document.getElementById('btn-scan-cancel').addEventListener('click', () => showScreen('home'));
  document.getElementById('btn-scan-manual').addEventListener('click', () => openManual());
  document.getElementById('camera-input').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleCameraFile(f);
  });
  document.getElementById('btn-go-gemini').addEventListener('click', () => {
    hideScanSheet();
    openGemini();
  });
  document.getElementById('btn-go-manual').addEventListener('click', () => {
    hideScanSheet();
    openManual();
  });
  document.getElementById('btn-sheet-cancel').addEventListener('click', hideScanSheet);
  document.getElementById('sheet-backdrop').addEventListener('click', hideScanSheet);

  // ===== Gemini 引导页 =====
  document.getElementById('btn-gemini-back').addEventListener('click', () => goBack() || showScreen('home'));
  document.getElementById('btn-copy-prompt').addEventListener('click', async () => {
    const ok = await copyToClipboard(lastPrompt);
    toast(ok ? '已复制' : '复制失败,请手动长按选择');
  });
  document.getElementById('btn-open-gemini').addEventListener('click', openGeminiApp);
  document.getElementById('btn-paste-manual').addEventListener('click', () => openPaste());
  document.getElementById('link-install-gemini').addEventListener('click', (e) => {
    e.preventDefault();
    window.open('https://gemini.google.com/app', '_blank');
  });

  // ===== 详情页 =====
  document.getElementById('btn-detail-back').addEventListener('click', () => goBack() || showScreen('home'));
  document.getElementById('btn-qty-minus').addEventListener('click', () => changeQty(-1));
  document.getElementById('btn-qty-plus').addEventListener('click', () => changeQty(1));
  document.getElementById('btn-qty-save').addEventListener('click', saveQty);
  document.getElementById('detail-qty-direct').addEventListener('input', (e) => directInputQty(e.target.value));
  document.getElementById('btn-edit-product').addEventListener('click', openEdit);
  document.getElementById('btn-delete-product').addEventListener('click', deleteCurrentProduct);
  document.getElementById('btn-go-roi').addEventListener('click', openCalc);

  // ===== ROI 结果页 =====
  document.getElementById('btn-roi-back').addEventListener('click', () => showScreen('detail', { pushHistory: false }));
  document.getElementById('btn-recalc').addEventListener('click', openCalc);
  document.getElementById('btn-add-list').addEventListener('click', addToCartFromRoi);

  // ===== 计算器 =====
  document.getElementById('btn-calc-back').addEventListener('click', () => showScreen('detail', { pushHistory: false }));
  document.getElementById('btn-calc-go').addEventListener('click', computeRoi);

  // ===== 粘贴页 =====
  document.getElementById('btn-paste-back').addEventListener('click', () => goBack() || showScreen('home'));
  document.getElementById('btn-paste-from-clip').addEventListener('click', handlePasteFromClip);
  document.getElementById('btn-paste-next').addEventListener('click', nextFromPaste);

  // ===== 手动输入 =====
  document.getElementById('btn-manual-back').addEventListener('click', () => goBack() || showScreen('home'));
  document.getElementById('btn-manual-save').addEventListener('click', saveManual);
  const nameInput = document.getElementById('manual-name');
  const debouncedSuggest = debounce(refreshManualSuggestions, 200);
  nameInput.addEventListener('input', debouncedSuggest);
  document.getElementById('manual-unit').addEventListener('input', (e) => {
    document.getElementById('manual-unit-label').textContent = e.target.value || '件';
  });

  // ===== 编辑 =====
  document.getElementById('btn-edit-back').addEventListener('click', () => showScreen('detail', { pushHistory: false }));
  document.getElementById('btn-edit-save').addEventListener('click', saveEdit);
  document.getElementById('btn-edit-delete').addEventListener('click', () => {
    confirmDialog({
      title: '删除产品',
      body: '确定删除此产品及其所有历史记录吗?',
      confirmText: '删除',
      danger: true,
      onConfirm: () => {
        const p = PRODUCTS.find(x => x.id === currentProductId);
        if (!p) return;
        PRODUCTS = PRODUCTS.filter(x => x.id !== currentProductId);
        saveProducts();
        currentProductId = null;
        renderHome();
        showScreen('home', { pushHistory: false });
        toast('已删除');
      },
    });
  });

  // ===== 采购清单 =====
  document.getElementById('btn-cart-back').addEventListener('click', () => {
    // 采购清单的"返回" = 回首页(从 ROI 跳转过来的侧向分支)
    // 同时清理堆栈,避免后续 back 路由混乱
    while (screenHistory.length > 0) screenHistory.pop();
    screenHistory.push('home');
    showScreen('home', { pushHistory: false });
  });
  document.getElementById('btn-cart-clear').addEventListener('click', clearCart);

  // ===== 历史管理页 =====
  document.getElementById('btn-manage-history').addEventListener('click', openHistoryPage);
  document.getElementById('btn-history-back').addEventListener('click', () => {
    showScreen('detail', { pushHistory: false });
  });
  document.getElementById('hist-edit-cancel').addEventListener('click', closeHistEditor);
  document.getElementById('hist-edit-save').addEventListener('click', saveHistEditor);
  document.getElementById('hist-edit-delete').addEventListener('click', deleteHistEditor);
  document.getElementById('hist-edit-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'hist-edit-backdrop') closeHistEditor();
  });

  // ===== 长按菜单 =====
  document.getElementById('lp-edit').addEventListener('click', () => {
    const id = longPressTargetId;
    hideLongPressMenu();
    if (id) { currentProductId = id; openEdit(); }
  });
  document.getElementById('lp-delete').addEventListener('click', () => {
    const id = longPressTargetId;
    hideLongPressMenu();
    if (id) {
      currentProductId = id;
      deleteCurrentProduct();
    }
  });
  document.getElementById('lp-cancel').addEventListener('click', hideLongPressMenu);
  document.getElementById('longpress-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'longpress-backdrop') hideLongPressMenu();
  });

  // 浏览器返回(手势)
  window.addEventListener('popstate', () => {
    if (goBack()) return;
    showScreen('home', { pushHistory: false });
  });
}

/* ------------------------------------------------------------
   16. 启动
   ------------------------------------------------------------ */
function init() {
  loadData();
  bindEvents();
  setupClipboardAutoDetect();
  renderHome();
  showScreen('home', { pushHistory: false });
  // 设置默认日期
  document.querySelectorAll('input[type="date"]').forEach(inp => {
    if (!inp.value) inp.value = todayStr();
  });
  // 调试入口(可选)
  window.__jd = {
    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CART_KEY);
      location.reload();
    },
    seed: () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CART_KEY);
      location.reload();
    },
    state: () => ({ products: PRODUCTS, cart: CART }),
  };
}

document.addEventListener('DOMContentLoaded', init);
