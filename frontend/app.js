// -------------------------------------------------------------
// Base API URL Configuration
// -------------------------------------------------------------
const API_BASE = (window.location.protocol === "file:" || (window.location.port && window.location.port !== "5000"))
    ? "http://127.0.0.1:5000"
    : "";

// Global Application State
let currentUser = null;
let currentCurrency = "TZS";
let selectedSaleDate = getTodayDateStr();
let selectedExpDate = getTodayDateStr();

let cacheProducts = [];
let cacheSales = [];
let cacheExpenses = [];
let cacheDebtors = [];
let cacheQuotes = [];
let cacheRates = [];

// POS Active Cart
let posCart = [];

// Scratchpad debounce timer
let scratchpadSaveTimer = null;

function getTodayDateStr() {
    const d = new Date();
    return d.toISOString().split("T")[0];
}

function formatMoney(num) {
    if (isNaN(num) || num === null) num = 0;
    return Math.round(num).toLocaleString() + " " + currentCurrency;
}

function showToast(message) {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// -------------------------------------------------------------
// Theme & Settings
// -------------------------------------------------------------
function toggleTheme() {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("zebra_theme", isDark ? "dark" : "light");
    document.getElementById("themeToggle").textContent = isDark ? "☼" : "◑";
}

if (localStorage.getItem("zebra_theme") === "dark") {
    document.body.classList.add("dark");
    document.addEventListener("DOMContentLoaded", () => {
        const btn = document.getElementById("themeToggle");
        if (btn) btn.textContent = "☼";
    });
}

// -------------------------------------------------------------
// Navigation & Views
// -------------------------------------------------------------
function switchAuth(mode) {
    document.getElementById("tabLogin").classList.toggle("active", mode === "login");
    document.getElementById("tabRegister").classList.toggle("active", mode === "register");
    document.getElementById("formLogin").classList.toggle("hidden", mode !== "login");
    document.getElementById("formRegister").classList.toggle("hidden", mode !== "register");
}

function switchPage(pageName) {
    const pages = ["Dashboard", "Pos", "Sales", "Debtors", "Expenses", "Products", "Reports", "Advisor", "Market", "Settings"];
    pages.forEach(p => {
        const navBtn = document.getElementById(`nav${p}`);
        const pageEl = document.getElementById(`page${p}`);
        if (p === pageName) {
            if (navBtn) navBtn.classList.add("active");
            if (pageEl) pageEl.classList.add("active");
        } else {
            if (navBtn) navBtn.classList.remove("active");
            if (pageEl) pageEl.classList.remove("active");
        }
    });

    if (pageName === "Dashboard") loadDashboardData();
    if (pageName === "Pos") loadPosData();
    if (pageName === "Sales") loadSalesData();
    if (pageName === "Debtors") loadDebtorsData();
    if (pageName === "Expenses") loadExpensesData();
    if (pageName === "Products") loadProductsData();
    if (pageName === "Reports") loadReportsData();
    if (pageName === "Market") loadMarketData();
}

function showApp(user) {
    currentUser = user;
    currentCurrency = user.currency || "TZS";
    updateCurrencyLabels();

    document.getElementById("authOverlay").classList.add("hidden");
    document.getElementById("appContainer").classList.remove("hidden");

    document.getElementById("headerUsername").textContent = user.username;
    document.getElementById("headerAvatar").textContent = user.username.charAt(0).toUpperCase();
    document.getElementById("settingUsername").value = user.username;
    document.getElementById("settingCurrency").value = currentCurrency;

    switchPage("Dashboard");
    loadAllProductsForAutocomplete();
    loadScratchpad();
}

function showAuth() {
    currentUser = null;
    document.getElementById("appContainer").classList.add("hidden");
    document.getElementById("authOverlay").classList.remove("hidden");
    switchAuth("login");
}

function updateCurrencyLabels() {
    document.querySelectorAll(".currency-label").forEach(el => el.textContent = currentCurrency);
}

function updateCurrency(curr) {
    currentCurrency = curr;
    updateCurrencyLabels();
    showToast(`Currency: ${curr}`);
    loadDashboardData();
}

// -------------------------------------------------------------
// Authentication
// -------------------------------------------------------------
async function checkAuthState() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
        const data = await res.json();
        if (res.ok && data.authenticated && data.user) {
            showApp(data.user);
        } else {
            showAuth();
        }
    } catch (err) {
        showAuth();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("btnLogin");
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    btn.classList.add("loading");
    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Welcome back");
            showApp(data.user);
        } else {
            showToast(data.error || "Authentication failed");
        }
    } catch (err) {
        showToast("Cannot connect to server at http://127.0.0.1:5000");
    } finally {
        btn.classList.remove("loading");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById("btnRegister");
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value;
    const currency = document.getElementById("regCurrency").value;

    btn.classList.add("loading");
    try {
        const res = await fetch(`${API_BASE}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username, password, currency })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Account created. Please sign in.");
            switchAuth("login");
            document.getElementById("loginUsername").value = username;
            document.getElementById("loginPassword").focus();
        } else {
            showToast(data.error || "Registration failed");
        }
    } catch (err) {
        showToast("Connection error");
    } finally {
        btn.classList.remove("loading");
    }
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" });
        showToast("Signed out");
        showAuth();
    } catch (e) {
        showAuth();
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    const old_password = document.getElementById("settingOldPwd").value;
    const new_password = document.getElementById("settingNewPwd").value;
    try {
        const res = await fetch(`${API_BASE}/api/change-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ old_password, new_password })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Password updated");
            e.target.reset();
        } else {
            showToast(data.error || "Update failed");
        }
    } catch (err) {
        showToast("Error updating password");
    }
}


