/* ===========================================================
   家当管家 v1 · 业务逻辑
   =========================================================== */

/* ------------------------------------------------------------
   1. 常量 & 工具
   ------------------------------------------------------------ */
const STORAGE_KEY = 'jiadang_products_v1';
const CATEGORIES_KEY = 'jiadang_categories_v2';  // V2: 分类作为独立实体
const IMAGES_KEY = 'jiadang_images_v2';          // V2: 用户上传的图
const CART_KEY = 'jiadang_cart_v1';
const PROMPT_KEY = 'jiadang_last_prompt_v1';

/* V2: 内置分类(name, emoji, color),初始创建用 */
const BUILTIN_CATEGORIES = [
  { name: '乳制品',    emoji: '🥛', color: '#fce7f3' },
  { name: '饮料',      emoji: '🥤', color: '#dbeafe' },
  { name: '食品',      emoji: '🍚', color: '#fef3c7' },
  { name: '调料',      emoji: '🧂', color: '#fed7aa' },
  { name: '清洁用品',  emoji: '🧴', color: '#e0e7ff' },
  { name: '生活用纸',  emoji: '🧻', color: '#ede9fe' },
  { name: '个护',      emoji: '🪥', color: '#fce7f3' },
  { name: '其他',      emoji: '📦', color: '#f1f5f9' },
];

/* V2: 按分类的 emoji 范本库(8-12 个/分类) */
const EMOJI_LIBRARY = {
  '乳制品':   ['🥛', '🍶', '🧈', '🍼', '🧀', '🥫', '🍨', '🍦'],
  '饮料':     ['🥤', '🍵', '☕', '🧃', '🧋', '🍺', '🍷', '🥃', '🧊', '💧'],
  '食品':     ['🍚', '🍞', '🍜', '🥚', '🍪', '🍫', '🍩', '🥯', '🥖', '🧇', '🥞', '🍯'],
  '调料':     ['🧂', '🍯', '🫒', '🌶', '🧄', '🧅', '🥫', '🍯', '🥄', '🫙'],
  '清洁用品': ['🧴', '🧽', '🪣', '🧹', '🧺', '🧼', '🪒', '🚿', '🧯', '🪥'],
  '生活用纸': ['🧻', '🧷', '🧺', '📄', '🗞', '🧽', '🪣', '🧴'],
  '个护':     ['🪥', '🧴', '🧼', '🧽', '🪒', '💄', '💅', '🧖', '🛁', '🧴'],
  '其他':     ['📦', '🎁', '🛍', '🧰', '🔧', '💡', '🪴', '🧸'],
};

/* V1 兼容: 旧代码用 CATEGORIES 作为字符串数组, V2 里调用 compat list */
const CATEGORIES = BUILTIN_CATEGORIES.map(c => c.name);

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
  // V2: 加载分类 + 图片库
  loadCategories();
  loadImages();
  // V2: 老数据迁移(category 字符串 → categoryId)
  migrateV1ToV2();
  // 第一次启动时,把种子数据写回(让用户看到默认 3 件)
  if (!localStorage.getItem(STORAGE_KEY)) {
    saveProducts();
    saveCategories();
  }
}

/* V2 分类库 */
let CATEGORIES_DB = [];   // [{id, name, emoji, color, builtin}]
let IMAGES_DB = [];       // [{id, dataUrl, createdAt, usedCount}]

function loadCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    CATEGORIES_DB = raw ? JSON.parse(raw) : [];
  } catch (e) { CATEGORIES_DB = []; }
  if (CATEGORIES_DB.length === 0) {
    // 首次:建 8 个内置分类
    CATEGORIES_DB = BUILTIN_CATEGORIES.map(c => ({
      id: 'cat_' + uid(),
      name: c.name,
      emoji: c.emoji,
      color: c.color,
      builtin: true,
    }));
    saveCategories();
  }
}

function saveCategories() {
  try { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(CATEGORIES_DB)); }
  catch (e) { console.warn('save categories failed', e); }
}

function getCategoryById(id) {
  return CATEGORIES_DB.find(c => c.id === id);
}
function getCategoryByName(name) {
  return CATEGORIES_DB.find(c => c.name === name);
}
function getCategoryEmoji(id) {
  const c = getCategoryById(id);
  return c ? c.emoji : '📦';
}

function loadImages() {
  try {
    const raw = localStorage.getItem(IMAGES_KEY);
    IMAGES_DB = raw ? JSON.parse(raw) : [];
  } catch (e) { IMAGES_DB = []; }
}

function saveImages() {
  try { localStorage.setItem(IMAGES_KEY, JSON.stringify(IMAGES_DB)); }
  catch (e) { console.warn('save images failed', e); }
}

function getImageById(id) {
  return IMAGES_DB.find(i => i.id === id);
}

/* V1 → V2 迁移 */
function migrateV1ToV2() {
  let changed = false;
  for (const p of PRODUCTS) {
    // 1) 老 category 字符串 → categoryId
    if (p.category !== undefined && p.categoryId === undefined) {
      let cat = getCategoryByName(p.category);
      if (!cat) {
        // 异常名字,归到"其他"
        cat = getCategoryByName('其他') || CATEGORIES_DB[0];
      }
      p.categoryId = cat.id;
      delete p.category;
      changed = true;
    }
    // 2) 保证 emoji / imageId 字段存在
    if (p.emoji === undefined) p.emoji = null;
    if (p.imageId === undefined) p.imageId = null;
  }
  if (changed) saveProducts();
  // 3) V2.1: 补 lastStockUpdate 和 stockLog
  migrateV2ToV2p1();
  // 4) V2.2: 补 packSize/packUnit/usageAmount/usagePeriodDays
  migrateV2p1ToV2p2();
}

