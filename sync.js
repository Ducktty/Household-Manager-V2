/* V2.6: 数据同步
   - pull: 从云端拉取用户所有数据 → 写到本地 PRODUCTS / CATEGORIES_DB / IMAGES_DB / CART
   - push: 本地修改 → 后台 upsert 到云
   - 冲突:last-write-wins(updated_at) */
(function () {
  let syncInFlight = false;
  let lastSyncAt = 0;

  function getClient() {
    return window.supabaseClient;
  }
  function getUser() {
    return window.JDAuth?.getCurrentUser?.() || null;
  }

  async function pullAll() {
    const client = getClient();
    const user = await getUser();
    if (!client || !user) return;
    console.log('[sync] pulling for user', user.id);
    // 1. products
    const { data: products, error: pErr } = await client.from('products').select('*').eq('user_id', user.id);
    if (pErr) { console.error('[sync] pull products err', pErr); return; }
    // 2. categories
    const { data: cats, error: cErr } = await client.from('categories').select('*').eq('user_id', user.id);
    if (cErr) console.warn('[sync] pull categories err', cErr);
    // 3. images
    const { data: imgs, error: iErr } = await client.from('images').select('*').eq('user_id', user.id);
    if (iErr) console.warn('[sync] pull images err', iErr);
    // 4. cart
    const { data: cart, error: cartErr } = await client.from('cart_items').select('*').eq('user_id', user.id);
    if (cartErr) console.warn('[sync] pull cart err', cartErr);

    // 写到全局
    // 关键: 保持 PRODUCTS 引用,只改内容(否则闭包里的 PRODUCTS 变量没变,renderHome 还是空)
    if (Array.isArray(products)) {
      const newProducts = products.map(p => ({
        id: p.id, name: p.name,
        categoryId: p.category_id, emoji: p.emoji, imageId: p.image_id,
        unit: p.unit, cycle: p.cycle,
        packSize: p.pack_size, packUnit: p.pack_unit,
        usageAmount: p.usage_amount, usagePeriodDays: p.usage_period_days,
        qty: p.qty,
        lastStockUpdate: p.last_stock_update, lastOpenedAt: p.last_opened_at,
        usualPrice: p.usual_price, expiryDate: p.expiry_date,
        autoDecrement: p.auto_decrement,
        history: p.history || [], stockLog: p.stock_log || [],
        updated_at: p.updated_at,
      }));
      // 拿到 app.js 闭包里的 PRODUCTS 数组(通过全局函数)
      const ref = window.__getPRODUCTS?.();
      if (ref) {
        ref.length = 0;
        ref.push(...newProducts);
      } else {
        window.PRODUCTS = newProducts;
      }
    }
    if (Array.isArray(cats)) {
      const newCats = cats.map(c => ({
        id: c.id, name: c.name, emoji: c.emoji, color: c.color, builtin: c.builtin,
      }));
      const ref = window.__getCATEGORIES?.();
      if (ref) {
        ref.length = 0;
        ref.push(...newCats);
      } else {
        window.CATEGORIES_DB = newCats;
      }
    }
    if (Array.isArray(imgs)) {
      const newImgs = imgs.map(i => ({ id: i.id, dataUrl: i.data_url }));
      const ref = window.__getIMAGES?.();
      if (ref) {
        ref.length = 0;
        ref.push(...newImgs);
      } else {
        window.IMAGES_DB = newImgs;
      }
    }
    if (Array.isArray(cart)) {
      const newCart = cart.map(c => ({ productId: c.product_id, qty: c.qty, id: c.id }));
      const ref = window.__getCART?.();
      if (ref) {
        ref.length = 0;
        ref.push(...newCart);
      } else {
        window.CART = newCart;
      }
    }
    lastSyncAt = Date.now();
    console.log('[sync] pulled', products?.length, 'products');
  }

  async function pushAll() {
    const client = getClient();
    const user = await getUser();
    if (!client || !user) return;
    if (syncInFlight) { console.log('[sync] skip (in flight)'); return; }
    syncInFlight = true;
    try {
      // 1. categories
      if (Array.isArray(window.CATEGORIES_DB) && window.CATEGORIES_DB.length) {
        const rows = window.CATEGORIES_DB.map(c => ({
          id: c.id, user_id: user.id, name: c.name, emoji: c.emoji, color: c.color, builtin: c.builtin || false,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await client.from('categories').upsert(rows);
        if (error) console.warn('[sync] push categories err', error);
      }
      // 2. images
      if (Array.isArray(window.IMAGES_DB) && window.IMAGES_DB.length) {
        const rows = window.IMAGES_DB.map(i => ({
          id: i.id, user_id: user.id, data_url: i.dataUrl,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await client.from('images').upsert(rows);
        if (error) console.warn('[sync] push images err', error);
      }
      // 3. products
      if (Array.isArray(window.PRODUCTS) && window.PRODUCTS.length) {
        const rows = window.PRODUCTS.map(p => ({
          id: p.id, user_id: user.id,
          name: p.name, category_id: p.categoryId, emoji: p.emoji, image_id: p.imageId,
          unit: p.unit, cycle: p.cycle || 30,
          pack_size: p.packSize || 1, pack_unit: p.packUnit || null,
          usage_amount: p.usageAmount || 0, usage_period_days: p.usagePeriodDays || 1,
          qty: p.qty || 0,
          last_stock_update: p.lastStockUpdate, last_opened_at: p.lastOpenedAt,
          usual_price: p.usualPrice || 0, expiry_date: p.expiryDate || null,
          auto_decrement: p.autoDecrement || false,
          history: p.history || [], stock_log: p.stockLog || [],
          updated_at: new Date().toISOString(),
        }));
        const { error } = await client.from('products').upsert(rows);
        if (error) console.warn('[sync] push products err', error);
      }
      // 4. cart
      if (Array.isArray(window.CART) && window.CART.length) {
        // 先清后插(简单粗暴)
        await client.from('cart_items').delete().eq('user_id', user.id);
        const rows = window.CART.map(c => ({
          id: c.id || ('c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
          user_id: user.id, product_id: c.productId, qty: c.qty,
        }));
        const { error } = await client.from('cart_items').insert(rows);
        if (error) console.warn('[sync] push cart err', error);
      }
      lastSyncAt = Date.now();
      console.log('[sync] pushed');
    } catch (e) {
      console.error('[sync] push err', e);
    } finally {
      syncInFlight = false;
    }
  }

  async function deleteProduct(id) {
    const client = getClient();
    const user = await getUser();
    if (!client || !user) return;
    await client.from('products').delete().eq('id', id).eq('user_id', user.id);
  }

  function init() {
    const client = getClient();
    if (!client) return;
    // 监听登录状态变化
    client.auth.onAuthStateChange(async (event, session) => {
      console.log('[auth]', event, session?.user?.id);
      if (event === 'SIGNED_IN' && session) {
        // 拉取云端数据
        await pullAll();
        // 重新渲染
        if (typeof window.renderHome === 'function') {
          window.renderHome();
        }
        // 跳首页
        if (typeof window.showScreen === 'function') {
          window.showScreen('home', { pushHistory: false });
        }
        // 推本地到云(覆盖)
        setTimeout(() => pushAll(), 1000);
      } else if (event === 'SIGNED_OUT') {
        // 跳登录页
        if (typeof window.showScreen === 'function') {
          window.showScreen('login', { pushHistory: false });
        }
      }
    });
  }

  // 暴露
  window.JDSync = { pullAll, pushAll, deleteProduct, init, get lastSyncAt() { return lastSyncAt; } };
})();