// -------------------------------------------------------------
// 1. OVERVIEW DASHBOARD
// -------------------------------------------------------------
async function loadDashboardData() {
    try {
        const res = await fetch(`${API_BASE}/api/accounting/dashboard`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById("dashSales").textContent = formatMoney(data.today.sales);
        document.getElementById("dashCost").textContent = formatMoney(data.today.cost);
        document.getElementById("dashProfit").textContent = formatMoney(data.today.profit);

        document.getElementById("dashMonthSales").textContent = formatMoney(data.month.total_sales);
        document.getElementById("dashMonthProfit").textContent = formatMoney(data.month.gross_profit);
        document.getElementById("dashMonthExpenses").textContent = formatMoney(data.month.expenses);
        document.getElementById("dashMonthNet").textContent = formatMoney(data.month.net_profit);
        document.getElementById("dashDebtors").textContent = formatMoney(data.total_unpaid_debt || 0);

        const curSales = data.month.total_sales;
        const projSales = data.forecast.projected_sales;
        document.getElementById("fcProjText").textContent = formatMoney(projSales);
        const ratio = projSales > 0 ? Math.min(100, Math.round((curSales / projSales) * 100)) : 100;
        document.getElementById("fcCurrentBar").style.width = `${ratio}%`;
        document.getElementById("fcSummaryText").textContent = `Day ${data.forecast.days_elapsed} of month: projected net profit of ${formatMoney(data.forecast.projected_net)}`;

        render7DaysChart(data.chart_days || []);
        renderTopProducts(data.top_products || []);

        const alertsCard = document.getElementById("alertsCard");
        const alertsContainer = document.getElementById("alertsContainer");
        if (data.alerts && data.alerts.length > 0) {
            alertsCard.classList.remove("hidden");
            alertsContainer.innerHTML = data.alerts.map(a => `
                <div style="font-size: 0.85rem; margin-top: 4px;">• ${escapeHtml(a.text)}</div>
            `).join("");
        } else {
            alertsCard.classList.add("hidden");
        }
    } catch (err) {
        console.warn("Failed to load dashboard:", err);
    }
}

function render7DaysChart(days) {
    const chartWrap = document.getElementById("dashChart");
    const labelsWrap = document.getElementById("dashChartLabels");

    const maxSales = Math.max(1, ...days.map(d => d.sales));
    chartWrap.innerHTML = days.map(d => {
        const heightPct = Math.max(10, Math.round((d.sales / maxSales) * 100));
        return `<div class="chart-bar" style="height: ${heightPct}%;" title="${d.date}: ${formatMoney(d.sales)}"></div>`;
    }).join("");

    labelsWrap.innerHTML = days.map(d => `<span>${d.day}</span>`).join("");
}

function renderTopProducts(prods) {
    const container = document.getElementById("dashTopProducts");
    if (prods.length === 0) {
        container.innerHTML = `<div class="empty">No sales recorded this month</div>`;
        return;
    }
    container.innerHTML = prods.map(p => `
        <div class="item-row">
            <div class="item-left"><span class="name">${escapeHtml(p.name)}</span></div>
            <div class="item-right font-mono">${p.qty} units</div>
        </div>
    `).join("");
}


// -------------------------------------------------------------
// 2. ⚡ RAPID POINT OF SALE (POS) SYSTEM
// -------------------------------------------------------------
async function loadPosData() {
    await loadProductsData();
    renderPosProducts(cacheProducts);
    renderPosCart();
}

function renderPosProducts(products) {
    const grid = document.getElementById("posProductGrid");
    if (products.length === 0) {
        grid.innerHTML = `<div class="empty" style="grid-column: 1/-1;">No products found. Add items under Inventory!</div>`;
        return;
    }

    grid.innerHTML = products.map(p => `
        <div class="pos-item-card" onclick="addToPosCart(${p.id})">
            <div class="pos-item-title">${escapeHtml(p.name)}</div>
            <div class="pos-item-price font-mono">${formatMoney(p.selling_price)}</div>
            <div class="pos-item-stock font-mono">${p.stock} in stock</div>
        </div>
    `).join("");
}

function filterPosProducts() {
    const q = document.getElementById("posSearch").value.toLowerCase().trim();
    if (!q) return renderPosProducts(cacheProducts);
    const filtered = cacheProducts.filter(p => p.name.toLowerCase().includes(q));
    renderPosProducts(filtered);
}

function addToPosCart(productId) {
    const product = cacheProducts.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = posCart.findIndex(item => item.id === productId);
    if (existingIndex >= 0) {
        posCart[existingIndex].qty += 1;
    } else {
        posCart.push({
            id: product.id,
            name: product.name,
            price: product.selling_price,
            cost: product.cost_price,
            category: product.category,
            qty: 1
        });
    }
    renderPosCart();
}

function updateCartQty(index, delta) {
    if (posCart[index]) {
        posCart[index].qty += delta;
        if (posCart[index].qty <= 0) {
            posCart.splice(index, 1);
        }
    }
    renderPosCart();
}

function clearPosCart() {
    posCart = [];
    renderPosCart();
}

function renderPosCart() {
    const container = document.getElementById("posCartItems");
    const totalEl = document.getElementById("posTotalDue");

    if (posCart.length === 0) {
        container.innerHTML = `<div class="empty">Cart is empty. Tap items to add.</div>`;
        totalEl.textContent = formatMoney(0);
        return;
    }

    let grandTotal = 0;
    container.innerHTML = posCart.map((item, idx) => {
        const lineTotal = item.price * item.qty;
        grandTotal += lineTotal;
        return `
            <div class="cart-row">
                <div style="flex: 1;">
                    <strong style="display:block;">${escapeHtml(item.name)}</strong>
                    <span class="font-mono" style="font-size:0.75rem; color:var(--text-secondary);">${formatMoney(item.price)} each</span>
                </div>
                <div class="cart-stepper">
                    <button class="cart-step-btn" onclick="updateCartQty(${idx}, -1)">–</button>
                    <span class="font-mono font-bold" style="min-width: 20px; text-align: center;">${item.qty}</span>
                    <button class="cart-step-btn" onclick="updateCartQty(${idx}, 1)">+</button>
                </div>
                <div class="font-mono font-bold" style="width: 80px; text-align: right;">${formatMoney(lineTotal)}</div>
            </div>
        `;
    }).join("");

    totalEl.textContent = formatMoney(grandTotal);
}

async function handlePosCheckout() {
    if (posCart.length === 0) return showToast("Cart is empty");

    const btn = document.getElementById("btnPosCheckout");
    const customer_name = document.getElementById("posCustomerName").value.trim();
    const payment_method = document.getElementById("posPaymentMethod").value;

    btn.classList.add("loading");

    try {
        const res = await fetch(`${API_BASE}/api/pos/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                items: posCart,
                customer_name,
                payment_method
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast("Order complete!");
            clearPosCart();
            document.getElementById("posCustomerName").value = "";

            // Display 1-Click Printable Receipt
            showReceipt(data);
            loadProductsData();
        } else {
            showToast(data.error || "Checkout failed");
        }
    } catch (err) {
        showToast("Connection error during checkout");
    } finally {
        btn.classList.remove("loading");
    }
}


// -------------------------------------------------------------
// 3. 🧾 1-CLICK RECEIPT MODAL
// -------------------------------------------------------------
function showReceipt(data) {
    document.getElementById("rcptNo").textContent = data.receipt_no;
    document.getElementById("rcptDate").textContent = data.date || getTodayDateStr();
    document.getElementById("rcptCustomer").textContent = data.customer || "Walk-in";
    document.getElementById("rcptPayment").textContent = (data.payment_method || "CASH").toUpperCase();
    document.getElementById("rcptTotal").textContent = formatMoney(data.total);

    const body = document.getElementById("rcptItemsBody");
    body.innerHTML = (data.items || []).map(it => `
        <div class="receipt-row">
            <span>${escapeHtml(it.name || it.product_name)}</span>
            <span>×${it.qty}</span>
            <span style="text-align: right;">${formatMoney((it.price || it.selling_price) * it.qty)}</span>
        </div>
    `).join("");

    document.getElementById("receiptModal").classList.remove("hidden");
}

function closeReceiptModal() {
    document.getElementById("receiptModal").classList.add("hidden");
}


// -------------------------------------------------------------
// 4. 📋 CUSTOMER DEBTORS & CREDIT TRACKER ("MADENI")
// -------------------------------------------------------------
async function loadDebtorsData() {
    try {
        const res = await fetch(`${API_BASE}/api/debtors`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        cacheDebtors = data.debtors || [];

        document.getElementById("debtorTotalBalance").textContent = formatMoney(data.total_receivable);
        document.getElementById("debtorTotalCollected").textContent = formatMoney(data.total_collected);
        document.getElementById("debtorsCountBadge").textContent = `${cacheDebtors.length} Accounts`;

        renderDebtorsList(cacheDebtors);
    } catch (e) {
        showToast("Error loading debtors");
    }
}

function renderDebtorsList(debtors) {
    const listEl = document.getElementById("debtorsList");
    if (debtors.length === 0) {
        listEl.innerHTML = `<div class="empty">No customer debts recorded</div>`;
        return;
    }

    listEl.innerHTML = debtors.map(d => {
        let badgeClass = "debtor-badge-unpaid";
        if (d.status === "Partial") badgeClass = "debtor-badge-partial";
        if (d.status === "Cleared") badgeClass = "debtor-badge-cleared";

        return `
            <div class="debtor-row">
                <div>
                    <strong>${escapeHtml(d.customer_name)}</strong>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
                        ${d.customer_phone ? '📞 ' + escapeHtml(d.customer_phone) + ' • ' : ''}
                        Due: ${escapeHtml(d.due_date || 'No deadline')}
                        ${d.notes ? ' • ' + escapeHtml(d.notes) : ''}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="text-align: right;">
                        <span class="${badgeClass}">${d.status}</span>
                        <div class="font-mono font-bold" style="font-size:1.05rem; margin-top:2px;">${formatMoney(d.balance)}</div>
                        <div class="font-mono" style="font-size:0.72rem; color:var(--text-muted);">Paid: ${formatMoney(d.paid_amount)} / ${formatMoney(d.total_amount)}</div>
                    </div>
                    ${d.status !== "Cleared" ? `<button class="btn-solid btn-sm" onclick="promptRecordPayment(${d.id})">Pay</button>` : ''}
                    <button class="del-btn" onclick="handleDeleteDebtor(${d.id})" title="Delete">✕</button>
                </div>
            </div>
        `;
    }).join("");
}

function openNewDebtorModal() {
    document.getElementById("debtorModal").classList.remove("hidden");
}

function closeDebtorModal() {
    document.getElementById("debtorModal").classList.add("hidden");
}

async function handleCreateDebtor(e) {
    e.preventDefault();
    const customer_name = document.getElementById("newDebtorName").value.trim();
    const customer_phone = document.getElementById("newDebtorPhone").value.trim();
    const total_amount = parseFloat(document.getElementById("newDebtorAmount").value) || 0;
    const due_date = document.getElementById("newDebtorDue").value.trim();
    const notes = document.getElementById("newDebtorNotes").value.trim();

    try {
        const res = await fetch(`${API_BASE}/api/debtors`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ customer_name, customer_phone, total_amount, due_date, notes })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Debtor account created");
            closeDebtorModal();
            loadDebtorsData();
        } else {
            showToast(data.error || "Failed to create debtor");
        }
    } catch (err) {
        showToast("Server connection error");
    }
}

async function promptRecordPayment(debtorId) {
    const amountStr = prompt("Enter amount received for this debt:");
    if (!amountStr) return;
    const payment_amount = parseFloat(amountStr);
    if (isNaN(payment_amount) || payment_amount <= 0) return showToast("Invalid amount");

    try {
        const res = await fetch(`${API_BASE}/api/debtors/${debtorId}/payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ payment_amount })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Payment logged!");
            loadDebtorsData();
            loadDashboardData();
        } else {
            showToast(data.error || "Failed to record payment");
        }
    } catch (e) {
        showToast("Connection error");
    }
}