/* V2.1 → V2.2: 加最小单位 + 使用频率字段 */
function migrateV2p1ToV2p2() {
  let changed = false;
  for (const p of PRODUCTS) {
    if (p.packSize === undefined) { p.packSize = 1; changed = true; }
    if (p.packUnit === undefined) { p.packUnit = null; changed = true; }
    if (p.usageAmount === undefined) { p.usageAmount = 0; changed = true; }
    if (p.usagePeriodDays === undefined) { p.usagePeriodDays = 1; changed = true; }
  }
  if (changed) saveProducts();
}

/* V2 → V2.1 迁移:加 lastStockUpdate 和 stockLog */
function migrateV2ToV2p1() {
  let changed = false;
  for (const p of PRODUCTS) {
    if (p.lastStockUpdate === undefined) {
      // 初始 = 最后一个 history 条目的 date, 或今天
      const hist = p.history || [];
      let lastDate = todayStr();
      if (hist.length > 0) {
        // 取最新一条
        const sorted = [...hist].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        lastDate = sorted[0].date || lastDate;
      }
      p.lastStockUpdate = lastDate;
      changed = true;
    }
    if (!p.stockLog) {
      // 从 history 推一条初始 log
      p.stockLog = [];
      if (p.history && p.history.length > 0) {
        // 只插一条"初始采购"表示这个数量是什么时候到位的
        const last = [...p.history].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
        p.stockLog.push({
          date: last.date || p.lastStockUpdate,
          delta: last.qty || p.qty,
          reason: 'purchase',
          note: '历史记录迁移',
          balance: p.qty,
        });
      }
      changed = true;
    }
  }
  if (changed) saveProducts();
}

/* V2.1: 推一条 stockLog(不保存,调用方自己 save) */
function pushStockLog(p, delta, reason, note = '') {
  if (!p.stockLog) p.stockLog = [];
  const balance = Math.max(0, p.qty);
  p.stockLog.push({
    date: todayStr(),
    delta,
    reason,
    note,
    balance,
  });
}

/* 采购入库专用(同写 purchaseHistory + stockLog) */
function recordPurchase(p, qty, price, date) {
  p.history = p.history || [];
  p.history.push({ date, qty, price });
  // 重算 star
  const prices = p.history.map(h => h.price);
  const min = Math.min(...prices);
  p.history.forEach(h => { h.star = (h.price === min); });
  p.qty = (p.qty || 0) + qty;
  p.lastStockUpdate = date;
  p.usualPrice = price;
  pushStockLog(p, qty, 'purchase');
  saveProducts();
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
      category: '乳制品',  // 迁移时会自动转 categoryId
      emoji: '🥛',
      imageId: null,
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
      emoji: '🧴',
      imageId: null,
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
      emoji: '🥤',
      imageId: null,
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

/* V2.1: 计算从 lastStockUpdate 到今天过了几天 */
function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d)) return 0;
  const now = new Date();
  const diffMs = now - d;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/* V2.1: 重写预计剩余天数,使用 lastStockUpdate
   剩余总天数 = qty * cycle - days_since,最低 0 */
function getForecastDays(p) {
  if (!p.cycle || p.cycle <= 0) return null;
  const passed = daysSince(p.lastStockUpdate);
  // V2.2: 区分可计量 vs 不可计量
  const ps = p.packSize && p.packSize > 0 ? p.packSize : 1;
  const amt = p.usageAmount && p.usageAmount > 0 ? p.usageAmount : 0;
  const period = p.usagePeriodDays && p.usagePeriodDays > 0 ? p.usagePeriodDays : 1;
  if (amt > 0) {
    // 可计量:剩余天数 = qty * packSize * periodDays / usageAmount
    const totalMin = p.qty * ps;       // 剩余最小单位数
    const totalDays = (totalMin * period) / amt;
    return Math.max(0, Math.floor(totalDays - passed));
  } else {
    // 不可计量(老逻辑)
    const totalDays = p.qty * p.cycle;
    return Math.max(0, totalDays - passed);
  }
}

/* V2.2: 是否有最小单位(供 UI 判断) */
function hasMinUnit(p) {
  return !!(p.packSize && p.packSize > 1 && p.packUnit);
}

/* V2.2: 是否可计量 */
function isMeasurable(p) {
  return !!(p.usageAmount && p.usageAmount > 0);
}

/* V2.2: 获取"主单位下的剩余数量"显示文本 */
function getQtyText(p) {
  if (hasMinUnit(p)) {
    const total = (p.qty || 0) * p.packSize;
    return `${formatNum(total)} ${p.packUnit}`;
  }
  return `${formatNum(p.qty || 0)} ${p.unit}`;
}

function formatNum(n) {
  if (n == null) return '0';
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(2)).toString();
}

/* V2.1: 重写状态计算,使用新公式 */
function getStatus(p) {
  if (!p.cycle || p.cycle <= 0) return 'ok';
  const days = getForecastDays(p);
  if (days == null) return 'ok';
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
const SCREENS = ['home', 'scan', 'gemini', 'detail', 'roi', 'paste', 'calc', 'manual', 'edit', 'cart', 'history', 'icon-picker', 'stock-log'];
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

  // V2: 同步当前产品的图标预览
  refreshCurrentProductIconUI(name);
}

