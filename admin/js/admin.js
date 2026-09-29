/**
 * Mirella Admin Panel — Firebase Auth + Firestore
 * Collections: products, orders, settings (store + reviews), admins
 * Matches provided firestore.rules & storage.rules
 */
(function () {
  'use strict';

  let auth = null;
  let db = null;
  let storage = null;
  let currentUser = null;
  let currentView = 'dashboard';
  let editingId = null;

  let products = [];
  let orders = [];
  let reviews = []; // items array from settings/reviews
  let faqs = []; // items array from settings/faqs
  let storeSettings = {};

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  function formatPrice(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  }

  function formatDate(d) {
    if (!d) return '—';
    const dt = d.toDate ? d.toDate() : new Date(d);
    if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function showToast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ---------- Firebase ----------
  function initFirebase() {
    const config = window.MIRELLA_FIREBASE_CONFIG || window.FIREBASE_CONFIG;
    if (!config || typeof firebase === 'undefined') {
      console.error('[Admin] Firebase missing');
      return false;
    }
    if (!firebase.apps.length) firebase.initializeApp(config);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    return true;
  }

  async function isAdminUser(user) {
    if (!user) return false;
    try {
      const doc = await db.collection('admins').doc(user.uid).get();
      return doc.exists && doc.data().active === true;
    } catch (e) {
      console.warn('[Admin] admin check failed', e);
      return false;
    }
  }

  /** Hard gate: every admin action must pass this. Signs out if not admin. */
  async function requireAdmin() {
    const user = (auth && auth.currentUser) || currentUser;
    if (!user) {
      showLogin('Sign in required');
      return false;
    }
    const ok = await isAdminUser(user);
    if (!ok) {
      try { await auth.signOut(); } catch (_) {}
      currentUser = null;
      showLogin('Not an active admin. Access denied.');
      return false;
    }
    currentUser = user;
    return true;
  }

  // ---------- Auth UI ----------
  function showLogin(errMsg) {
    currentUser = null;
    $('#loginScreen').hidden = false;
    $('#adminApp').hidden = true;
    const content = $('#content');
    if (content) content.innerHTML = '';
    const err = $('#loginError');
    if (errMsg) {
      err.textContent = errMsg;
      err.hidden = false;
    } else {
      err.hidden = true;
    }
  }

  function showApp(user) {
    $('#loginScreen').hidden = true;
    $('#adminApp').hidden = false;
    $('#adminEmail').textContent = user.email || user.uid.slice(0, 8);
    setView('dashboard');
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;
    const btn = $('#loginBtn');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      const ok = await isAdminUser(cred.user);
      if (!ok) {
        await auth.signOut();
        showLogin('This account is not an active admin. Add admins/{uid} with active:true in Firestore Console.');
        return;
      }
      currentUser = cred.user;
      showApp(currentUser);
    } catch (err) {
      console.error(err);
      showLogin(err.message || 'Sign-in failed');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  }

  async function handleLogout() {
    await auth.signOut();
    currentUser = null;
    showLogin();
  }

  // ---------- Data loaders ----------
  async function loadProducts() {
    const snap = await db.collection('products').orderBy('name').get();
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function loadOrders() {
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(100).get();
    orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function loadReviews() {
    const doc = await db.collection('settings').doc('reviews').get();
    reviews = doc.exists ? (doc.data().items || []) : [];
  }

  async function loadSettings() {
    const doc = await db.collection('settings').doc('store').get();
    storeSettings = doc.exists ? doc.data() : {};
  }

  async function loadFaqs() {
    const doc = await db.collection('settings').doc('faqs').get();
    faqs = doc.exists ? (doc.data().items || []) : [];
  }

  async function saveFaqsArray() {
    await db.collection('settings').doc('faqs').set({
      items: faqs,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function refreshAll() {
    await Promise.all([loadProducts(), loadOrders(), loadReviews(), loadFaqs(), loadSettings()]);
  }

  // ---------- Modal ----------
  function openModal(title, bodyHtml, footerHtml) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    $('#modalFooter').innerHTML = footerHtml || '';
    $('#modalOverlay').classList.add('open');
  }

  function closeModal() {
    $('#modalOverlay').classList.remove('open');
    editingId = null;
  }

  // ---------- Views ----------
  function setView(view) {
    if (!currentUser) {
      showLogin('Sign in required');
      return;
    }
    currentView = view;
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    const titles = {
      dashboard: 'Dashboard',
      products: 'Products',
      orders: 'Orders',
      reviews: 'Reviews',
      faqs: 'FAQs',
      settings: 'Settings'
    };
    $('#pageTitle').textContent = titles[view] || view;
    renderView();
    $('#sidebar')?.classList.remove('open');
  }

  async function renderView() {
    const content = $('#content');
    if (!content) return;

    // Re-verify admin before loading any tab data
    if (!(await requireAdmin())) return;

    content.innerHTML = '<p style="color:var(--text-muted);padding:2rem">Loading…</p>';
    try {
      if (currentView === 'dashboard') {
        await Promise.all([loadProducts(), loadOrders(), loadReviews()]);
        content.innerHTML = renderDashboard();
      } else if (currentView === 'products') {
        await loadProducts();
        content.innerHTML = renderProducts();
        bindProductActions();
      } else if (currentView === 'orders') {
        await loadOrders();
        content.innerHTML = renderOrders();
        bindOrderActions();
      } else if (currentView === 'reviews') {
        await loadReviews();
        content.innerHTML = renderReviews();
        bindReviewActions();
      } else if (currentView === 'faqs') {
        await loadFaqs();
        content.innerHTML = renderFaqs();
        bindFaqActions();
      } else if (currentView === 'settings') {
        await loadSettings();
        content.innerHTML = renderSettings();
        bindSettingsActions();
      }
    } catch (e) {
      console.error(e);
      // Permission errors usually mean rules blocked a non-admin
      if (e.code === 'permission-denied' || /permission/i.test(e.message || '')) {
        await requireAdmin();
        content.innerHTML = '<div class="empty-state"><p>Access denied. Admin privileges required.</p></div>';
        return;
      }
      content.innerHTML = `<div class="empty-state"><p>Error loading data: ${escapeHtml(e.message)}</p></div>`;
    }
  }

  // ---------- Dashboard ----------
  function renderDashboard() {
    const todayStr = new Date().toDateString();
    const ordersToday = orders.filter(o => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : (o.createdAt ? new Date(o.createdAt) : null);
      return d && d.toDateString() === todayStr;
    });
    const revenueToday = ordersToday
      .filter(o => o.status !== 'cancelled' && o.paymentStatus !== 'failed')
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    const revenueAll = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    const lowStock = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 15);
    const pendingOrders = orders.filter(o => o.status === 'new' || o.status === 'confirmed');
    const unapproved = reviews.filter(r => r.approved === false);

    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Orders Today</div>
          <div class="stat-value rose">${ordersToday.length}</div>
          <div class="stat-sub">${pendingOrders.length} pending overall</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Revenue Today</div>
          <div class="stat-value gold">${formatPrice(revenueToday)}</div>
          <div class="stat-sub">All-time: ${formatPrice(revenueAll)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Low Stock</div>
          <div class="stat-value warn">${lowStock.length}</div>
          <div class="stat-sub">≤ 15 units</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Hidden Reviews</div>
          <div class="stat-value">${unapproved.length}</div>
          <div class="stat-sub">${reviews.length} total</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Alerts</h2></div>
        <div class="panel-body" style="padding:1.25rem">
          <div class="alert-list">
            ${lowStock.length ? lowStock.map(p => `
              <div class="alert-item low-stock"><strong>${escapeHtml(p.name)}</strong> — ${p.stock} left</div>
            `).join('') : '<div class="alert-item" style="border-left-color:var(--success)">Stock levels OK</div>'}
            ${pendingOrders.slice(0, 5).map(o => `
              <div class="alert-item" style="border-left-color:var(--info)">
                Order <strong>${escapeHtml(o.orderNumber || o.id.slice(-6))}</strong> — ${escapeHtml(o.customer?.name || '—')} (${o.status})
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2>Recent Orders</h2>
          <button class="btn btn-outline btn-sm" data-goto="orders">View All</button>
        </div>
        <div class="panel-body">${ordersTable(orders.slice(0, 6))}</div>
      </div>

      <div style="margin-top:1rem">
        <button class="btn btn-outline" id="seedProductsBtn">Seed Sample Products (if empty)</button>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- Products ----------
  function renderProducts() {
    return `
      <div class="panel">
        <div class="panel-header">
          <h2>Products (${products.length})</h2>
          <button class="btn btn-primary" id="addProductBtn">+ Add Product</button>
        </div>
        <div class="panel-body">
          ${products.length ? `
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Featured</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${products.map(p => `
                  <tr>
                    <td><span style="margin-right:0.35rem">${p.icon || '🧴'}</span><strong>${escapeHtml(p.name)}</strong></td>
                    <td style="text-transform:capitalize">${escapeHtml(p.category)}</td>
                    <td>${formatPrice(p.price)}</td>
                    <td class="${(p.stock||0) <= 0 ? 'stock-out' : (p.stock||0) <= 15 ? 'stock-low' : 'stock-ok'}">${p.stock ?? 0}</td>
                    <td>${p.featured ? '★' : '—'}</td>
                    <td>${p.active !== false ? 'Yes' : 'No'}</td>
                    <td class="actions">
                      <button class="btn btn-outline btn-sm edit-product" data-id="${p.id}">Edit</button>
                      <button class="btn btn-danger btn-sm delete-product" data-id="${p.id}">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="empty-state"><p>No products yet.</p><button class="btn btn-primary" id="addProductBtn">Add Product</button> <button class="btn btn-outline" id="seedProductsBtn">Seed Samples</button></div>'}
        </div>
      </div>
    `;
  }

  function bindProductActions() {
    $('#addProductBtn')?.addEventListener('click', () => openProductModal());
    $$('.edit-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = products.find(x => x.id === btn.dataset.id);
        if (p) openProductModal(p);
      });
    });
    $$('.delete-product').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this product?')) return;
        try {
          await db.collection('products').doc(btn.dataset.id).delete();
          showToast('Product deleted');
          renderView();
        } catch (e) {
          showToast('Delete failed: ' + e.message);
        }
      });
    });
    $('#seedProductsBtn')?.addEventListener('click', seedProducts);
    // dashboard seed
    document.querySelector('[data-goto="orders"]')?.addEventListener('click', () => setView('orders'));
  }

  function openProductModal(product = null) {
    editingId = product ? product.id : null;
    const isEdit = !!product;
    const body = `
      <div class="form-group">
        <label>Product Name</label>
        <input type="text" id="pName" value="${escapeHtml(product?.name || '')}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <select id="pCategory">
            <option value="skincare" ${product?.category === 'skincare' ? 'selected' : ''}>Skincare</option>
            <option value="haircare" ${product?.category === 'haircare' ? 'selected' : ''}>Haircare</option>
            <option value="tools" ${product?.category === 'tools' ? 'selected' : ''}>Tools</option>
          </select>
        </div>
        <div class="form-group">
          <label>Price (₹)</label>
          <input type="number" id="pPrice" value="${product?.price ?? ''}" min="0" step="1" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Stock</label>
          <input type="number" id="pStock" value="${product?.stock ?? 0}" min="0">
        </div>
        <div class="form-group">
          <label>Icon (emoji)</label>
          <input type="text" id="pIcon" value="${product?.icon || '🧴'}" maxlength="4">
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="pDesc">${escapeHtml(product?.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Tags (comma-separated)</label>
        <input type="text" id="pTags" value="${(product?.tags || []).join(', ')}">
      </div>
      <div class="form-group">
        <label>Image URL (optional — or upload below)</label>
        <input type="url" id="pImageUrl" value="${escapeHtml(product?.imageUrl || product?.image || '')}" placeholder="https://...">
      </div>
      <div class="form-group">
        <label>Upload Image from device</label>
        <input type="file" id="pImageFile" accept="image/*">
        <img id="pImagePreview" class="product-img-preview" alt="Preview" ${product?.imageUrl || product?.image ? `src="${escapeHtml(product.imageUrl || product.image)}"` : 'hidden'}>
      </div>
      <div class="form-group">
        <div class="checkbox-row">
          <label>
            <input type="checkbox" id="pFeatured" ${product?.featured ? 'checked' : ''}>
            Featured product
          </label>
          <label>
            <input type="checkbox" id="pActive" ${product?.active !== false ? 'checked' : ''}>
            Active in store
          </label>
        </div>
      </div>
    `;
    const footer = `
      <button class="btn btn-outline" id="modalCancel">Cancel</button>
      <button class="btn btn-primary" id="modalSaveProduct">${isEdit ? 'Save' : 'Add Product'}</button>
    `;
    openModal(isEdit ? 'Edit Product' : 'Add Product', body, footer);
    $('#modalCancel')?.addEventListener('click', closeModal);
    $('#modalSaveProduct')?.addEventListener('click', saveProduct);

    // Live image preview (URL or file)
    const preview = $('#pImagePreview');
    $('#pImageUrl')?.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url && preview) {
        preview.src = url;
        preview.hidden = false;
      } else if (preview && !$('#pImageFile')?.files?.length) {
        preview.hidden = true;
        preview.removeAttribute('src');
      }
    });
    $('#pImageFile')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file || !preview) return;
      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.hidden = false;
    });
  }

  async function saveProduct() {
    if (!(await requireAdmin())) return;
    const name = $('#pName')?.value.trim();
    const price = parseFloat($('#pPrice')?.value);
    if (!name || isNaN(price)) {
      showToast('Name and price required');
      return;
    }

    let imageUrl = $('#pImageUrl')?.value.trim() || null;
    const fileInput = $('#pImageFile');
    const file = fileInput?.files?.[0];

    const data = {
      name,
      category: $('#pCategory')?.value || 'skincare',
      price,
      stock: parseInt($('#pStock')?.value, 10) || 0,
      icon: $('#pIcon')?.value.trim() || '🧴',
      description: $('#pDesc')?.value.trim() || '',
      tags: ($('#pTags')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
      featured: $('#pFeatured')?.checked || false,
      active: $('#pActive')?.checked !== false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const btn = $('#modalSaveProduct');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      let docId = editingId;
      if (!docId) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const ref = await db.collection('products').add(data);
        docId = ref.id;
      } else {
        await db.collection('products').doc(docId).update(data);
      }

      if (file && storage) {
        const path = `products/${docId}/${Date.now()}_${file.name}`;
        const snap = await storage.ref(path).put(file);
        imageUrl = await snap.ref.getDownloadURL();
        await db.collection('products').doc(docId).update({ imageUrl });
      } else if (imageUrl) {
        await db.collection('products').doc(docId).update({ imageUrl });
      }

      showToast(editingId ? 'Product updated' : 'Product added');
      closeModal();
      renderView();
    } catch (e) {
      console.error(e);
      showToast('Save failed: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = editingId ? 'Save' : 'Add Product'; }
    }
  }

  async function seedProducts() {
    if (!(await requireAdmin())) return;
    if (!confirm('Add sample products to Firestore? (skips if products already exist)')) return;
    try {
      const snap = await db.collection('products').limit(1).get();
      if (!snap.empty) {
        showToast('Products already exist — skip seed');
        return;
      }
      const batch = db.batch();
      const seeds = window.SEED_PRODUCTS || [];
      seeds.forEach(p => {
        const ref = db.collection('products').doc();
        batch.set(ref, {
          name: p.name,
          category: p.category,
          price: p.price,
          stock: p.stock,
          description: p.description,
          tags: p.tags || [],
          featured: !!p.featured,
          active: true,
          icon: p.icon || '🧴',
          imageUrl: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      showToast(`Seeded ${seeds.length} products`);
      renderView();
    } catch (e) {
      showToast('Seed failed: ' + e.message);
    }
  }

  // ---------- Orders ----------
  function statusClass(s) {
    const m = {
      new: 'status-new',
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled'
    };
    return m[(s || '').toLowerCase()] || 'status-pending';
  }

  function ordersTable(list) {
    if (!list.length) return '<div class="empty-state"><p>No orders yet.</p></div>';
    return `
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Proof</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(o => `
            <tr>
              <td><strong>${escapeHtml(o.orderNumber || o.id.slice(-6).toUpperCase())}</strong></td>
              <td>
                ${escapeHtml(o.customer?.name || '—')}<br>
                <small style="color:var(--text-muted)">${escapeHtml(o.customer?.phone || '')}</small>
              </td>
              <td>${(o.items || []).length}</td>
              <td>${formatPrice(o.total)}</td>
              <td><span class="status ${statusClass(o.status)}">${escapeHtml(o.status || 'new')}</span></td>
              <td>${escapeHtml(o.paymentStatus || 'pending')} / ${escapeHtml(o.paymentMethod || '—')}</td>
              <td>
                ${o.paymentProofUrl
                  ? `<img class="proof-thumb" src="${escapeHtml(o.paymentProofUrl)}" alt="Proof" data-proof="${escapeHtml(o.paymentProofUrl)}" title="Click to preview">`
                  : '<span style="color:var(--text-muted)">—</span>'}
              </td>
              <td>${formatDate(o.createdAt)}</td>
              <td class="actions">
                <button class="btn btn-outline btn-sm edit-order" data-id="${o.id}">Edit</button>
                <button class="btn btn-danger btn-sm delete-order" data-id="${o.id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderOrders() {
    return `
      <div class="panel">
        <div class="panel-header">
          <h2>Orders (${orders.length})</h2>
        </div>
        <div class="panel-body">${ordersTable(orders)}</div>
      </div>
    `;
  }

  function openProofLightbox(url) {
    if (!url) return;
    const existing = $('#proofLightbox');
    if (existing) existing.remove();
    const lb = document.createElement('div');
    lb.id = 'proofLightbox';
    lb.className = 'proof-lightbox';
    lb.innerHTML = `<img src="${escapeHtml(url)}" alt="Payment screenshot">`;
    lb.addEventListener('click', (e) => {
      if (e.target === lb) lb.remove();
    });
    document.body.appendChild(lb);
  }

  function bindOrderActions() {
    $$('.edit-order').forEach(btn => {
      btn.addEventListener('click', () => {
        const o = orders.find(x => x.id === btn.dataset.id);
        if (o) openOrderModal(o);
      });
    });
    $$('.delete-order').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this order?')) return;
        try {
          await db.collection('orders').doc(btn.dataset.id).delete();
          showToast('Order deleted');
          renderView();
        } catch (e) {
          showToast('Delete failed: ' + e.message);
        }
      });
    });
    $$('.proof-thumb').forEach(img => {
      img.addEventListener('click', () => openProofLightbox(img.dataset.proof || img.src));
    });
  }

  function openOrderModal(order) {
    editingId = order.id;
    const statuses = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    const payStatuses = ['pending', 'paid', 'failed', 'refunded'];
    const body = `
      <div class="form-group">
        <label>Order Number</label>
        <input type="text" value="${escapeHtml(order.orderNumber || order.id)}" readonly>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Customer</label>
          <input type="text" value="${escapeHtml(order.customer?.name || '')}" readonly>
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="text" value="${escapeHtml(order.customer?.phone || '')}" readonly>
        </div>
      </div>
      <div class="form-group">
        <label>Address</label>
        <textarea readonly>${escapeHtml([order.customer?.address, order.customer?.city, order.customer?.state, order.customer?.pincode].filter(Boolean).join(', '))}</textarea>
      </div>
      <div class="form-group">
        <label>Items</label>
        <textarea readonly>${(order.items || []).map(i => `${i.name} × ${i.qty} @ ₹${i.price}`).join('\n')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select id="oStatus">
            ${statuses.map(s => `<option value="${s}" ${(order.status || 'new') === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Payment Status</label>
          <select id="oPayStatus">
            ${payStatuses.map(s => `<option value="${s}" ${(order.paymentStatus || 'pending') === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Admin Notes</label>
        <input type="text" id="oNotes" value="${escapeHtml(order.notes || '')}">
      </div>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.75rem">Total: <strong style="color:var(--champagne)">${formatPrice(order.total)}</strong> · Method: ${escapeHtml(order.paymentMethod || '—')}</p>
      ${order.paymentProofUrl ? `
        <div class="form-group">
          <label>Payment Screenshot</label>
          <img class="proof-thumb" src="${escapeHtml(order.paymentProofUrl)}" alt="Payment proof"
            data-proof="${escapeHtml(order.paymentProofUrl)}"
            style="width:120px;height:120px;margin-top:0.35rem;cursor:pointer"
            title="Click to enlarge">
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:0.35rem">Click image to preview full size</p>
        </div>
      ` : '<p style="font-size:0.8rem;color:var(--text-muted)">No payment screenshot uploaded.</p>'}
    `;
    const footer = `
      <button class="btn btn-outline" id="modalCancel">Cancel</button>
      <button class="btn btn-primary" id="modalSaveOrder">Save Changes</button>
    `;
    openModal('Update Order', body, footer);
    $('#modalCancel')?.addEventListener('click', closeModal);
    $('#modalSaveOrder')?.addEventListener('click', saveOrder);
    $$('.proof-thumb', $('#modalBody')).forEach(img => {
      img.addEventListener('click', () => openProofLightbox(img.dataset.proof || img.src));
    });
  }

  async function saveOrder() {
    if (!(await requireAdmin())) return;
    try {
      await db.collection('orders').doc(editingId).update({
        status: $('#oStatus')?.value || 'new',
        paymentStatus: $('#oPayStatus')?.value || 'pending',
        notes: $('#oNotes')?.value.trim() || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Order updated');
      closeModal();
      renderView();
    } catch (e) {
      showToast('Update failed: ' + e.message);
    }
  }

  // ---------- Reviews (settings/reviews) ----------
  function renderReviews() {
    return `
      <div class="panel">
        <div class="panel-header">
          <h2>Reviews (${reviews.length})</h2>
          <button class="btn btn-primary" id="addReviewBtn">+ Add Review</button>
        </div>
        <div class="panel-body">
          ${reviews.length ? `
            <table>
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Rating</th>
                  <th>Text</th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${reviews.map((r, idx) => `
                  <tr>
                    <td><strong>${escapeHtml(r.name)}</strong></td>
                    <td class="stars">${'★'.repeat(r.rating || 5)}</td>
                    <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.text)}</td>
                    <td>${escapeHtml(r.product || '—')}</td>
                    <td>
                      <span class="status ${r.approved !== false ? 'status-delivered' : 'status-pending'}">
                        ${r.approved !== false ? 'Approved' : 'Hidden'}
                      </span>
                    </td>
                    <td class="actions">
                      <button class="btn btn-outline btn-sm toggle-review" data-idx="${idx}">${r.approved !== false ? 'Hide' : 'Approve'}</button>
                      <button class="btn btn-outline btn-sm edit-review" data-idx="${idx}">Edit</button>
                      <button class="btn btn-danger btn-sm delete-review" data-idx="${idx}">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="empty-state"><p>No reviews yet.</p><button class="btn btn-primary" id="addReviewBtn">Add Review</button> <button class="btn btn-outline" id="seedReviewsBtn">Seed Samples</button></div>'}
        </div>
      </div>
    `;
  }

  function bindReviewActions() {
    $('#addReviewBtn')?.addEventListener('click', () => openReviewModal());
    $('#seedReviewsBtn')?.addEventListener('click', seedReviews);
    $$('.edit-review').forEach(btn => {
      btn.addEventListener('click', () => openReviewModal(reviews[+btn.dataset.idx], +btn.dataset.idx));
    });
    $$('.toggle-review').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = +btn.dataset.idx;
        reviews[idx].approved = reviews[idx].approved === false ? true : false;
        await saveReviewsArray();
        showToast(reviews[idx].approved ? 'Approved' : 'Hidden');
        renderView();
      });
    });
    $$('.delete-review').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this review?')) return;
        reviews.splice(+btn.dataset.idx, 1);
        await saveReviewsArray();
        showToast('Deleted');
        renderView();
      });
    });
  }

  async function saveReviewsArray() {
    await db.collection('settings').doc('reviews').set({
      items: reviews,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  function openReviewModal(review = null, idx = null) {
    editingId = idx;
    const body = `
      <div class="form-row">
        <div class="form-group">
          <label>Author Name</label>
          <input type="text" id="rName" value="${escapeHtml(review?.name || '')}" required>
        </div>
        <div class="form-group">
          <label>Rating (1-5)</label>
          <input type="number" id="rRating" value="${review?.rating || 5}" min="1" max="5">
        </div>
      </div>
      <div class="form-group">
        <label>Review Text</label>
        <textarea id="rText">${escapeHtml(review?.text || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Product</label>
        <input type="text" id="rProduct" value="${escapeHtml(review?.product || '')}">
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:0.5rem;text-transform:none;letter-spacing:0;font-size:0.85rem;color:var(--text-secondary)">
          <input type="checkbox" id="rApproved" ${review?.approved !== false ? 'checked' : ''} style="width:auto">
          Approved (visible on storefront)
        </label>
      </div>
    `;
    const footer = `
      <button class="btn btn-outline" id="modalCancel">Cancel</button>
      <button class="btn btn-primary" id="modalSaveReview">${review ? 'Save' : 'Add Review'}</button>
    `;
    openModal(review ? 'Edit Review' : 'Add Review', body, footer);
    $('#modalCancel')?.addEventListener('click', closeModal);
    $('#modalSaveReview')?.addEventListener('click', saveReview);
  }

  async function saveReview() {
    if (!(await requireAdmin())) return;
    const name = $('#rName')?.value.trim();
    if (!name) { showToast('Name required'); return; }
    const item = {
      id: (editingId != null && reviews[editingId]?.id) || uid('rev'),
      name,
      rating: parseInt($('#rRating')?.value, 10) || 5,
      text: $('#rText')?.value.trim() || '',
      product: $('#rProduct')?.value.trim() || '',
      approved: $('#rApproved')?.checked !== false,
      date: new Date().toISOString().slice(0, 10)
    };
    if (editingId != null) reviews[editingId] = item;
    else reviews.unshift(item);
    try {
      await saveReviewsArray();
      showToast('Review saved');
      closeModal();
      renderView();
    } catch (e) {
      showToast('Save failed: ' + e.message);
    }
  }

  async function seedReviews() {
    const seeds = window.SEED_REVIEWS || [];
    reviews = seeds.map(r => ({ ...r, approved: r.approved !== false }));
    await saveReviewsArray();
    showToast('Reviews seeded');
    renderView();
  }

  // ---------- FAQs (settings/faqs) ----------
  function renderFaqs() {
    return `
      <div class="panel">
        <div class="panel-header">
          <h2>FAQs (${faqs.length})</h2>
          <button class="btn btn-primary" id="addFaqBtn">+ Add FAQ</button>
        </div>
        <div class="panel-body">
          ${faqs.length ? `
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Answer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${faqs.map((f, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td style="max-width:220px"><strong>${escapeHtml(f.question || '')}</strong></td>
                    <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(f.answer || '')}</td>
                    <td class="actions">
                      <button class="btn btn-outline btn-sm edit-faq" data-idx="${idx}">Edit</button>
                      <button class="btn btn-danger btn-sm delete-faq" data-idx="${idx}">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="empty-state"><p>No FAQs yet. Add questions customers ask often.</p></div>'}
        </div>
      </div>
    `;
  }

  function bindFaqActions() {
    $('#addFaqBtn')?.addEventListener('click', () => openFaqModal(null));
    $$('.edit-faq').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        openFaqModal(faqs[idx], idx);
      });
    });
    $$('.delete-faq').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this FAQ?')) return;
        const idx = parseInt(btn.dataset.idx, 10);
        faqs.splice(idx, 1);
        try {
          await saveFaqsArray();
          showToast('FAQ deleted');
          renderView();
        } catch (e) {
          showToast('Delete failed: ' + e.message);
        }
      });
    });
  }

  function openFaqModal(faq, idx) {
    editingId = idx != null ? idx : null;
    const body = `
      <div class="form-group">
        <label>Question</label>
        <input type="text" id="fQuestion" value="${escapeHtml(faq?.question || '')}" required placeholder="What is your shipping policy?">
      </div>
      <div class="form-group">
        <label>Answer</label>
        <textarea id="fAnswer" rows="4" required placeholder="We ship within…">${escapeHtml(faq?.answer || '')}</textarea>
      </div>
    `;
    const footer = `
      <button class="btn btn-outline" id="modalCancel">Cancel</button>
      <button class="btn btn-primary" id="modalSaveFaq">${faq ? 'Save' : 'Add FAQ'}</button>
    `;
    openModal(faq ? 'Edit FAQ' : 'Add FAQ', body, footer);
    $('#modalCancel')?.addEventListener('click', closeModal);
    $('#modalSaveFaq')?.addEventListener('click', saveFaq);
  }

  async function saveFaq() {
    if (!(await requireAdmin())) return;
    const question = $('#fQuestion')?.value.trim();
    const answer = $('#fAnswer')?.value.trim();
    if (!question || !answer) { showToast('Question and answer required'); return; }
    const item = {
      id: (editingId != null && faqs[editingId]?.id) || uid('faq'),
      question,
      answer
    };
    if (editingId != null) faqs[editingId] = item;
    else faqs.push(item);
    try {
      await saveFaqsArray();
      showToast('FAQ saved');
      closeModal();
      renderView();
    } catch (e) {
      showToast('Save failed: ' + e.message);
    }
  }

  // ---------- Settings ----------
  function renderSettings() {
    return `
      <div class="panel">
        <div class="panel-header"><h2>Store Settings</h2></div>
        <div class="panel-body" style="padding:1.35rem">
          <div class="form-group">
            <label>WhatsApp Number (with country code, digits only)</label>
            <input type="text" id="sWhatsapp" value="${escapeHtml(storeSettings.whatsapp || '')}" placeholder="919876543210">
          </div>
          <div class="form-group">
            <label>UPI ID (used to open GPay / PhonePe / Paytm — not shown to customers)</label>
            <input type="text" id="sUpiId" value="${escapeHtml(storeSettings.upiId || '')}" placeholder="yourname@upi">
          </div>
          <div class="form-group">
            <label>UPI Account Name (payee name in UPI apps)</label>
            <input type="text" id="sUpiName" value="${escapeHtml(storeSettings.upiName || '')}" placeholder="Mirella Skin & Hair Care">
          </div>
          <div class="form-group">
            <label>Contact Email</label>
            <input type="email" id="sEmail" value="${escapeHtml(storeSettings.email || '')}" placeholder="hello@mirellaskincare.com">
          </div>
          <div class="form-group">
            <label>Location</label>
            <input type="text" id="sLocation" value="${escapeHtml(storeSettings.location || '')}" placeholder="India">
          </div>
          <button class="btn btn-primary" id="saveSettingsBtn">Save Settings</button>
        </div>
      </div>
      <div class="panel" style="margin-top:1.25rem">
        <div class="panel-header"><h2>Firebase Setup Checklist</h2></div>
        <div class="panel-body" style="padding:1.35rem;font-size:0.85rem;color:var(--text-secondary);line-height:1.7">
          <ol style="padding-left:1.25rem">
            <li>Deploy rules: <code>firebase deploy --only firestore:rules,storage</code></li>
            <li>Create Auth user (Email/Password) in Firebase Console</li>
            <li>Create Firestore doc <code>admins/{uid}</code> with field <code>active: true</code></li>
            <li>Seed products & reviews from this panel</li>
            <li>Set WhatsApp number and UPI ID above</li>
            <li>Add FAQs from the FAQs menu — they appear on the storefront</li>
          </ol>
        </div>
      </div>
    `;
  }

  function bindSettingsActions() {
    $('#saveSettingsBtn')?.addEventListener('click', async () => {
      if (!(await requireAdmin())) return;
      try {
        await db.collection('settings').doc('store').set({
          whatsapp: $('#sWhatsapp')?.value.trim() || '',
          upiId: $('#sUpiId')?.value.trim() || '',
          upiName: $('#sUpiName')?.value.trim() || '',
          email: $('#sEmail')?.value.trim() || '',
          location: $('#sLocation')?.value.trim() || '',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        showToast('Settings saved');
        storeSettings = {
          whatsapp: $('#sWhatsapp')?.value.trim(),
          upiId: $('#sUpiId')?.value.trim(),
          upiName: $('#sUpiName')?.value.trim(),
          email: $('#sEmail')?.value.trim(),
          location: $('#sLocation')?.value.trim()
        };
      } catch (e) {
        showToast('Save failed: ' + e.message);
      }
    });
  }

  // ---------- Boot ----------
  function bindGlobal() {
    $('#loginForm')?.addEventListener('submit', handleLogin);
    $('#logoutBtn')?.addEventListener('click', handleLogout);
    $$('.nav-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!(await requireAdmin())) return;
        setView(btn.dataset.view);
      });
    });
    $('#menuToggle')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('open'));
    $('#modalClose')?.addEventListener('click', closeModal);
    $('#modalOverlay')?.addEventListener('click', (e) => {
      if (e.target === $('#modalOverlay')) closeModal();
    });
    // delegated seed from dashboard
    document.addEventListener('click', async (e) => {
      if (e.target?.id === 'seedProductsBtn') {
        if (!(await requireAdmin())) return;
        seedProducts();
      }
      if (e.target?.dataset?.goto) {
        if (!(await requireAdmin())) return;
        setView(e.target.dataset.goto);
      }
    });
  }

  function init() {
    // Always start on login — admin UI stays hidden until verified admin
    showLogin();
    if (!initFirebase()) {
      showLogin('Firebase SDK failed to load');
      return;
    }
    bindGlobal();

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        currentUser = null;
        showLogin();
        return;
      }
      const ok = await isAdminUser(user);
      if (!ok) {
        await auth.signOut();
        showLogin('Not an active admin. Create admins/' + user.uid + ' with active:true');
        return;
      }
      currentUser = user;
      showApp(user);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