async function handleDeleteDebtor(id) {
    if (!confirm("Delete debtor account?")) return;
    try {
        await fetch(`${API_BASE}/api/debtors/${id}`, { method: "DELETE", credentials: "include" });
        showToast("Debtor deleted");
        loadDebtorsData();
    } catch (e) {}
}


// -------------------------------------------------------------
// 5. SALES LEDGER MODULE
// -------------------------------------------------------------
function navigateSaleDate(delta) {
    const d = new Date(selectedSaleDate);
    d.setDate(d.getDate() + delta);
    selectedSaleDate = d.toISOString().split("T")[0];
    updateSaleDateLabel();
    loadSalesData();
}

function updateSaleDateLabel() {
    const isToday = selectedSaleDate === getTodayDateStr();
    document.getElementById("saleDateLabel").textContent = isToday ? `Today (${selectedSaleDate})` : selectedSaleDate;
}

async function loadSalesData() {
    updateSaleDateLabel();
    try {
        const res = await fetch(`${API_BASE}/api/sales?date=${selectedSaleDate}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        cacheSales = data.sales || [];

        const totalSales = cacheSales.reduce((acc, s) => acc + s.total_sales, 0);
        const totalCost = cacheSales.reduce((acc, s) => acc + s.total_cost, 0);
        const totalProfit = totalSales - totalCost;

        document.getElementById("saleTotalSales").textContent = formatMoney(totalSales);
        document.getElementById("saleTotalCost").textContent = formatMoney(totalCost);
        document.getElementById("saleTotalProfit").textContent = formatMoney(totalProfit);

        renderSalesList(cacheSales);
    } catch (err) {
        showToast("Error loading sales");
    }
}

function renderSalesList(sales) {
    const listEl = document.getElementById("saleList");
    if (sales.length === 0) {
        listEl.innerHTML = `<div class="empty">No sales recorded for this date</div>`;
        return;
    }

    listEl.innerHTML = sales.map(s => `
        <div class="item-row">
            <div class="item-left">
                <div class="name">${escapeHtml(s.product_name)} <span class="text-muted">× ${s.qty}</span></div>
                <div class="meta">
                    ${s.customer_name ? escapeHtml(s.customer_name) + ' • ' : ''}
                    <span class="pill-tag">${s.payment_method}</span>
                    <span class="font-mono font-bold" style="margin-left:4px;">#${s.receipt_no}</span>
                </div>
            </div>
            <div class="item-right">
                <div>
                    <div class="font-mono font-bold">${formatMoney(s.total_sales)}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary);" class="font-mono">+${formatMoney(s.profit)} profit</div>
                </div>
                <button class="btn-subtle btn-sm font-mono" onclick="viewSaleReceipt(${s.id})" title="Print Receipt">Receipt</button>
                <button class="del-btn" onclick="handleDeleteSale(${s.id})" title="Delete">✕</button>
            </div>
        </div>
    `).join("");
}

function viewSaleReceipt(saleId) {
    const s = cacheSales.find(item => item.id === saleId);
    if (s) {
        showReceipt({
            receipt_no: s.receipt_no,
            date: s.date,
            customer: s.customer_name || "Walk-in Customer",
            payment_method: s.payment_method,
            total: s.total_sales,
            items: [{ name: s.product_name, qty: s.qty, price: s.selling_price }]
        });
    }
}

function filterSalesList() {
    const q = document.getElementById("saleSearch").value.toLowerCase().trim();
    if (!q) return renderSalesList(cacheSales);
    const filtered = cacheSales.filter(s =>
        s.product_name.toLowerCase().includes(q) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
        (s.receipt_no && s.receipt_no.toLowerCase().includes(q)) ||
        s.payment_method.toLowerCase().includes(q)
    );
    renderSalesList(filtered);
}

async function handleAddSale() {
    const product_name = document.getElementById("saleProduct").value.trim();
    const qty = parseInt(document.getElementById("saleQty").value) || 1;
    const selling_price = parseFloat(document.getElementById("salePrice").value) || 0;
    const cost_price = parseFloat(document.getElementById("saleCost").value) || 0;
    const category = document.getElementById("saleCategory").value;
    const customer_name = document.getElementById("saleCustomer").value.trim();
    const payment_method = document.getElementById("salePayment").value;

    if (!product_name) return showToast("Enter product name");

    try {
        const res = await fetch(`${API_BASE}/api/sales`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                product_name, qty, selling_price, cost_price, category,
                customer_name, payment_method, date: selectedSaleDate
            })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Sale recorded");
            document.getElementById("saleProduct").value = "";
            document.getElementById("saleCustomer").value = "";
            loadSalesData();
            loadAllProductsForAutocomplete();
            if (payment_method.toLowerCase() === "credit") loadDebtorsData();
        } else {
            showToast(data.error || "Failed to record sale");
        }
    } catch (err) {
        showToast("Connection error");
    }
}

async function handleDeleteSale(id) {
    if (!confirm("Delete transaction?")) return;
    try {
        await fetch(`${API_BASE}/api/sales/${id}`, { method: "DELETE", credentials: "include" });
        showToast("Sale deleted");
        loadSalesData();
    } catch (e) {}
}


// -------------------------------------------------------------
// 6. EXPENSES MODULE
// -------------------------------------------------------------
function navigateExpDate(delta) {
    const d = new Date(selectedExpDate);
    d.setDate(d.getDate() + delta);
    selectedExpDate = d.toISOString().split("T")[0];
    updateExpDateLabel();
    loadExpensesData();
}

function updateExpDateLabel() {
    const isToday = selectedExpDate === getTodayDateStr();
    document.getElementById("expDateLabel").textContent = isToday ? `Today (${selectedExpDate})` : selectedExpDate;
}

async function loadExpensesData() {
    updateExpDateLabel();
    try {
        const res = await fetch(`${API_BASE}/api/expenses?date=${selectedExpDate}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        cacheExpenses = data.expenses || [];

        const total = cacheExpenses.reduce((acc, e) => acc + e.amount, 0);
        document.getElementById("expTotal").textContent = formatMoney(total);
        renderExpensesList(cacheExpenses);
    } catch (err) {
        showToast("Error loading expenses");
    }
}

