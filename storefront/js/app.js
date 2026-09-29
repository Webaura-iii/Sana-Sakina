/**
 * Mirella Skin & Hair Care — Storefront
 * Firebase Firestore backend (products, settings, orders)
 * UPI-only checkout with payment screenshot proof
 * Limited shop preview + full collection page
 */
(function () {
  'use strict';

  let db = null;
  let storage = null;
  let firebaseReady = false;

  const WHATSAPP_NUMBER_DEFAULT = '919876543210';
  const CART_KEY = 'mirella_cart';
  const SHOP_PREVIEW_LIMIT = 6; // desktop shows 6; CSS handles tablet/mobile columns

  let products = [];
  let reviews = [];
  let faqs = [];
  let storeSettings = {
    whatsapp: WHATSAPP_NUMBER_DEFAULT,
    upiId: '',
    upiName: 'Mirella Skin & Hair Care'
  };
  let cart = [];
  let currentFilter = 'all';

  const isCollectionPage = document.body.classList.contains('collection-page');

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function formatPrice(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function stars(n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function showToast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2800);
  }

  function loadCart() {
    try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch { cart = []; }
  }

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
    catch (e) { console.warn(e); }
  }

  async function initFirebase() {
    if (typeof firebase === 'undefined') {
      console.error('[Mirella] Firebase SDK not loaded');
      return false;
    }
    try {
      const config = window.MIRELLA_FIREBASE_CONFIG || window.FIREBASE_CONFIG;
      if (!firebase.apps.length) firebase.initializeApp(config);
      db = firebase.firestore();
      try { storage = firebase.storage(); } catch (e) { console.warn('[Mirella] Storage unavailable', e); }
      firebaseReady = true;
      return true;
    } catch (e) {
      console.error('[Mirella] Firebase init failed', e);
      return false;
    }
  }

  async function loadProducts() {
    if (!db) return useSeedProducts();
    try {
      const snap = await db.collection('products').orderBy('name').get();
      if (snap.empty) {
        console.info('[Mirella] No products in Firestore — using seed');
        return useSeedProducts();
      }
      products = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || '',
          category: d.category || 'skincare',
          price: Number(d.price) || 0,
          stock: Number(d.stock) ?? 0,
          description: d.description || '',
          tags: d.tags || [],
          featured: !!d.featured,
          active: d.active !== false,
          icon: d.icon || '🧴',
          image: d.imageUrl || d.image || null
        };
      }).filter(p => p.active !== false);
    } catch (e) {
      console.warn('[Mirella] products load failed, using seed', e);
      useSeedProducts();
    }
  }

  function useSeedProducts() {
    products = JSON.parse(JSON.stringify(window.SEED_PRODUCTS || [])).map(p => ({
      ...p,
      active: p.active !== false,
      image: p.image || p.imageUrl || null
    })).filter(p => p.active !== false);
  }

  async function loadSettings() {
    if (!db) {
      reviews = (window.SEED_REVIEWS || []).filter(r => r.approved !== false);
      faqs = [];
      return;
    }
    try {
      const storeDoc = await db.collection('settings').doc('store').get();
      if (storeDoc.exists) {
        const s = storeDoc.data() || {};
        storeSettings = {
          whatsapp: s.whatsapp || WHATSAPP_NUMBER_DEFAULT,
          email: s.email || 'hello@mirellaskincare.com',
          location: s.location || 'India',
          upiId: s.upiId || '',
          upiName: s.upiName || 'Mirella Skin & Hair Care'
        };
        if (s.whatsapp) {
          $$('a[href*="wa.me"]').forEach(a => {
            a.href = `https://wa.me/${String(s.whatsapp).replace(/\D/g, '')}`;
          });
        }
      }
      const revDoc = await db.collection('settings').doc('reviews').get();
      if (revDoc.exists) {
        reviews = (revDoc.data().items || []).filter(r => r.approved !== false);
      } else {
        reviews = (window.SEED_REVIEWS || []).filter(r => r.approved !== false);
      }
      const faqDoc = await db.collection('settings').doc('faqs').get();
      if (faqDoc.exists) {
        faqs = faqDoc.data().items || [];
      } else {
        faqs = [];
      }
    } catch (e) {
      console.warn('[Mirella] settings load failed', e);
      reviews = (window.SEED_REVIEWS || []).filter(r => r.approved !== false);
      faqs = [];
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function productCardHtml(p, badgeText) {
    const imgHtml = p.image
      ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">`
      : `<span class="product-icon">${p.icon || '🧴'}</span>`;
    const badge = badgeText
      ? `<span class="product-badge">${badgeText}</span>`
      : (p.featured ? '<span class="product-badge">Featured</span>' : '');
    return `
      <article class="product-card" data-id="${p.id}" data-category="${p.category}">
        <div class="product-image">
          ${badge}
          ${imgHtml}
        </div>
        <div class="product-body">
          <span class="product-category">${p.category}</span>
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          <p class="product-desc">${escapeHtml(p.description)}</p>
          <div class="product-footer">
            <span class="product-price">${formatPrice(p.price)}</span>
            <button class="product-add" data-id="${p.id}" aria-label="Add ${escapeHtml(p.name)} to cart">Add to Cart</button>
          </div>
        </div>
      </article>`;
  }

  function bindProductAddButtons(root) {
    $$('.product-add', root || document).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        addToCart(btn.dataset.id);
      });
    });
  }

  function shopPreviewLimit() {
    if (typeof window === 'undefined') return SHOP_PREVIEW_LIMIT;
    const w = window.innerWidth;
    if (w <= 768) return 4;       // mobile 2x2
    if (w <= 1100) return 4;      // tablet 4 in a row
    return SHOP_PREVIEW_LIMIT;    // desktop 6
  }

  function renderProducts(filter = 'all') {
    const grid = $('#productGrid');
    if (!grid) return;
    let filtered = filter === 'all' ? products : products.filter(p => p.category === filter);
    if (!isCollectionPage) {
      filtered = filtered.slice(0, shopPreviewLimit());
    }
    if (!filtered.length) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;">No products in this category yet.</p>';
      return;
    }
    grid.innerHTML = filtered.map(p => productCardHtml(p)).join('');
    bindProductAddButtons(grid);
  }

  function renderFeatured() {
    const track = $('#featuredGrid');
    if (!track) return;
    const featured = products.filter(p => p.featured);
    const list = featured.length ? featured : products.slice(0, 6);
    if (!list.length) {
      track.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:1rem;width:100%">Featured products coming soon.</p>';
      return;
    }
    const cards = list.map(p => {
      // Wrap in fixed-width shell for marquee
      return `<div class="featured-card-wrap">${productCardHtml(p, 'Featured')}</div>`;
    }).join('');
    // Duplicate for seamless infinite horizontal loop
    track.innerHTML = cards + cards;
    bindProductAddButtons(track);
  }

  function renderReviews() {
    const marquee = $('#reviewsMarquee');
    if (!marquee) return;
    if (!reviews.length) {
      marquee.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:1rem;width:100%">Reviews coming soon.</p>';
      return;
    }
    const cardHtml = (r) => {
      const initial = (r.name || 'C').charAt(0).toUpperCase();
      return `
        <article class="review-card review-card-marquee">
          <div class="review-stars">${stars(r.rating || 5)}</div>
          <p class="review-text">"${escapeHtml(r.text)}"</p>
          <div class="review-author">
            <div class="review-avatar">${initial}</div>
            <div>
              <div class="review-name">${escapeHtml(r.name)}</div>
              <div class="review-meta">${escapeHtml(r.product || 'Verified Customer')}</div>
            </div>
          </div>
        </article>`;
    };
    // Duplicate for seamless infinite scroll
    const track = reviews.map(cardHtml).join('') + reviews.map(cardHtml).join('');
    marquee.innerHTML = track;
  }

  function renderFaqs() {
    const list = $('#faqList');
    if (!list) return;
    if (!faqs.length) {
      list.innerHTML = '<p class="faq-empty" style="text-align:center;color:var(--text-muted);padding:1rem;">FAQs will appear here once added from the admin panel.</p>';
      return;
    }
    list.innerHTML = faqs.map((f, i) => `
      <div class="faq-item">
        <button class="faq-question" type="button">
          <span>${escapeHtml(f.question || f.q || '')}</span>
          <span class="faq-icon">+</span>
        </button>
        <div class="faq-answer">
          <p>${escapeHtml(f.answer || f.a || '')}</p>
        </div>
      </div>
    `).join('');
    $$('.faq-question', list).forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const wasOpen = item.classList.contains('open');
        $$('.faq-item', list).forEach(i => i.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });
  }

  function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (product.stock <= 0) { showToast('Sorry, this item is out of stock'); return; }
    const existing = cart.find(c => c.id === productId);
    if (existing) {
      if (existing.qty >= product.stock) { showToast('Maximum available stock reached'); return; }
      existing.qty += 1;
    } else {
      cart.push({ id: product.id, name: product.name, price: product.price, icon: product.icon || '🧴', image: product.image || null, qty: 1 });
    }
    saveCart();
    updateCartUI();
    showToast(`${product.name} added to cart`);
  }

  function updateQty(productId, delta) {
    const item = cart.find(c => c.id === productId);
    if (!item) return;
    const product = products.find(p => p.id === productId);
    const max = product ? product.stock : 99;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(c => c.id !== productId);
    else if (item.qty > max) { item.qty = max; showToast('Maximum available stock reached'); }
    saveCart();
    updateCartUI();
  }

  function removeFromCart(productId) {
    cart = cart.filter(c => c.id !== productId);
    saveCart();
    updateCartUI();
    showToast('Item removed');
  }

  function clearCart() {
    cart = [];
    saveCart();
    updateCartUI();
    showToast('Cart cleared');
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function updateCartUI() {
    const countEl = $('#cartCount');
    const itemsEl = $('#cartItems');
    const totalEl = $('#cartTotal');
    const count = cart.reduce((s, i) => s + i.qty, 0);
    if (countEl) countEl.textContent = count;
    if (totalEl) totalEl.textContent = formatPrice(cartTotal());
    if (!itemsEl) return;
    if (!cart.length) {
      itemsEl.innerHTML = '<div class="cart-empty">Your cart is empty.<br>Discover something beautiful.</div>';
      return;
    }
    itemsEl.innerHTML = cart.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <div class="cart-item-img">${item.icon || '🧴'}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">${formatPrice(item.price)}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-action="dec" data-id="${item.id}" aria-label="Decrease">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" data-action="inc" data-id="${item.id}" aria-label="Increase">+</button>
          </div>
        </div>
        <button class="cart-item-remove" data-id="${item.id}" aria-label="Remove">×</button>
      </div>
    `).join('');
    $$('.qty-btn', itemsEl).forEach(btn => {
      btn.addEventListener('click', () => updateQty(btn.dataset.id, btn.dataset.action === 'inc' ? 1 : -1));
    });
    $$('.cart-item-remove', itemsEl).forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
    });
  }

  function generateOrderNumber() {
    const t = Date.now().toString(36).toUpperCase();
    const r = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `MR-${t.slice(-4)}${r}`;
  }

  function buildUpiPayLink(amount, orderNote) {
    const pa = (storeSettings.upiId || '').trim();
    const pn = encodeURIComponent(storeSettings.upiName || 'Mirella Skin & Hair Care');
    const am = Number(amount).toFixed(2);
    const tn = encodeURIComponent(orderNote || 'Mirella order');
    if (!pa) return null;
    // Standard UPI intent — opens GPay / PhonePe / Paytm / BHIM etc. on device
    return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
  }

  function openCheckoutModal() {
    if (!cart.length) { showToast('Your cart is empty'); return; }
    let overlay = $('#checkoutOverlay');
    if (overlay) overlay.remove();

    const upiId = (storeSettings.upiId || '').trim();
    const total = cartTotal();
    const upiLink = buildUpiPayLink(total, 'Mirella order');

    overlay = document.createElement('div');
    overlay.id = 'checkoutOverlay';
    overlay.className = 'cart-overlay open';
    overlay.innerHTML = `
      <div class="checkout-modal" id="checkoutModal">
        <div class="checkout-header">
          <h3>Checkout · UPI Payment</h3>
          <button id="checkoutClose" type="button" aria-label="Close">×</button>
        </div>
        <div class="checkout-body">
          <p class="checkout-total-line">Total: <strong id="checkoutTotal">${formatPrice(total)}</strong></p>

          <div class="form-group">
            <label>Full Name *</label>
            <input id="cName" type="text" required autocomplete="name">
          </div>
          <div class="form-group">
            <label>Phone *</label>
            <input id="cPhone" type="tel" required placeholder="10-digit mobile" autocomplete="tel">
          </div>
          <div class="form-group">
            <label>Address *</label>
            <textarea id="cAddress" required rows="2"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>City *</label>
              <input id="cCity" type="text" required>
            </div>
            <div class="form-group">
              <label>State *</label>
              <input id="cState" type="text" required>
            </div>
          </div>
          <div class="form-group">
            <label>Pincode *</label>
            <input id="cPincode" type="text" required pattern="[0-9]{6}" placeholder="6-digit" inputmode="numeric">
          </div>

          <div class="upi-box">
            <p class="upi-label">Step 1 · Pay with UPI</p>
            <p class="upi-hint">Tap the button below to open Google Pay, PhonePe, Paytm or any UPI app on your phone. Pay exact amount <strong>${formatPrice(total)}</strong>.</p>
            ${upiLink
              ? `<a class="btn btn-primary btn-full upi-pay-btn" id="upiPayBtn" href="${upiLink}">Pay ₹${Number(total).toLocaleString('en-IN')} with UPI</a>`
              : `<p class="upi-hint">UPI is not configured yet. Please contact us on WhatsApp to complete payment.</p>`}
            <p class="upi-hint" style="margin-top:0.75rem">After paying, upload your payment screenshot below and confirm the order.</p>
          </div>

          <div class="form-group">
            <label>Step 2 · Payment Screenshot *</label>
            <input type="file" id="cProof" accept="image/*" required>
            <p class="field-hint">Upload a clear screenshot of your UPI payment confirmation (max 5 MB).</p>
            <div id="proofPreview" class="proof-preview" hidden></div>
          </div>

          <button class="btn btn-primary btn-full" id="placeOrderBtn" type="button">Confirm Order</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCheckout(); });
    $('#checkoutClose')?.addEventListener('click', closeCheckout);
    $('#placeOrderBtn')?.addEventListener('click', submitOrder);

    // UPI deep link — on mobile opens installed UPI apps; prevent default only if no app
    $('#upiPayBtn')?.addEventListener('click', (e) => {
      if (!upiId) {
        e.preventDefault();
        showToast('UPI not configured');
        return;
      }
      showToast('Opening UPI app…');
    });

    $('#cProof')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      const preview = $('#proofPreview');
      if (!file || !preview) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be under 5 MB');
        e.target.value = '';
        preview.hidden = true;
        return;
      }
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${url}" alt="Payment proof preview">`;
      preview.hidden = false;
    });
  }

  function closeCheckout() {
    const overlay = $('#checkoutOverlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
  }

  async function uploadPaymentProof(file, orderNumber) {
    if (!storage || !file) return null;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `payment-proofs/${orderNumber}_${Date.now()}.${ext}`;
    const snap = await storage.ref(path).put(file, { contentType: file.type || 'image/jpeg' });
    return await snap.ref.getDownloadURL();
  }

  async function submitOrder() {
    const name = $('#cName')?.value.trim();
    const phone = $('#cPhone')?.value.trim();
    const address = $('#cAddress')?.value.trim();
    const city = $('#cCity')?.value.trim();
    const state = $('#cState')?.value.trim();
    const pincode = $('#cPincode')?.value.trim();
    const proofInput = $('#cProof');
    const proofFile = proofInput?.files?.[0];

    if (!name || !phone || !address || !city || !state || !pincode) {
      showToast('Please fill all required fields');
      return;
    }
    if (!proofFile) {
      showToast('Please upload payment screenshot as proof');
      return;
    }
    if (proofFile.size > 5 * 1024 * 1024) {
      showToast('Screenshot must be under 5 MB');
      return;
    }

    const orderNumber = generateOrderNumber();
    const items = cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty }));
    const total = cartTotal();

    const btn = $('#placeOrderBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading proof…'; }

    let paymentProofUrl = null;
    try {
      if (storage && firebaseReady) {
        paymentProofUrl = await uploadPaymentProof(proofFile, orderNumber);
      }
    } catch (e) {
      console.error('[Mirella] proof upload failed', e);
      showToast('Could not upload screenshot. Please try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Confirm Order'; }
      return;
    }

    if (btn) btn.textContent = 'Placing order…';

    const orderPayload = {
      orderNumber,
      customer: { name, phone, address, city, state, pincode },
      items,
      total,
      status: 'new',
      paymentStatus: 'pending',
      paymentMethod: 'upi',
      paymentProofUrl: paymentProofUrl || '',
      notes: '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (db && firebaseReady) {
        await db.collection('orders').add(orderPayload);
        showToast('Order placed! We will verify payment and confirm.');
      } else {
        showToast('Order recorded locally. Contact us on WhatsApp.');
      }
      openWhatsAppMessage(orderNumber, { name, phone, address, city, state, pincode }, paymentProofUrl);
      clearCart();
      closeCheckout();
      $('#cartDrawer')?.classList.remove('open');
      $('#cartOverlay')?.classList.remove('open');
    } catch (e) {
      console.error('[Mirella] order create failed', e);
      showToast('Could not save order. Opening WhatsApp instead.');
      openWhatsAppMessage(orderNumber, { name, phone, address, city, state, pincode }, paymentProofUrl);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Confirm Order'; }
    }
  }

  function openWhatsAppMessage(orderNumber, customer, proofUrl) {
    const wa = String(storeSettings.whatsapp || WHATSAPP_NUMBER_DEFAULT).replace(/\D/g, '');
    let message = 'Hello Sana! I have placed an order from *Mirella Skin & Hair Care*:%0A%0A';
    if (orderNumber) message += `*Order:* ${orderNumber}%0A%0A`;
    cart.forEach((item, i) => {
      message += `${i + 1}. *${item.name}* × ${item.qty} — ${formatPrice(item.price * item.qty)}%0A`;
    });
    message += `%0A*Total: ${formatPrice(cartTotal())}*%0A*Payment:* UPI%0A`;
    if (customer) {
      message += `%0A*Name:* ${customer.name}%0A*Phone:* ${customer.phone}%0A*Address:* ${customer.address}, ${customer.city}, ${customer.state} - ${customer.pincode}%0A`;
    }
    if (proofUrl) message += `%0APayment screenshot uploaded with the order.`;
    message += '%0APlease verify and confirm. Thank you!';
    window.open(`https://wa.me/${wa}?text=${message}`, '_blank');
  }

  function bindUI() {
    const navbar = $('#navbar');
    window.addEventListener('scroll', () => {
      if (navbar && !isCollectionPage) navbar.classList.toggle('scrolled', window.scrollY > 40);
    });

    const toggle = $('#navToggle');
    const menu = $('#navMenu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => menu.classList.toggle('open'));
      $$('a', menu).forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
    }

    $$('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter || 'all';
        renderProducts(currentFilter);
      });
    });

    const cartBtn = $('#cartBtn');
    const cartClose = $('#cartClose');
    const cartOverlay = $('#cartOverlay');
    const cartDrawer = $('#cartDrawer');

    function openCart() {
      cartDrawer?.classList.add('open');
      cartOverlay?.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeCart() {
      cartDrawer?.classList.remove('open');
      cartOverlay?.classList.remove('open');
      document.body.style.overflow = '';
    }

    cartBtn?.addEventListener('click', openCart);
    cartClose?.addEventListener('click', closeCart);
    cartOverlay?.addEventListener('click', closeCart);

    $('#checkoutBtn')?.addEventListener('click', openCheckoutModal);
    $('#whatsappOrderBtn')?.addEventListener('click', openCheckoutModal);
    $('#clearCartBtn')?.addEventListener('click', clearCart);

    let resizeTimer;
    window.addEventListener('resize', () => {
      if (isCollectionPage) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => renderProducts(currentFilter), 200);
    });
  }

  async function init() {
    loadCart();
    bindUI();
    updateCartUI();

    useSeedProducts();
    reviews = (window.SEED_REVIEWS || []).filter(r => r.approved !== false);
    renderProducts('all');
    renderFeatured();
    renderReviews();
    renderFaqs();

    const ok = await initFirebase();
    if (ok) {
      await Promise.all([loadProducts(), loadSettings()]);
      renderProducts(currentFilter);
      renderFeatured();
      renderReviews();
      renderFaqs();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
