# 🦓 Zebra Tracker — Business Accounting & Multitasking Ledger

> **A minimalist, monochromatic black-and-white business accounting suite, rapid POS counter, debt tracker, and automated scraping hub.**

Modeled on [Zebra Tracker](https://euphonious-gecko-973694.netlify.app/) and expanded into a high-performance multitasking system with decoupled REST architecture, SQLite persistence, and executive utilities.

---

## ⚡ Core Multitasking Modules

### 1. 📊 Executive Accounting Dashboard
- **Live Business KPIs:** Real-time metrics for Today's Sales, Cost of Goods Sold (COGS), Gross Profit, and Net Profit.
- **Monthly Financial Summary:** Month-to-date sales, operational expenses, and run-rate projections.
- **7-Day Interactive Sales Chart:** Monochromatic bar visualization tracking daily revenue momentum.
- **Stock Depletion Alerts:** Immediate status warnings for low stock ($\le 5$) and depleted inventory.

### 2. ⚡ Rapid Point of Sale (POS) Counter Register
- **Visual Product Tap Grid:** Quick-tap product cards to instantly increment items in the active cart.
- **Live Cart Controls:** Real-time subtotal calculation, quantity steppers (`+` / `-`), and single-click clear.
- **Multi-Tender Checkout:** Seamless payment handling via **Cash**, **M-Pesa / Mobile Money**, or **Credit / Debt**.
- **Instant Stock Sync:** Automatically decrements on-hand inventory upon checkout.

### 3. 🧾 1-Click Minimalist Printable Thermal Receipts
- **Automated Generation:** Formats clean, high-contrast thermal-style receipts right after POS checkout or from any historical transaction row.
- **Hardware-Friendly Printing:** Custom `@media print` CSS rules tailored for standard 80mm thermal receipt rolls or A4 invoice export.

### 4. 📋 Customer Debt & Credit Tracker (*Madeni Ledger*)
- **Automated Credit Recording:** Sales closed on credit immediately register debtor entries with customer contact, balance, and due dates.
- **Flexible Settlement:** Log partial or full repayments with instant balance tracking and debt clearance.

### 5. 💰 Sales & Expense Ledger
- **Sales Logging:** Comprehensive tracking with payment breakdown and customer records.
- **Operational Expense Categories:** Segregate costs by `Rent`, `Transport`, `Stock purchase`, `Staff wages`, `Utilities`, and `General`.
- **Search & Filter:** Instant real-time filtering across past transactions.

### 6. 📦 Inventory & Product Catalogue
- **SKU Management:** Track selling price, unit cost, category, measurement units (`Piece`, `Kg`, `Litre`, `Pack`, `Box`), and stock level.
- **Monochromatic Badges:** Status indicators for *In Stock*, *Low Stock*, and *Out of Stock*.

### 7. 🌐 Live Forex Rates & Web Scraper Hub
- **Currency Intelligence:** Scraped exchange rates for USD, EUR, and GBP.
- **Quotes Scraper:** Extracts inspirational quotes from `quotes.toscrape.com` with SQLite caching and browser-ready `.csv` file exports.

### 8. 📝 Floating Executive Scratchpad & `Ctrl+K` Command Palette
- **Slide-Over Notes Sheet:** Quick-access persistent scratchpad that syncs notes directly to SQLite without leaving the active workflow.
- **`Ctrl+K` Command Palette:** Keyboard navigation to jump instantly between POS, Debtors, Expenses, Inventory, and Zara AI.

### 9. 🦓 Zara — Ledger-Connected AI Business Advisor
- Directly queries your SQLite database to provide instant financial summaries, top revenue drivers, and tax reserve estimations in English or Swahili (*Habari!*).

---

## 🎨 Design Philosophy: Nonchalant Monochromatic

- Pure **high-contrast black & white** palette (`#09090b` and `#ffffff`) with hairline borders (`#27272a` / `#e4e4e7`).
- Zero visual clutter, distraction-free horizontal navigation bar.
- Typography: **Plus Jakarta Sans** for clean hierarchy, **JetBrains Mono** for financial figures and receipts.
- Day Light and Night Dark modes toggled seamlessly via `[◑]`.

---

## 📁 Repository Structure

```
zebra-tracker/
├── backend/
│   ├── app.py             # Flask REST API, auth session manager, scrapers & pos routes
│   ├── models.py          # SQLAlchemy models (User, Product, Sale, Expense, Debtor, Note, Rate)
│   ├── requirements.txt   # Python dependencies
│   └── users.db           # SQLite database (auto-generated on first run)
├── frontend/
│   ├── index.html         # Monochromatic single-page dashboard & modal interfaces
│   ├── style.css          # Black-and-white design system, receipt styling, and print CSS
│   └── app.js             # Client-side state, POS cart, modals, scratchpad & API client
├── .gitignore             # Git ignore rules for virtualenvs, databases, and caches
├── requirements.txt       # Root Python requirements
└── README.md              # Project documentation
```

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.10+
- `git`

### 1. Clone the Repository
```bash
git clone https://github.com/vonopps12-collab/zebra-tracker.git
cd zebra-tracker
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
cd backend
python app.py
```

### 4. Open the App
Navigate to:
```
http://127.0.0.1:5000
```

> **Default Demo Login:**
> - **Username:** `admin`
> - **Password:** `admin123`
> *(Or register a new account on the login screen)*

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/login` | Authenticate user and initialize secure session |
| `GET` | `/api/me` | Fetch active user profile and preferences |
| `GET` | `/api/accounting/dashboard` | Aggregated executive KPIs, projections, and charts |
| `POST` | `/api/pos/checkout` | Process multi-item POS cart and output receipt data |
| `GET` / `POST` | `/api/sales` | Retrieve sale records or log a single transaction |
| `GET` / `POST` | `/api/debtors` | Manage accounts receivable ledger |
| `POST` | `/api/debtors/<id>/payment` | Settle debtor balance partially or in full |
| `GET` / `POST` | `/api/expenses` | Manage business expense items |
| `GET` / `POST` | `/api/products` | Manage product catalogue and inventory counts |
| `GET` / `POST` | `/api/notes` | Fetch or synchronize executive scratchpad notes |
| `GET` | `/api/market/rates` | View scraped Forex exchange rates |
| `POST` | `/api/scrape` | Trigger external quotes scraper sandbox |
| `GET` | `/api/export-csv` | Download scraped quote database as CSV |
| `POST` | `/api/advisor/ask` | Ask Zara AI ledger questions |

---

## 📄 License
MIT License. Created for high-efficiency business accounting and operations management.