function renderExpensesList(expenses) {
    const listEl = document.getElementById("expList");
    if (expenses.length === 0) {
        listEl.innerHTML = `<div class="empty">No expenses logged for this date</div>`;
        return;
    }

    listEl.innerHTML = expenses.map(e => `
        <div class="item-row">
            <div class="item-left">
                <div class="name">${escapeHtml(e.description)}</div>
                <div class="meta">
                    <span class="pill-tag">${e.expense_type}</span>
                    ${e.vendor ? ' • ' + escapeHtml(e.vendor) : ''}
                    ${e.receipt_no ? ' • ' + escapeHtml(e.receipt_no) : ''}
                </div>
            </div>
            <div class="item-right">
                <div class="font-mono font-bold">${formatMoney(e.amount)}</div>
                <button class="del-btn" onclick="handleDeleteExpense(${e.id})" title="Delete">✕</button>
            </div>
        </div>
    `).join("");
}

function filterExpList() {
    const q = document.getElementById("expSearch").value.toLowerCase().trim();
    if (!q) return renderExpensesList(cacheExpenses);
    const filtered = cacheExpenses.filter(e =>
        e.description.toLowerCase().includes(q) ||
        (e.vendor && e.vendor.toLowerCase().includes(q)) ||
        (e.receipt_no && e.receipt_no.toLowerCase().includes(q))
    );
    renderExpensesList(filtered);
}