function refreshCurrentProductIconUI(screenName) {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  if (screenName === 'manual') {
    const preview = document.getElementById('manual-icon-preview');
    if (preview) {
      // 如果有 imageId 用 img,否则用 emoji
      if (p.imageId) {
        const img = getImageById(p.imageId);
        if (img) {
          preview.innerHTML = '';
          const im = document.createElement('img');
          im.src = img.dataUrl;
          im.style.cssText = 'width:22px;height:22px;object-fit:cover;border-radius:4px;';
          preview.appendChild(im);
          return;
        }
      }
      preview.textContent = p.emoji || (p.categoryId && getCategoryEmoji(p.categoryId)) || guessEmoji(p.name);
    }
  } else if (screenName === 'edit') {
    const preview = document.getElementById('edit-icon-preview');
    if (preview) {
      if (p.imageId) {
        const img = getImageById(p.imageId);
        if (img) {
          preview.innerHTML = '';
          const im = document.createElement('img');
          im.src = img.dataUrl;
          im.style.cssText = 'width:22px;height:22px;object-fit:cover;border-radius:4px;';
          preview.appendChild(im);
          return;
        }
      }
      preview.textContent = p.emoji || (p.categoryId && getCategoryEmoji(p.categoryId)) || guessEmoji(p.name);
    }
  }
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
  'icon-picker': null,  // 动态: 可能是 manual / edit / detail
  'stock-log': 'detail',
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
  const icon = getProductIcon(p);
  const statusText = getStatusText(p);
  const daysText = days != null
    ? (hasMinUnit(p)
        ? `剩 ${formatNum((p.qty || 0) * p.packSize)} ${p.packUnit} · 预计 ${days} 天后用完`
        : `剩 ${formatNum(p.qty || 0)} ${p.unit} · 预计 ${days} 天后用完`)
    : (hasMinUnit(p)
        ? `剩 ${formatNum((p.qty || 0) * p.packSize)} ${p.packUnit}`
        : `剩 ${formatNum(p.qty || 0)} ${p.unit}`);
  const maxDays = 7;
  const progressPct = days == null ? 100 : Math.max(8, Math.min(100, (days / maxDays) * 100));

  return `
    <div class="product-card" data-id="${p.id}">
      <div class="emoji">${icon}</div>
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

/* V2: 产品头像渲染
   优先级: imageId(自定义图) > product.emoji > category.emoji > guessEmoji(name) */
function getProductIcon(p) {
  // 1) 自定义图
  if (p.imageId) {
    const img = getImageById(p.imageId);
    if (img) {
      return `<img class="product-icon-img" src="${escapeHtml(img.dataUrl)}" alt="">`;
    }
  }
  // 2) 产品 emoji
  if (p.emoji) return p.emoji;
  // 3) 分类 emoji
  if (p.categoryId) {
    const c = getCategoryById(p.categoryId);
    if (c && c.emoji) return c.emoji;
  }
  // 4) 终极兑底
  return guessEmoji(p.name);
}

function renderProductIconLarge(p) {
  // 同 getProductIcon, 但不限制为 product-card 的 size
  if (p.imageId) {
    const img = getImageById(p.imageId);
    if (img) return `<img class="product-icon-img" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" src="${escapeHtml(img.dataUrl)}" alt="">`;
  }
  if (p.emoji) return p.emoji;
  if (p.categoryId) {
    const c = getCategoryById(p.categoryId);
    if (c && c.emoji) return c.emoji;
  }
  return guessEmoji(p.name);
}

/* V2: 在指定容器里渲染产品头像(图 / emoji) */
function renderProductEmojiBox(containerId, p) {
  const el = document.getElementById(containerId);
  if (!el) return;
  // 清除旧内容
  while (el.firstChild) el.removeChild(el.firstChild);
  if (p.imageId) {
    const img = getImageById(p.imageId);
    if (img) {
      const im = document.createElement('img');
      im.src = img.dataUrl;
      im.alt = '';
      im.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:14px;';
      el.appendChild(im);
      return;
    }
  }
  el.textContent = p.emoji || (p.categoryId && getCategoryEmoji(p.categoryId)) || guessEmoji(p.name);
}

