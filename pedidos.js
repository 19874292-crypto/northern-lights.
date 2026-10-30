const FREE_SHIPPING_MIN = 50;  
const SHIPPING_COST = 3.50;    
const CART_STORAGE_KEY = 'catalogia_cart';
const USERS_KEY = 'catalogia_users';
const SESSION_KEY = 'catalogia_session';

const API_URL = 'https://script.google.com/macros/s/AKfycbx2mFSjCw4EW1HLRdlkO5FfmepEAdRGtywKAfJqPfaJQDn4WYR1rjzZiMDnxE0FzMNZRw/exec';
let products = [];

async function loadProducts() {
    try {
        const res = await fetch(API_URL);
        products = await res.json();
    } catch {
        products = [];
    }
    applyFilters();
}

let cart = loadCart();
let currentCategory = 'All';
let searchQuery = '';
let toastTimer;

const $ = id => document.getElementById(id);
const money = n => `$${n.toFixed(2)}`;

window.onload = () => {

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = $('custDate');
    dateInput.value = dateInput.min = toLocalISODate(tomorrow);

    $('categoryFilters').addEventListener('click', e => {
        const btn = e.target.closest('.category-btn');
        if (btn) filterCategory(btn.dataset.category);
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        closeAuth();
        if (isCartOpen()) toggleCart();
    });

    loadProducts();
    updateCartUI();
    initAuth();
};

function toLocalISODate(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renderProducts(items) {
    const grid = $('productsGrid');
    grid.innerHTML = '';
    $('emptyState').classList.toggle('hidden', items.length > 0);

    items.forEach(product => {
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4 col-xl-3';
        const card = document.createElement('div');
        card.className = 'product-card h-full bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group';
        card.innerHTML = `
            <div class="relative overflow-hidden aspect-square bg-slate-100">
                <img src="${product.image}" alt="${product.title}" loading="lazy" class="img-fluid w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                ${product.badge ? `<span class="absolute top-3 left-3 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">${product.badge}</span>` : ''}
                <span class="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200/50">${product.category}</span>
            </div>
            <div class="p-5 flex flex-col flex-1 justify-between">
                <div>
                    <h3 class="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">${product.title}</h3>
                    <div class="mt-2 flex items-baseline gap-2">
                        <span class="text-xl font-extrabold text-slate-900">${money(product.price)}</span>
                        <span class="text-xs text-slate-400">IVA incluido</span>
                    </div>
                </div>
                <button onclick="addToCart(${product.id})" class="mt-4 w-full bg-slate-900 hover:bg-indigo-600 text-white py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    Agregar al Carrito
                </button>
            </div>
        `;
        col.appendChild(card);
        grid.appendChild(col);
    });
    lucide.createIcons();
}

function applyFilters() {
    const query = searchQuery.trim().toLowerCase();

    const filtered = products.filter(p => {
        const matchesCategory =
            currentCategory === 'All' ||
            (currentCategory === 'Ofertas' ? p.badge === 'Oferta' : p.category === currentCategory);
        const matchesQuery =
            !query || p.title.toLowerCase().includes(query) || p.category.toLowerCase().includes(query);
        return matchesCategory && matchesQuery;
    });

    renderProducts(filtered);
}

function filterCategory(category) {
    currentCategory = category;
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    applyFilters();
}


function setSearch(value) {
    searchQuery = value;
    $('searchInput').value = value;
    $('searchInputMobile').value = value;
    applyFilters();
}

function resetFilters() {
    searchQuery = '';
    $('searchInput').value = '';
    $('searchInputMobile').value = '';
    filterCategory('All');
}

function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function saveCart() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch { /* almacenamiento no disponible: se ignora */ }
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existing = cart.find(item => item.id === productId);

    if (existing) existing.quantity++;
    else cart.push({ ...product, quantity: 1 });

    updateCartUI();
    showToast(`¡${product.title} agregado al carrito!`);
}