async function handleAddExpense() {
    const description = document.getElementById("expDesc").value.trim();
    const amount = parseFloat(document.getElementById("expAmount").value) || 0;
    const expense_type = document.getElementById("expType").value;
    const receipt_no = document.getElementById("expReceipt").value.trim();
    const vendor = document.getElementById("expVendor").value.trim();

    if (!description) return showToast("Enter description");
    if (amount <= 0) return showToast("Enter valid amount");

    try {
        const res = await fetch(`${API_BASE}/api/expenses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ description, amount, expense_type, receipt_no, vendor, date: selectedExpDate })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Expense logged");
            document.getElementById("expDesc").value = "";
            document.getElementById("expAmount").value = "";
            document.getElementById("expReceipt").value = "";
            document.getElementById("expVendor").value = "";
            loadExpensesData();
        }
    } catch (err) {
        showToast("Connection error");
    }
}

async function handleDeleteExpense(id) {
    if (!confirm("Delete expense record?")) return;
    try {
        await fetch(`${API_BASE}/api/expenses/${id}`, { method: "DELETE", credentials: "include" });
        showToast("Expense removed");
        loadExpensesData();
    } catch (e) {}
}


// -------------------------------------------------------------
// 7. INVENTORY / PRODUCTS MODULE
// -------------------------------------------------------------
async function loadProductsData() {
    try {
        const res = await fetch(`${API_BASE}/api/products`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        cacheProducts = data.products || [];
        document.getElementById("prodCountBadge").textContent = `${cacheProducts.length} Items`;
        renderProductsGrid(cacheProducts);
    } catch (err) {
        showToast("Error loading inventory");
    }
}

function renderProductsGrid(prods) {
    const grid = document.getElementById("prodList");
    if (prods.length === 0) {
        grid.innerHTML = `<div class="empty" style="grid-column: 1 / -1;">No products in catalogue</div>`;
        return;
    }

    grid.innerHTML = prods.map(p => {
        let stockLabel = `${p.stock} units`;
        if (p.stock === 0) stockLabel = "0 in stock";
        else if (p.stock <= 5) stockLabel = `Low (${p.stock})`;

        return `
            <div class="product-card">
                <div>
                    <div class="pname">${escapeHtml(p.name)}</div>
                    <div class="pprice font-mono">${formatMoney(p.selling_price)} / ${p.unit}</div>
                    <div class="pcost font-mono">Cost: ${formatMoney(p.cost_price)}</div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <span class="pstock font-mono">${stockLabel}</span>
                    <button class="del-btn" onclick="handleDeleteProduct(${p.id})" title="Delete">✕</button>
                </div>
            </div>
        `;
    }).join("");
}

async function handleAddProduct() {
    const name = document.getElementById("prodName").value.trim();
    const selling_price = parseFloat(document.getElementById("prodSell").value) || 0;
    const cost_price = parseFloat(document.getElementById("prodCost").value) || 0;
    const unit = document.getElementById("prodUnit").value;
    const stock = parseInt(document.getElementById("prodStock").value) || 0;

    if (!name) return showToast("Enter product title");

    try {
        const res = await fetch(`${API_BASE}/api/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ name, selling_price, cost_price, unit, stock })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Product saved");
            document.getElementById("prodName").value = "";
            document.getElementById("prodSell").value = "";
            document.getElementById("prodCost").value = "";
            loadProductsData();
            loadAllProductsForAutocomplete();
        }
    } catch (err) {
        showToast("Connection error");
    }
}