/* V2: 图片处理 —— file -> base64 -> 200x200 jpeg 0.7 */
function fileToCompressedDataURL(file, maxSize = 200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 缩到 maxSize
        const canvas = document.createElement('canvas');
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > h) {
          if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
        } else {
          if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
        }
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  renderProductEmojiBox('detail-emoji', p);
  // 让头像可点 → 改图标
  const detEmoji = document.getElementById('detail-emoji');
  if (detEmoji) {
    detEmoji.style.cursor = 'pointer';
    detEmoji.onclick = () => openIconPicker();
  }
  document.getElementById('detail-name').textContent = p.name;
  const cat = p.categoryId ? getCategoryById(p.categoryId) : null;
  document.getElementById('detail-cat').textContent = `${cat ? cat.name : ''} · ${p.unit}`;
  // V2.2: 剩余数量 — 有 packSize 时显示"剩 X 片"
  if (hasMinUnit(p)) {
    const totalMin = (p.qty || 0) * p.packSize;
    document.getElementById('detail-qty').textContent = formatNum(totalMin);
    document.getElementById('detail-unit').textContent = p.packUnit;
    // 补一个"= X 包"的子标
    const subEl = document.getElementById('detail-qty-sub') || (() => {
      const span = document.createElement('span');
      span.id = 'detail-qty-sub';
      span.style.cssText = 'font-size:11px; color:var(--ink-3); margin-left:6px; font-weight:400;';
      document.getElementById('detail-qty').parentNode.appendChild(span);
      return span;
    })();
    subEl.textContent = `= ${formatNum(p.qty || 0)} ${p.unit}`;
  } else {
    document.getElementById('detail-qty').textContent = formatNum(p.qty || 0);
    document.getElementById('detail-unit').textContent = p.unit;
    const subEl = document.getElementById('detail-qty-sub');
    if (subEl) subEl.remove();
  }
  // 上次盘点日期
  document.getElementById('detail-last-update').textContent = p.lastStockUpdate || '--';

  // V2.1: 预测(用 lastStockUpdate 真实倒数)
  const days = getForecastDays(p);
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

  // V2.1: 库存记录预览(最近 3 条)
  renderStockLogPreview(p);

  // 价格统计
  const stats = getPriceStats(p);
  if (stats) {
    const hasMu = hasMinUnit(p);
    const setPrice = (id, price) => {
      if (hasMu) {
        const main = fmtYuan(price) + '/' + p.unit;
        const sub = (price / p.packSize).toFixed(2);
        document.getElementById(id).innerHTML = `${main}<div style="font-size:10px; color:var(--ink-3); font-weight:400; margin-top:2px;">¥${sub}/${p.packUnit}</div>`;
      } else {
        document.getElementById(id).textContent = fmtYuan(price);
      }
    };
    setPrice('detail-price-min', stats.min);
    document.getElementById('detail-price-min-date').textContent = fmtMonth(stats.minEntry.date);
    setPrice('detail-price-max', stats.max);
    document.getElementById('detail-price-max-date').textContent = fmtMonth(stats.lastEntry.date === stats.minEntry ? stats.lastEntry.date : stats.minEntry.date);
    setPrice('detail-price-last', stats.last.price);
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
    const hasMu = hasMinUnit(p);
    histEl.innerHTML = [...hist].reverse().map((h, i) => {
      const realIdx = hist.length - 1 - i;
      const subPrice = hasMu
        ? `<div style="font-size:9px; color:var(--ink-3); font-weight:400; margin-top:1px;">¥${(h.price / p.packSize).toFixed(2)}/${p.packUnit}</div>`
        : '';
      return `
      <div class="history-row clickable" data-idx="${realIdx}">
        <div class="date">${fmtDate(h.date)}</div>
        <div class="qty">${h.qty} ${p.unit}${hasMu ? ` <span style="font-size:9px; color:var(--ink-3);">(${h.qty * p.packSize} ${p.packUnit})</span>` : ''}</div>
        <div class="price">${h.star ? '<span class="star">⭐</span>' : ''}${fmtYuan(h.price)}${subPrice}</div>
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

/* V2.1: 库存记录预览(详情页底部) */
function renderStockLogPreview(p) {
  const el = document.getElementById('stock-log-preview');
  if (!el) return;
  const log = p.stockLog || [];
  if (log.length === 0) {
    el.innerHTML = '<div class="history-empty">暂无记录</div>';
    return;
  }
  const recent = [...log].reverse().slice(0, 3);
  el.innerHTML = recent.map(e => renderStockLogRow(e, p)).join('');
  // 不绑事件(预览不可点 → 跳全列表)
}

function renderStockLogRow(e, p) {
  const inOut = e.delta >= 0;
  const sign = inOut ? '+' : '';
  return `
    <div class="stock-log-row">
      <div class="delta ${inOut ? 'in' : 'out'}">${sign}${e.delta}</div>
      <div class="info">
        <div class="top">${stockLogReasonText(e.reason)}${e.note ? ' · ' + escapeHtml(e.note) : ''}</div>
        <div class="sub">${fmtDate(e.date)}</div>
      </div>
      <div class="bal">余额 ${e.balance} ${p.unit}</div>
    </div>
  `;
}

function stockLogReasonText(r) {
  const map = {
    purchase: '📥 补货入库',
    consumed: '🍽 日常消耗',
    correction: '✏️ 修正实际数量',
    expired: '🗑 已用完/过期',
  };
  return map[r] || r;
}

/* V2.1: 打开调整数量模态 */
function openAdjustModal() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  const hasMu = hasMinUnit(p);
  document.getElementById('adjust-product-name').textContent = p.name + ' · ' + p.unit;
  // V2.2: 有 packSize 时显示"= X 包"
  if (hasMu) {
    document.getElementById('adjust-current').textContent = `${formatNum(p.qty)} ${p.unit} (= ${formatNum(p.qty * p.packSize)} ${p.packUnit})`;
  } else {
    document.getElementById('adjust-current').textContent = `${formatNum(p.qty)} ${p.unit}`;
  }
  document.getElementById('adjust-qty').value = p.qty;
  // V2.2: 单位标签
  document.getElementById('adjust-qty-unit').textContent = p.unit;
  document.getElementById('adjust-note').value = '';
  // 默认选“日常消耗”
  document.querySelector('input[name="adjust-reason"][value="consumed"]').checked = true;
  // V2.2: 单位选择 radio(有 packSize 才显示)
  const unitRadioBlock = document.getElementById('adjust-unit-radio-block');
  if (hasMu) {
    unitRadioBlock.style.display = 'block';
    document.getElementById('adjust-unit-main-label').textContent = `主单位(${p.unit})`;
    document.getElementById('adjust-unit-min-label').textContent = `最小单位(${p.packUnit})`;
    document.querySelector('input[name="adjust-unit"][value="main"]').checked = true;
  } else {
    unitRadioBlock.style.display = 'none';
  }
  document.getElementById('adjust-backdrop').style.display = 'flex';
  document.getElementById('adjust-qty').focus();
}

function closeAdjustModal() {
  document.getElementById('adjust-backdrop').style.display = 'none';
}

function changeAdjustQty(delta) {
  const inp = document.getElementById('adjust-qty');
  const cur = parseFloat(inp.value) || 0;
  const next = Math.max(0, Number((cur + delta).toFixed(2)));
  inp.value = next;
}

function saveAdjust() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  let inputVal = parseFloat(document.getElementById('adjust-qty').value);
  const reason = document.querySelector('input[name="adjust-reason"]:checked')?.value || 'correction';
  const note = document.getElementById('adjust-note').value.trim();
  if (isNaN(inputVal) || inputVal < 0) { toast('请填有效的数量'); return; }
  // V2.2: 按最小单位输入时,换算成主单位
  const hasMu = hasMinUnit(p);
  const unitChoice = document.querySelector('input[name="adjust-unit"]:checked')?.value || 'main';
  if (hasMu && unitChoice === 'min') {
    // 24 片 / 48 片每包 = 0.5 包
    inputVal = Number((inputVal / p.packSize).toFixed(4));
  }
  const delta = Number((inputVal - p.qty).toFixed(2));
  if (delta === 0) { toast('数量没变化'); closeAdjustModal(); return; }
  // 特殊:扔掉 → 强制归 0
  let finalQty = inputVal;
  if (reason === 'expired') finalQty = 0;
  const finalDelta = Number((finalQty - p.qty).toFixed(2));
  p.qty = finalQty;
  // lastStockUpdate 规则: 补货/修正/扔掉 → 今天; 日常消耗 → 不更新
  if (reason !== 'consumed') p.lastStockUpdate = todayStr();
  // 补货 → 也写 purchaseHistory(按主单位记)
  if (reason === 'purchase' && finalDelta > 0) {
    // 需要价格,弹个手输入
    const price = parseFloat(prompt(`这次补货的单价(每${p.unit})?(取消将不记录价格)`, p.usualPrice || ''));
    if (!isNaN(price) && price > 0) {
      p.history = p.history || [];
      p.history.push({ date: todayStr(), qty: finalDelta, price });
      const prices = p.history.map(h => h.price);
      const min = Math.min(...prices);
      p.history.forEach(h => { h.star = (h.price === min); });
      p.usualPrice = price;
    }
  }
  pushStockLog(p, finalDelta, reason, note);
  saveProducts();
  renderDetail();
  renderHome();
  closeAdjustModal();
  toast('已保存');
}

/* V2.1: 库存记录全列表页 */
function openStockLogPage() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  renderStockLogPage();
  showScreen('stock-log');
}

function renderStockLogPage() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  const log = p.stockLog || [];
  document.getElementById('stocklog-sub').textContent = `${p.name} · 共 ${log.length} 条记录`;
  const list = document.getElementById('stocklog-list');
  const empty = document.getElementById('stocklog-empty');
  if (log.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  // 时间倒序
  const sorted = [...log].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  list.innerHTML = sorted.map((e, i) => {
    const realIdx = log.length - 1 - sorted.findIndex(x => x === e);  // 倒序后的 index → 原始 index
    return renderStockLogRowWithData(realIdx, e, p);
  }).join('');
  list.querySelectorAll('.stock-log-row').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx, 10);
      openStockLogEditor(idx);
    });
  });
}

function renderStockLogRowWithData(idx, e, p) {
  const inOut = e.delta >= 0;
  const sign = inOut ? '+' : '';
  return `
    <div class="stock-log-row" data-idx="${idx}">
      <div class="delta ${inOut ? 'in' : 'out'}">${sign}${e.delta}</div>
      <div class="info">
        <div class="top">${stockLogReasonText(e.reason)}${e.note ? ' · ' + escapeHtml(e.note) : ''}</div>
        <div class="sub">${fmtDate(e.date)}</div>
      </div>
      <div class="bal">余额 ${e.balance} ${p.unit}</div>
    </div>
  `;
}

/* V2.1: 库存记录编辑(简化版:只改备注/删除) */
let editingStockLogIdx = -1;
function openStockLogEditor(idx) {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p || !p.stockLog || !p.stockLog[idx]) return;
  editingStockLogIdx = idx;
  const e = p.stockLog[idx];
  // 复用 hist-edit modal (改个名称)
  document.getElementById('hist-edit-modal').querySelector('h3').textContent = '编辑库存记录';
  document.getElementById('hist-edit-date').value = e.date;
  document.getElementById('hist-edit-date').parentElement.parentElement.style.display = 'none';  // 隐藏日期
  document.getElementById('hist-edit-qty').value = e.delta;
  document.getElementById('hist-edit-qty').parentElement.parentElement.style.display = '';     // 显示 delta
  document.getElementById('hist-edit-qty').parentElement.querySelector('span').textContent = e.delta >= 0 ? '(变化量)' : '';
  document.getElementById('hist-edit-price').value = 0;
  document.getElementById('hist-edit-price').parentElement.parentElement.style.display = 'none';  // 隐藏价格
  // 加备注 input —— 但现有 modal 没这栏。简化: 只保留删除功能,改备注改成弹 prompt
  const note = prompt('备注(取消不改):', e.note || '');
  if (note !== null) {
    e.note = note;
    saveProducts();
    renderStockLogPage();
    renderDetail();
  }
  // 不用 modal,直接 prompt
  document.getElementById('hist-edit-modal').querySelector('h3').textContent = '编辑购买记录';  // 还原
}

function deleteStockLogEntry() {
  // 简化: 弹 confirm 删
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p || editingStockLogIdx < 0) return;
  const e = p.stockLog[editingStockLogIdx];
  if (!e) return;
  if (!confirm(`删除这条记录?\n${fmtDate(e.date)} · ${stockLogReasonText(e.reason)} · ${e.delta}`)) return;
  p.stockLog.splice(editingStockLogIdx, 1);
  saveProducts();
  renderStockLogPage();
  renderDetail();
  toast('已删除');
}

function openEdit() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  document.getElementById('edit-name').value = p.name;
  // select 里存的是分类名(保持 V1 兼容)
  const cat = p.categoryId ? getCategoryById(p.categoryId) : null;
  document.getElementById('edit-category').value = cat ? cat.name : '';
  document.getElementById('edit-unit').value = p.unit;
  document.getElementById('edit-cycle').value = p.cycle;
  document.getElementById('edit-usual-price').value = p.usualPrice || '';
  // V2.2: 最小单位 + 频率
  const hasMu = !!(p.packUnit);
  document.getElementById('edit-minunit-toggle').checked = hasMu;
  document.getElementById('edit-pack-size').value = p.packSize || 1;
  document.getElementById('edit-pack-unit').value = p.packUnit || '';
  document.getElementById('edit-usage-amount').value = p.usageAmount || 0;
  document.getElementById('edit-usage-period').value = p.usagePeriodDays || 1;
  updateMinUnitBlock('edit');
  syncUsageUnitLabel('edit');
  showScreen('edit');
}

function saveEdit() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  const newName = document.getElementById('edit-name').value.trim();
  const cycle = parseInt(document.getElementById('edit-cycle').value, 10);
  if (!newName) { toast('请填产品名称'); return; }
  if (!cycle || cycle <= 0) { toast('请填有效的使用周期'); return; }

  // 改名后检测是否撞同款
  if (newName !== p.name) {
    const dup = findByExactName(newName);
    if (dup && dup.id !== p.id) {
      // 弹合并确认
      confirmDialog({
        title: '已有同款产品',
        body: `家里已有“${newName}”了(剩 ${dup.qty} ${dup.unit},${dup.history?.length || 0} 条历史)。要合并到这个产品里吗?合并后另一个产品会删除。`,
        confirmText: '合并',
        onConfirm: () => doMergeProducts(p, dup, {
          name: newName,
          category: document.getElementById('edit-category').value,
          unit: document.getElementById('edit-unit').value.trim() || '件',
          cycle,
          usualPrice: parseFloat(document.getElementById('edit-usual-price').value) || p.usualPrice || 0,
        }),
      });
      return;
    }
  }

  // 普通保存
  const mu = readMinUnitFields('edit');
  applyEditToProduct(p, {
    name: newName,
    category: document.getElementById('edit-category').value,
    unit: document.getElementById('edit-unit').value.trim() || '件',
    cycle,
    usualPrice: parseFloat(document.getElementById('edit-usual-price').value) || p.usualPrice || 0,
  });
  // V2.2: 同步最小单位 + 频率
  p.packSize = mu.packSize;
  p.packUnit = mu.packUnit;
  p.usageAmount = mu.usageAmount;
  p.usagePeriodDays = mu.usagePeriodDays;
  saveProducts();
  renderDetail();
  showScreen('detail', { pushHistory: false });
  toast('已保存');
}

function applyEditToProduct(p, fields) {
  p.name = fields.name;
  // category 名字 → categoryId
  const cat = getCategoryByName(fields.category);
  if (cat) p.categoryId = cat.id;
  p.unit = fields.unit;
  p.cycle = fields.cycle;
  p.usualPrice = fields.usualPrice;
}

/* 合并两个产品:把 dup 的 qty + history + stockLog 合到 p 上,删 dup */
function doMergeProducts(p, dup, newFields) {
  // 更新 p 的元信息
  applyEditToProduct(p, newFields);
  // 合并 dup 的库存
  p.qty = (p.qty || 0) + (dup.qty || 0);
  // 合并历史(按日期排序)
  p.history = p.history || [];
  if (dup.history && dup.history.length > 0) {
    p.history = p.history.concat(dup.history);
    p.history.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
  // 合并 stockLog
  p.stockLog = p.stockLog || [];
  if (dup.stockLog && dup.stockLog.length > 0) {
    p.stockLog = p.stockLog.concat(dup.stockLog);
    p.stockLog.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
  // usualPrice 取两者中较新的(保留 p 的,只有 p 没设才用 dup 的)
  p.usualPrice = p.usualPrice || dup.usualPrice || 0;
  // lastStockUpdate 取较新的
  if (dup.lastStockUpdate && (!p.lastStockUpdate || dup.lastStockUpdate > p.lastStockUpdate)) {
    p.lastStockUpdate = dup.lastStockUpdate;
  }
  // 重算 star
  if (p.history.length > 0) {
    const prices = p.history.map(h => h.price);
    const min = Math.min(...prices);
    p.history.forEach(h => { h.star = (h.price === min); });
  }
  // 删 dup
  PRODUCTS = PRODUCTS.filter(x => x.id !== dup.id);
  saveProducts();
  renderHome();
  renderDetail();  // 重渲详情页(产品名/数量/历史都变了)
  showScreen('detail', { pushHistory: false });
  toast(`已合并,共 ${p.history.length} 条历史`);
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

  // V2.2: 最小单位 默认不勾
  const mToggle = document.getElementById('manual-minunit-toggle');
  if (mToggle) mToggle.checked = false;
  updateMinUnitBlock('manual');
  // 同步单位文字
  syncUsageUnitLabel('manual');

  // 候选
  refreshManualSuggestions();
  updateManualNewFields();

  showScreen('manual');
}

/* V2.2: 切换"最小单位"块显示 + 显示/隐藏 cycle 输入 */
function updateMinUnitBlock(prefix) {
  const toggle = document.getElementById(prefix + '-minunit-toggle');
  const block = document.getElementById(prefix + '-minunit-block');
  const cycleRow = document.getElementById(prefix + '-cycle-row');
  if (!toggle || !block || !cycleRow) return;
  const on = toggle.checked;
  block.style.display = on ? 'block' : 'none';
  // 勾上时,cycle 输入依然可见(作为不可计量的 fallback)
}

function syncUsageUnitLabel(prefix) {
  const packUnit = document.getElementById(prefix + '-pack-unit');
  const label = document.getElementById(prefix + '-usage-amount-unit');
  if (packUnit && label) {
    const u = packUnit.value.trim() || '份';
    label.textContent = u;
  }
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
      <span class="em">${getProductIcon(p)}</span>
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
    // 同款追加:可能顺便改 packSize(用户首次设了最小单位)
    const minUnit = readMinUnitFields('manual');
    if (minUnit.enabled) {
      p.packSize = minUnit.packSize;
      p.packUnit = minUnit.packUnit;
      p.usageAmount = minUnit.usageAmount;
      p.usagePeriodDays = minUnit.usagePeriodDays;
    }
    recordPurchase(p, qty, price, date);
    renderHome();
    goBackToHome();
    toast('已加入库存');
  } else {
    const unit = document.getElementById('manual-unit').value.trim() || guessUnit(name) || '件';
    const cycle = parseInt(document.getElementById('manual-cycle').value, 10) || 30;
    const category = document.getElementById('manual-category').value;
    const cat = getCategoryByName(category);
    const mu = readMinUnitFields('manual');
    const newP = {
      id: uid(),
      name,
      categoryId: cat ? cat.id : (CATEGORIES_DB[0] && CATEGORIES_DB[0].id),
      emoji: null,
      imageId: null,
      unit,
      cycle,
      packSize: mu.packSize,
      packUnit: mu.packUnit,
      usageAmount: mu.usageAmount,
      usagePeriodDays: mu.usagePeriodDays,
      qty: 0,         // 初始 0,再 recordPurchase 加
      lastStockUpdate: todayStr(),
      usualPrice: price,
      history: [],
      stockLog: [],
    };
    PRODUCTS.push(newP);
    recordPurchase(newP, qty, price, date);  // 加库存 + 写 history + 写 stockLog
    renderHome();
    goBackToHome();
    toast('已保存到库存');
  }
}

/* V2.2: 读 manual/edit 表单的最小单位 + 频率字段 */
function readMinUnitFields(prefix) {
  const toggle = document.getElementById(prefix + '-minunit-toggle');
  const on = !!(toggle && toggle.checked);
  const ps = parseInt(document.getElementById(prefix + '-pack-size').value, 10) || 1;
  const pu = (document.getElementById(prefix + '-pack-unit').value || '').trim();
  const amt = parseFloat(document.getElementById(prefix + '-usage-amount').value) || 0;
  const pd = parseInt(document.getElementById(prefix + '-usage-period').value, 10) || 1;
  if (on && pu) {
    return { enabled: true, packSize: ps, packUnit: pu, usageAmount: amt, usagePeriodDays: pd };
  }
  return { enabled: false, packSize: 1, packUnit: null, usageAmount: 0, usagePeriodDays: 1 };
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
        recordPurchase(exact, qty, price, date);
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
  // 复制 prompt 到剪贴板(以防万一)
  copyToClipboard(lastPrompt || defaultPrompt());
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
let lastPhotoFile = null;  // 原始文件(用来 share)
let pendingPasteFromShare = false;  // 从 Gemini 回来时,优先跳粘贴页

function openScan() {
  showScreen('scan');
  // 重置抽屉
  document.getElementById('scan-sheet').classList.remove('show');
  document.getElementById('sheet-backdrop').classList.remove('show');
  document.getElementById('scan-photo-preview').style.display = 'none';
  lastPhotoFile = null;
  lastPhotoDataUrl = null;
  pendingPasteFromShare = false;
}

function handleCameraFile(file) {
  if (!file) return;
  lastPhotoFile = file;
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

/* 用 Web Share API 调起系统分享面板(真机能用) */
async function shareToGemini(file, promptText) {
  // 1) 先复制 prompt 到剪贴板(不论后面是否成功)
  await copyToClipboard(promptText);

  // 2) 尝试系统级分享(图 + 文字)
  if (navigator.canShare && file) {
    try {
      // iOS Safari 要求 File 有 name
      const fileToShare = new File([file], file.name || 'product.jpg', { type: file.type || 'image/jpeg' });
      if (navigator.canShare({ files: [fileToShare] })) {
        await navigator.share({
          title: '识别这个产品',
          text: promptText,
          files: [fileToShare],
        });
        // 用户点完会回到 App,visibilitychange 会自动读剪贴板
        return { shared: true };
      }
    } catch (e) {
      if (e.name === 'AbortError') return { shared: false, cancelled: true };
      console.warn('share failed', e);
    }
  }
  return { shared: false, cancelled: false };
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
  renderProductEmojiBox('calc-emoji', p);
  document.getElementById('calc-name').textContent = p.name;
  const cat = p.categoryId ? getCategoryById(p.categoryId) : null;
  document.getElementById('calc-cat').textContent = `${cat ? cat.name : ''} · ${p.unit}`;
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
      <div class="em">${(() => { const prod = PRODUCTS.find(x => x.id === c.productId); return prod ? getProductIcon(prod) : guessEmoji(c.name); })()}</div>
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
   13.5 V2 — 图标选择器 + 上传
   ------------------------------------------------------------ */
let iconPickerReturnTo = null;  // 'manual' / 'edit' / 'detail' (关闭后返回)

function openIconPicker() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  // 记录返回点(返回按钮返回)
  iconPickerReturnTo = currentScreen;
  renderIconPickerContent();
  showScreen('icon-picker');
}

/* 重新渲染 picker 内容(不切屏,用在上传后刷新图库) */
function renderIconPickerContent() {
  const p = PRODUCTS.find(x => x.id === currentProductId);
  if (!p) return;
  document.getElementById('iconpicker-product').textContent = p.name;
  renderProductEmojiBox('iconpicker-current', p);

  // 拼 emoji 区:产品分类下的范本库
  const cat = p.categoryId ? getCategoryById(p.categoryId) : null;
  const catName = cat ? cat.name : '其他';
  const library = EMOJI_LIBRARY[catName] || EMOJI_LIBRARY['其他'];
  document.getElementById('emoji-section-title').textContent = `分类:${catName}`;
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = library.map(e => `
    <button class="emoji-cell" data-emoji="${e}">${e}</button>
  `).join('');
  grid.querySelectorAll('.emoji-cell').forEach(btn => {
    btn.addEventListener('click', () => {
      const e = btn.dataset.emoji;
      p.emoji = e;
      p.imageId = null;  // 选了 emoji 后清除自定义图
      saveProducts();
      renderProductEmojiBox('iconpicker-current', p);
      toast('已选 ' + e);
    });
  });

  // 自定义图区
  const customSection = document.getElementById('custom-section');
  const customGrid = document.getElementById('custom-grid');
  if (IMAGES_DB.length === 0) {
    customSection.style.display = 'none';
  } else {
    customSection.style.display = 'block';
    customGrid.innerHTML = IMAGES_DB.map(img => `
      <button class="emoji-cell image-cell" data-id="${img.id}">
        <img src="${escapeHtml(img.dataUrl)}" alt="">
      </button>
    `).join('');
    customGrid.querySelectorAll('.emoji-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        p.imageId = id;
        p.emoji = null;
        saveProducts();
        renderProductEmojiBox('iconpicker-current', p);
        toast('已用自定义图');
      });
    });
  }
}

async function handleImageUpload(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('请选择图片文件'); return; }
  try {
    const dataUrl = await fileToCompressedDataURL(file);
    const newImg = {
      id: 'img_' + uid(),
      dataUrl,
      createdAt: Date.now(),
      usedCount: 0,
    };
    IMAGES_DB.push(newImg);
    saveImages();
    // 立刻应用到当前产品
    const p = PRODUCTS.find(x => x.id === currentProductId);
    if (p) {
      p.imageId = newImg.id;
      p.emoji = null;
      saveProducts();
    }
    // 重新渲染 picker 内容
    renderIconPickerContent();
    toast('已上传');
  } catch (e) {
    console.error('upload failed', e);
    toast('上传失败,请重试');
  }
}

/* ------------------------------------------------------------
   14. 后台剪贴板自动检测
   ------------------------------------------------------------ */
function setupClipboardAutoDetect() {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (!pendingPasteFromShare) return;  // 只在 share 后的回来才处理

    pendingPasteFromShare = false;  // 重置

    // 试读剪贴板(权限可能拒,拒了就给提示)
    const res = await readClipboard();
    if (res.ok && res.value) {
      const txt = res.value;
      // 启发式:长度 1-50,含中文/英文字符,不是明显价格
      if (txt.length >= 1 && txt.length <= 50 && !/^[\d.,¥$￥]+$/.test(txt)) {
        openPaste({ name: txt });
        toast('已从剪贴板读入');
        return;
      }
    }
    // 读不到或者内容不对,还是跳到粘贴页(让用户手动粘)
    openPaste();
    toast('读不到剪贴板,长按输入框手动粘入', 2500);
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
  document.getElementById('btn-go-gemini').addEventListener('click', async () => {
    // 如果有拍的图,先试 Web Share(手机能调起系统分享面板)
    if (lastPhotoFile) {
      const res = await shareToGemini(lastPhotoFile, lastPrompt || defaultPrompt());
      if (res.shared) {
        pendingPasteFromShare = true;  // 标记:回来时要读剪贴板
        // 关抽屉 + 关拍照预览(不然回到 App 还看到拍图状态)
        hideScanSheet();
        // 留个 toast 提示 + 背景全黑,代表在等待分享结果
        document.getElementById('scan-photo-preview').style.display = 'none';
        toast('已调起分享,选 Gemini 后复制答案返回', 2500);
        return;  // 等用户从 Gemini 切回来,visibilitychange 走自动读剪贴板
      }
      if (res.cancelled) { return; }  // 用户取消,停在拍照页
    }
    // 电脑 / 不支持 share / 降级:走老路径——跳 Gemini 引导页(网页版)
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
  document.getElementById('btn-adjust-qty').addEventListener('click', openAdjustModal);
  document.getElementById('btn-manage-stock-log').addEventListener('click', openStockLogPage);
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

  // V2.2: 最小单位 toggle
  document.getElementById('manual-minunit-toggle').addEventListener('change', () => updateMinUnitBlock('manual'));
  document.getElementById('manual-pack-unit').addEventListener('input', () => syncUsageUnitLabel('manual'));
  document.getElementById('edit-minunit-toggle').addEventListener('change', () => updateMinUnitBlock('edit'));
  document.getElementById('edit-pack-unit').addEventListener('input', () => syncUsageUnitLabel('edit'));

  // ===== 编辑 =====
  document.getElementById('btn-edit-back').addEventListener('click', () => showScreen('detail', { pushHistory: false }));

  // V2: 图标选择器
  document.getElementById('btn-pick-manual-icon').addEventListener('click', () => {
    iconPickerReturnTo = 'manual';
    openIconPicker();
  });
  document.getElementById('btn-pick-edit-icon').addEventListener('click', () => {
    iconPickerReturnTo = 'edit';
    openIconPicker();
  });
  document.getElementById('btn-iconpicker-back').addEventListener('click', () => {
    const ret = iconPickerReturnTo;
    iconPickerReturnTo = null;
    if (ret === 'detail') {
      // 详情页需要重渲才能看到新头像
      renderDetail();
      showScreen('detail', { pushHistory: false });
    } else if (ret) {
      showScreen(ret, { pushHistory: false });
    } else {
      showScreen('home', { pushHistory: false });
    }
    renderHome();  // 主页列表也刷新
  });
  document.getElementById('upload-zone').addEventListener('click', () => {
    document.getElementById('upload-image-input').click();
  });
  document.getElementById('upload-image-input').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleImageUpload(f);
  });

  // V2.1: 调整数量 modal
  document.getElementById('adjust-minus').addEventListener('click', () => changeAdjustQty(-1));
  document.getElementById('adjust-plus').addEventListener('click', () => changeAdjustQty(1));
  document.getElementById('adjust-cancel').addEventListener('click', closeAdjustModal);
  document.getElementById('adjust-save').addEventListener('click', saveAdjust);
  document.getElementById('adjust-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'adjust-backdrop') closeAdjustModal();
  });
  // V2.1: 库存记录全列表
  document.getElementById('btn-stocklog-back').addEventListener('click', () => showScreen('detail', { pushHistory: false }));
  document.getElementById('btn-stocklog-add').addEventListener('click', openAdjustModal);
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