function updateQuantity(productId, change) {
    const item = cart.find(p => p.id === productId);
    if (!item) return;

    item.quantity += change;
    if (item.quantity <= 0) cart = cart.filter(p => p.id !== productId);

    updateCartUI();
}


function getTotals() {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_COST;
    return { subtotal, shipping, total: subtotal + shipping };
}

function updateCartUI() {
    const container = $('cartItemsContainer');
    $('cartCount').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    container.innerHTML = '';

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <i data-lucide="shopping-bag" class="w-12 h-12 mx-auto mb-2 opacity-40"></i>
                <p class="font-medium text-slate-600">Tu carrito está vacío</p>
                <p class="text-xs">Agrega productos del catálogo para comenzar</p>
            </div>
        `;
        $('checkoutForm').classList.add('hidden');
    } else {
        $('checkoutForm').classList.remove('hidden');

        cart.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100';
            itemEl.innerHTML = `
                <img src="${item.image}" alt="${item.title}" class="img-fluid w-14 h-14 object-cover rounded-lg">
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-slate-800 truncate">${item.title}</h4>
                    <p class="text-xs font-semibold text-indigo-600 mt-0.5">${money(item.price)} c/u</p>
                    <div class="flex items-center gap-2 mt-2">
                        <button onclick="updateQuantity(${item.id}, -1)" aria-label="Quitar uno" class="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">-</button>
                        <span class="text-xs font-bold w-4 text-center">${item.quantity}</span>
                        <button onclick="updateQuantity(${item.id}, 1)" aria-label="Agregar uno" class="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">+</button>
                    </div>
                </div>
                <p class="text-xs font-extrabold text-slate-900 text-right">${money(item.price * item.quantity)}</p>
            `;
            container.appendChild(itemEl);
        });
    }

    const { subtotal, shipping, total } = getTotals();
    $('subtotalAmount').textContent = money(subtotal);
    $('shippingAmount').textContent = shipping === 0 ? 'Gratis' : money(shipping);
    $('totalAmount').textContent = money(total);

    saveCart();
    lucide.createIcons();
}

function isCartOpen() {
    return !$('cartSidebar').classList.contains('translate-x-full');
}

function toggleCart() {
    const open = isCartOpen();
    $('cartSidebar').classList.toggle('translate-x-full', open);
    $('cartOverlay').classList.toggle('hidden', open);
}

function clearOrder() {
    cart = [];
    updateCartUI();
    toggleCart();
}

function submitOrder(event) {
    event.preventDefault();
    if (cart.length === 0) return;

    const { shipping, total } = getTotals();

    let message = `*NUEVO PEDIDO A DOMICILIO - CATALOGIA*\n\n`;
    message += `*Cliente:* ${$('custName').value}\n`;
    message += `*Teléfono:* ${$('custPhone').value}\n`;
    message += `*Dirección:* ${$('custAddress').value}\n`;
    message += `*Fecha/Hora:* ${$('custDate').value} (${$('custTime').value})\n`;
    message += `*Método de Pago:* ${$('custPayment').value}\n\n`;
    message += `*PRODUCTOS SOLICITADOS:*\n`;
    cart.forEach(item => {
        message += `- ${item.quantity}x ${item.title} (${money(item.price * item.quantity)})\n`;
    });
    message += `\n*Envío:* ${shipping === 0 ? 'Gratis' : money(shipping)}`;
    message += `\n*TOTAL A PAGAR:* ${money(total)}`;

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
}

async function confirmSimulatedOrder() {
    if (cart.length === 0) return;
    const name = $('custName').value || 'Cliente';
    const { total } = getTotals();

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                nombre: name,
                telefono: $('custPhone').value,
                direccion: $('custAddress').value,
                fecha: $('custDate').value,
                horario: $('custTime').value,
                pago: $('custPayment').value,
                productos: cart.map(i => `${i.quantity}x ${i.title}`).join(', '),
                total: total
            })
        });
        showToast(`¡Gracias ${name}! Tu pedido ha sido registrado con éxito.`);
        clearOrder();
    } catch {
        showToast('No se pudo guardar el pedido. Intenta de nuevo.');
    }
}

function showToast(msg) {
    const toast = $('toast');
    $('toastMessage').textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

let currentUser = null;

function readStore(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function writeStore(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* almacenamiento no disponible */ }
}


async function hashPassword(password) {
    if (window.crypto && crypto.subtle) {
        const data = new TextEncoder().encode('catalogia:' + password);
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return btoa(unescape(encodeURIComponent(password)));
}

function initAuth() {
    const email = readStore(SESSION_KEY, null);
    const users = readStore(USERS_KEY, []);
    currentUser = users.find(u => u.email === email) || null;
    updateAccountUI();
}

function updateAccountUI() {
    $('accountLabel').textContent = currentUser ? `Hola, ${currentUser.name.split(' ')[0]}` : 'Iniciar sesión';


    if (currentUser) {
        $('custName').value = currentUser.name;
        $('custPhone').value = currentUser.phone;
    }
}

function openAuth() {
    showAuthView(currentUser ? 'profile' : 'login');
    $('authOverlay').classList.remove('hidden');
    $('authOverlay').classList.add('flex');
    lucide.createIcons();
}

function closeAuth() {
    $('authOverlay').classList.add('hidden');
    $('authOverlay').classList.remove('flex');
}

function showAuthView(view) {
    $('loginForm').classList.toggle('hidden', view !== 'login');
    $('registerForm').classList.toggle('hidden', view !== 'register');
    $('profileView').classList.toggle('hidden', view !== 'profile');
    $('authTabs').classList.toggle('hidden', view === 'profile');
    $('tabLogin').classList.toggle('active', view === 'login');
    $('tabRegister').classList.toggle('active', view === 'register');
    $('loginError').classList.add('hidden');
    $('registerError').classList.add('hidden');

    if (view === 'profile') {
        $('profileName').textContent = currentUser.name;
        $('profileEmail').textContent = currentUser.email;
    }
}

function showAuthError(id, message) {
    const el = $(id);
    el.textContent = message;
    el.classList.remove('hidden');
}

async function handleRegister(event) {
    event.preventDefault();

    const email = $('regEmail').value.trim().toLowerCase();
    const password = $('regPassword').value;
    const users = readStore(USERS_KEY, []);

    if (users.some(u => u.email === email)) {
        return showAuthError('registerError', 'Ya existe una cuenta con ese correo. Prueba en "Entrar".');
    }
    if (password.length < 6) {
        return showAuthError('registerError', 'La contraseña debe tener al menos 6 caracteres.');
    }

    const user = {
        name: $('regName').value.trim(),
        phone: $('regPhone').value.trim(),
        email,
        passwordHash: await hashPassword(password)
    };
    users.push(user);
    writeStore(USERS_KEY, users);

    startSession(user, `¡Bienvenido/a, ${user.name.split(' ')[0]}! Tu cuenta fue creada.`);
    event.target.reset();
}

async function handleLogin(event) {
    event.preventDefault();

    const email = $('loginEmail').value.trim().toLowerCase();
    const passwordHash = await hashPassword($('loginPassword').value);
    const user = readStore(USERS_KEY, []).find(u => u.email === email && u.passwordHash === passwordHash);

    if (!user) {
        return showAuthError('loginError', 'Correo o contraseña incorrectos.');
    }

    startSession(user, `¡Hola de nuevo, ${user.name.split(' ')[0]}!`);
    event.target.reset();
}

function startSession(user, message) {
    currentUser = user;
    writeStore(SESSION_KEY, user.email);
    updateAccountUI();
    closeAuth();
    showToast(message);
}

function handleLogout() {
    currentUser = null;
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch { /* se ignora */ }
    $('custName').value = '';
    $('custPhone').value = '';
    updateAccountUI();
    closeAuth();
    showToast('Cerraste tu sesión.');
}