async function handleDeleteProduct(id) {
    if (!confirm("Delete product?")) return;
    try {
        await fetch(`${API_BASE}/api/products/${id}`, { method: "DELETE", credentials: "include" });
        showToast("Product deleted");
        loadProductsData();
        loadAllProductsForAutocomplete();
    } catch (e) {}
}

async function loadAllProductsForAutocomplete() {
    try {
        const res = await fetch(`${API_BASE}/api/products`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        cacheProducts = data.products || [];

        const datalist = document.getElementById("productList");
        datalist.innerHTML = cacheProducts.map(p => `<option value="${escapeHtml(p.name)}">`).join("");
    } catch (e) {}
}

function onProductSelected(name) {
    const match = cacheProducts.find(p => p.name.toLowerCase() === name.toLowerCase().trim());
    if (match) {
        document.getElementById("salePrice").value = match.selling_price;
        document.getElementById("saleCost").value = match.cost_price;
    }
}


// -------------------------------------------------------------
// 8. 🌐 MARKET INTEL & QUOTES SCRAPER
// -------------------------------------------------------------
async function loadMarketData() {
    loadMarketRates();
    loadQuotesData();
}

async function loadMarketRates() {
    try {
        const res = await fetch(`${API_BASE}/api/market/rates`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        cacheRates = data.rates || [];
        renderMarketRates(cacheRates);
    } catch (e) {}
}

function renderMarketRates(rates) {
    const grid = document.getElementById("forexGrid");
    if (rates.length === 0) {
        grid.innerHTML = `<div class="empty">No exchange rates loaded</div>`;
        return;
    }

    grid.innerHTML = rates.map(r => `
        <div class="forex-card">
            <span class="forex-pair font-mono">${r.pair}</span>
            <div class="forex-rate font-mono">${r.rate.toLocaleString()}</div>
            <span class="forex-change font-mono" style="color: ${r.change.startsWith('+') ? '#16a34a' : '#dc2626'}">${r.change}</span>
        </div>
    `).join("");
}

async function refreshMarketRates() {
    showToast("Scraping live forex rates...");
    try {
        const res = await fetch(`${API_BASE}/api/market/scrape`, { method: "POST", credentials: "include" });
        const data = await res.json();
        if (res.ok) {
            showToast("Forex rates refreshed");
            renderMarketRates(data.rates || []);
        }
    } catch (e) {
        showToast("Error updating rates");
    }
}

async function loadQuotesData() {
    try {
        const res = await fetch(`${API_BASE}/api/quotes`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        cacheQuotes = data.quotes || [];
        renderQuotesHub(cacheQuotes);
    } catch (e) {
        showToast("Error loading quotes");
    }
}

function renderQuotesHub(quotes) {
    const container = document.getElementById("quotesHubList");
    if (quotes.length === 0) {
        container.innerHTML = `<div class="empty">No quotes in database. Click "Scrape Quotes" above.</div>`;
        return;
    }

    container.innerHTML = quotes.map(q => `
        <div class="quote-row">
            <div class="quote-body">“${escapeHtml(q.text)}”</div>
            <div class="quote-by font-mono">— ${escapeHtml(q.author)}</div>
        </div>
    `).join("");
}

function filterQuotesHub() {
    const q = document.getElementById("quoteSearch").value.toLowerCase().trim();
    if (!q) return renderQuotesHub(cacheQuotes);
    const filtered = cacheQuotes.filter(item =>
        item.text.toLowerCase().includes(q) || item.author.toLowerCase().includes(q)
    );
    renderQuotesHub(filtered);
}

async function handleScrapeQuotes() {
    const btn = document.getElementById("btnScrapeQuotes");
    btn.classList.add("loading");
    showToast("Extracting quotes from sandbox...");

    try {
        const res = await fetch(`${API_BASE}/api/scrape`, { method: "POST", credentials: "include" });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || "Scraped successfully");
            loadQuotesData();
        } else {
            showToast(data.error || "Scraping failed");
        }
    } catch (err) {
        showToast("Server connection error");
    } finally {
        btn.classList.remove("loading");
    }
}

async function handleExportQuotesCsv() {
    try {
        const res = await fetch(`${API_BASE}/api/export-csv`, { credentials: "include" });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "scraped_quotes.csv";
        a.click();
        URL.revokeObjectURL(url);
        showToast("Downloaded scraped_quotes.csv");
    } catch (e) {
        showToast("Download failed");
    }
}

async function handleClearQuotes() {
    if (!confirm("Clear quotes database?")) return;
    try {
        await fetch(`${API_BASE}/api/quotes`, { method: "DELETE", credentials: "include" });
        showToast("Quotes cleared");
        loadQuotesData();
    } catch (e) {}
}


// -------------------------------------------------------------
// 9. 📝 EXECUTIVE SCRATCHPAD
// -------------------------------------------------------------
function toggleScratchpad() {
    const drawer = document.getElementById("scratchpadDrawer");
    drawer.classList.toggle("hidden");
    if (!drawer.classList.contains("hidden")) {
        document.getElementById("scratchpadText").focus();
    }
}

async function loadScratchpad() {
    try {
        const res = await fetch(`${API_BASE}/api/notes`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById("scratchpadText").value = data.content || "";
    } catch (e) {}
}

function autoSaveScratchpad() {
    const status = document.getElementById("scratchpadStatus");
    status.textContent = "Syncing...";
    clearTimeout(scratchpadSaveTimer);

    scratchpadSaveTimer = setTimeout(async () => {
        const content = document.getElementById("scratchpadText").value;
        try {
            await fetch(`${API_BASE}/api/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ content })
            });
            status.textContent = "Synced with database";
        } catch (e) {
            status.textContent = "Offline (local only)";
        }
    }, 600);
}


// -------------------------------------------------------------
// 10. ⌘ COMMAND PALETTE (Ctrl+K)
// -------------------------------------------------------------
function toggleCommandPalette() {
    const modal = document.getElementById("commandModal");
    modal.classList.toggle("hidden");
    if (!modal.classList.contains("hidden")) {
        const inp = document.getElementById("commandInput");
        inp.value = "";
        inp.focus();
        filterCommands();
    }
}

document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommandPalette();
    }
    if (e.key === "Escape") {
        document.getElementById("commandModal").classList.add("hidden");
        document.getElementById("receiptModal").classList.add("hidden");
        document.getElementById("debtorModal").classList.add("hidden");
        document.getElementById("scratchpadDrawer").classList.add("hidden");
    }
});

function jumpToPage(page) {
    toggleCommandPalette();
    switchPage(page);
}

function filterCommands() {
    const q = document.getElementById("commandInput").value.toLowerCase().trim();
    const items = document.querySelectorAll(".command-item");
    items.forEach(it => {
        const text = it.textContent.toLowerCase();
        it.style.display = text.includes(q) ? "flex" : "none";
    });
}


// -------------------------------------------------------------
// 11. REPORTS & ZARA AI
// -------------------------------------------------------------
function switchReportTab(tab) {
    document.getElementById("repTabDaily").classList.toggle("active", tab === "daily");
    document.getElementById("repTabMonthly").classList.toggle("active", tab === "monthly");
    document.getElementById("repTabTax").classList.toggle("active", tab === "tax");

    document.getElementById("reportDaily").classList.toggle("hidden", tab !== "daily");
    document.getElementById("reportMonthly").classList.toggle("hidden", tab !== "monthly");
    document.getElementById("reportTax").classList.toggle("hidden", tab !== "tax");
}

async function loadReportsData() {
    try {
        const res = await fetch(`${API_BASE}/api/accounting/dashboard`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById("repDaySales").textContent = formatMoney(data.today.sales);
        document.getElementById("repDayCost").textContent = formatMoney(data.today.cost);
        document.getElementById("repDayProfit").textContent = formatMoney(data.today.profit);
        document.getElementById("repDayNet").textContent = formatMoney(data.today.profit);

        document.getElementById("repMonthSales").textContent = formatMoney(data.month.total_sales);
        document.getElementById("repMonthProfit").textContent = formatMoney(data.month.gross_profit);
        document.getElementById("repMonthExp").textContent = formatMoney(data.month.expenses);
        document.getElementById("repMonthNet").textContent = formatMoney(data.month.net_profit);

        const net = data.month.net_profit;
        const estTax = Math.round(Math.max(0, net) * 0.18);
        const netAfter = net - estTax;

        document.getElementById("taxNetProfit").textContent = formatMoney(net);
        document.getElementById("taxEstimate").textContent = formatMoney(estTax);
        document.getElementById("taxAfter").textContent = formatMoney(netAfter);
    } catch (e) {}
}

function exportFinancialCsv() {
    let csv = "Type,Date,Item,Amount,Profit\n";
    cacheSales.forEach(s => {
        csv += `Sale,${s.date},"${s.product_name}",${s.total_sales},${s.profit}\n`;
    });
    cacheExpenses.forEach(e => {
        csv += `Expense,${e.date},"${e.description}",${e.amount},0\n`;
    });
    cacheDebtors.forEach(d => {
        csv += `Debtor,${d.created_at},"${d.customer_name}",${d.balance},${d.status}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Zebra_Ledger_${getTodayDateStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Financial CSV downloaded");
}

function askZaraQuick(key) {
    callZaraApi(key, "");
}

function sendZaraChat() {
    const input = document.getElementById("chatInput");
    const query = input.value.trim();
    if (!query) return;

    appendChatMsg("user", query);
    input.value = "";
    callZaraApi("", query);
}

async function callZaraApi(key, query) {
    appendChatMsg("bot", "Analyzing ledger records...");

    try {
        const res = await fetch(`${API_BASE}/api/advisor/ask`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ key, query })
        });
        const data = await res.json();

        const chatBox = document.getElementById("chatBox");
        const lastMsg = chatBox.lastElementChild;
        if (lastMsg) lastMsg.remove();

        appendChatMsg("bot", data.answer || "Ledger balanced. Records aligned.");
    } catch (err) {
        appendChatMsg("bot", "Could not reach assistant engine.");
    }
}

function appendChatMsg(sender, text) {
    const chatBox = document.getElementById("chatBox");
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${sender}`;

    const senderLabel = sender === "bot" ? "ZARA AI" : "YOU";
    bubble.innerHTML = `
        <div class="bubble-sender font-mono">${senderLabel}</div>
        <div class="bubble-body">${text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</div>
    `;

    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", checkAuthState);
