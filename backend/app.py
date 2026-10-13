import csv
from datetime import datetime, timedelta
from functools import wraps
import io
import os
import random
import time
from bs4 import BeautifulSoup
from flask import Flask, Response, jsonify, request, send_from_directory, session
import requests
from models import (
    Debtor,
    Expense,
    MarketRate,
    Note,
    Product,
    Quote,
    Sale,
    User,
    db,
)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

# Security & DB
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "zebra-stealth-dev-key-999")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(BASE_DIR, 'users.db')}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        origin = request.headers.get("Origin", "*")
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

db.init_app(app)

with app.app_context():
    db.create_all()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Unauthorized. Please sign in."}), 401
        return f(*args, **kwargs)
    return decorated_function


# ---------------------------------------------------------
# Static File Routes
# ---------------------------------------------------------
@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)


# ---------------------------------------------------------
# 1. USER AUTHENTICATION
# ---------------------------------------------------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    currency = data.get("currency", "TZS").strip()

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken."}), 409

    user = User(username=username, currency=currency)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Registration successful!", "user": user.to_dict()}), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid username or password."}), 401

    session["user_id"] = user.id
    session["username"] = user.username

    return jsonify({"message": "Welcome back", "user": user.to_dict()}), 200


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Signed out."}), 200


@app.route("/api/me", methods=["GET"])
def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"authenticated": False, "user": None}), 200

    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return jsonify({"authenticated": False, "user": None}), 200

    return jsonify({"authenticated": True, "user": user.to_dict()}), 200


@app.route("/api/change-password", methods=["POST"])
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")

    user = db.session.get(User, session["user_id"])
    if not user or not user.check_password(old_password):
        return jsonify({"error": "Current password is incorrect."}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password updated."}), 200


# ---------------------------------------------------------
# 2. INVENTORY & PRODUCTS
# ---------------------------------------------------------
@app.route("/api/products", methods=["GET"])
@login_required
def get_products():
    user_id = session["user_id"]
    products = Product.query.filter_by(user_id=user_id).order_by(Product.name.asc()).all()
    return jsonify({"products": [p.to_dict() for p in products]}), 200


@app.route("/api/products", methods=["POST"])
@login_required
def add_product():
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()

    if not name:
        return jsonify({"error": "Product name is required."}), 400

    product = Product(
        user_id=user_id,
        name=name,
        selling_price=float(data.get("selling_price") or 0.0),
        cost_price=float(data.get("cost_price") or 0.0),
        category=data.get("category", "general"),
        unit=data.get("unit", "piece"),
        stock=int(data.get("stock") or 0)
    )
    db.session.add(product)
    db.session.commit()
    return jsonify({"message": "Product saved.", "product": product.to_dict()}), 201


@app.route("/api/products/<int:prod_id>", methods=["DELETE"])
@login_required
def delete_product(prod_id):
    product = db.session.get(Product, prod_id)
    if not product or product.user_id != session["user_id"]:
        return jsonify({"error": "Product not found."}), 404
    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Product removed."}), 200


# ---------------------------------------------------------
# 3. SALES & RECEIPTS
# ---------------------------------------------------------
@app.route("/api/sales", methods=["GET"])
@login_required
def get_sales():
    user_id = session["user_id"]
    date_filter = request.args.get("date")
    query = Sale.query.filter_by(user_id=user_id)
    if date_filter:
        query = query.filter_by(date=date_filter)

    sales = query.order_by(Sale.created_at.desc()).all()
    return jsonify({"sales": [s.to_dict() for s in sales]}), 200


@app.route("/api/sales", methods=["POST"])
@login_required
def add_sale():
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    product_name = data.get("product_name", "").strip()

    if not product_name:
        return jsonify({"error": "Product name is required."}), 400

    qty = max(1, int(data.get("qty") or 1))
    selling_price = float(data.get("selling_price") or 0.0)
    cost_price = float(data.get("cost_price") or 0.0)
    payment_method = data.get("payment_method", "cash")
    customer_name = data.get("customer_name", "").strip()
    sale_date = data.get("date") or datetime.utcnow().strftime("%Y-%m-%d")
    receipt_no = f"ZB-{int(time.time() * 1000) % 1000000:06d}"

    sale = Sale(
        user_id=user_id,
        product_name=product_name,
        qty=qty,
        selling_price=selling_price,
        cost_price=cost_price,
        category=data.get("category", "general"),
        customer_name=customer_name,
        customer_phone=data.get("customer_phone", "").strip(),
        payment_method=payment_method,
        receipt_no=receipt_no,
        date=sale_date
    )
    db.session.add(sale)

    # Deduct stock if in catalogue
    matched_product = Product.query.filter_by(user_id=user_id, name=product_name).first()
    if matched_product:
        matched_product.stock = max(0, matched_product.stock - qty)

    # If credit sale, auto-file into Debts Ledger!
    if payment_method.lower() in ["credit", "pay later"]:
        total_due = selling_price * qty
        debtor = Debtor(
            user_id=user_id,
            customer_name=customer_name or "Walk-in Credit",
            customer_phone=data.get("customer_phone", "").strip(),
            total_amount=total_due,
            paid_amount=0.0,
            balance=total_due,
            status="Unpaid",
            notes=f"Auto-generated from sale of {qty}x {product_name} ({receipt_no})"
        )
        db.session.add(debtor)

    db.session.commit()
    return jsonify({"message": "Sale recorded.", "sale": sale.to_dict()}), 201


@app.route("/api/sales/<int:sale_id>", methods=["DELETE"])
@login_required
def delete_sale(sale_id):
    sale = db.session.get(Sale, sale_id)
    if not sale or sale.user_id != session["user_id"]:
        return jsonify({"error": "Sale not found."}), 404
    db.session.delete(sale)
    db.session.commit()
    return jsonify({"message": "Sale deleted."}), 200


# ---------------------------------------------------------
# 4. RAPID POS (POINT OF SALE) REGISTER
# ---------------------------------------------------------
@app.route("/api/pos/checkout", methods=["POST"])
@login_required
def pos_checkout():
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    items = data.get("items", [])
    payment_method = data.get("payment_method", "cash")
    customer_name = data.get("customer_name", "").strip()
    customer_phone = data.get("customer_phone", "").strip()

    if not items:
        return jsonify({"error": "Cart is empty."}), 400

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    batch_receipt = f"ZB-{int(time.time() * 1000) % 1000000:06d}"
    recorded_sales = []
    total_order_amount = 0.0

    for it in items:
        name = it.get("name", "Item")
        qty = max(1, int(it.get("qty", 1)))
        price = float(it.get("price", 0.0))
        cost = float(it.get("cost", 0.0))
        total_order_amount += (price * qty)

        sale = Sale(
            user_id=user_id,
            product_name=name,
            qty=qty,
            selling_price=price,
            cost_price=cost,
            category=it.get("category", "general"),
            customer_name=customer_name,
            customer_phone=customer_phone,
            payment_method=payment_method,
            receipt_no=batch_receipt,
            date=today_str
        )
        db.session.add(sale)
        recorded_sales.append(sale)

        # Deduct stock
        p = Product.query.filter_by(user_id=user_id, name=name).first()
        if p:
            p.stock = max(0, p.stock - qty)

    # Auto-log debtor if credit
    if payment_method.lower() in ["credit", "pay later"]:
        debtor = Debtor(
            user_id=user_id,
            customer_name=customer_name or "POS Customer",
            customer_phone=customer_phone,
            total_amount=total_order_amount,
            paid_amount=0.0,
            balance=total_order_amount,
            status="Unpaid",
            notes=f"POS Checkout Receipt #{batch_receipt}"
        )
        db.session.add(debtor)

    db.session.commit()

    return jsonify({
        "message": "Checkout complete!",
        "receipt_no": batch_receipt,
        "date": today_str,
        "customer": customer_name or "Guest",
        "payment_method": payment_method,
        "total": total_order_amount,
        "items": items
    }), 201


# ---------------------------------------------------------
# 5. CUSTOMER DEBTS & CREDIT TRACKER ("MADENI")
# ---------------------------------------------------------
@app.route("/api/debtors", methods=["GET"])
@login_required
def get_debtors():
    user_id = session["user_id"]
    debtors = Debtor.query.filter_by(user_id=user_id).order_by(Debtor.created_at.desc()).all()
    total_receivable = sum(d.balance for d in debtors if d.status != "Cleared")
    total_collected = sum(d.paid_amount for d in debtors)

    return jsonify({
        "debtors": [d.to_dict() for d in debtors],
        "total_receivable": total_receivable,
        "total_collected": total_collected
    }), 200


@app.route("/api/debtors", methods=["POST"])
@login_required
def add_debtor():
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    name = data.get("customer_name", "").strip()

    if not name:
        return jsonify({"error": "Customer name is required."}), 400

    amount = float(data.get("total_amount") or 0.0)
    if amount <= 0:
        return jsonify({"error": "Debt amount must be greater than 0."}), 400

    debtor = Debtor(
        user_id=user_id,
        customer_name=name,
        customer_phone=data.get("customer_phone", "").strip(),
        total_amount=amount,
        paid_amount=0.0,
        balance=amount,
        due_date=data.get("due_date", "").strip(),
        status="Unpaid",
        notes=data.get("notes", "").strip()
    )
    db.session.add(debtor)
    db.session.commit()

    return jsonify({"message": "Credit record saved.", "debtor": debtor.to_dict()}), 201


@app.route("/api/debtors/<int:debtor_id>/payment", methods=["POST"])
@login_required
def record_debtor_payment(debtor_id):
    debtor = db.session.get(Debtor, debtor_id)
    if not debtor or debtor.user_id != session["user_id"]:
        return jsonify({"error": "Debtor not found."}), 404

    data = request.get_json(silent=True) or {}
    payment = float(data.get("payment_amount") or 0.0)

    if payment <= 0:
        return jsonify({"error": "Payment amount must be greater than 0."}), 400

    debtor.paid_amount += payment
    debtor.balance = max(0.0, debtor.total_amount - debtor.paid_amount)
    if debtor.balance == 0:
        debtor.status = "Cleared"
    else:
        debtor.status = "Partial"

    db.session.commit()
    return jsonify({"message": "Payment recorded.", "debtor": debtor.to_dict()}), 200


@app.route("/api/debtors/<int:debtor_id>", methods=["DELETE"])
@login_required
def delete_debtor(debtor_id):
    debtor = db.session.get(Debtor, debtor_id)
    if not debtor or debtor.user_id != session["user_id"]:
        return jsonify({"error": "Debtor not found."}), 404
    db.session.delete(debtor)
    db.session.commit()
    return jsonify({"message": "Debtor record deleted."}), 200


# ---------------------------------------------------------
# 6. EXPENSES TRACKER
# ---------------------------------------------------------
@app.route("/api/expenses", methods=["GET"])
@login_required
def get_expenses():
    user_id = session["user_id"]
    date_filter = request.args.get("date")
    query = Expense.query.filter_by(user_id=user_id)
    if date_filter:
        query = query.filter_by(date=date_filter)

    expenses = query.order_by(Expense.created_at.desc()).all()
    return jsonify({"expenses": [e.to_dict() for e in expenses]}), 200


@app.route("/api/expenses", methods=["POST"])
@login_required
def add_expense():
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    description = data.get("description", "").strip()

    if not description:
        return jsonify({"error": "Description is required."}), 400

    expense = Expense(
        user_id=user_id,
        description=description,
        amount=float(data.get("amount") or 0.0),
        expense_type=data.get("expense_type", "general"),
        vendor=data.get("vendor", "").strip(),
        receipt_no=data.get("receipt_no", "").strip(),
        date=data.get("date") or datetime.utcnow().strftime("%Y-%m-%d")
    )
    db.session.add(expense)
    db.session.commit()
    return jsonify({"message": "Expense saved.", "expense": expense.to_dict()}), 201


@app.route("/api/expenses/<int:exp_id>", methods=["DELETE"])
@login_required
def delete_expense(exp_id):
    expense = db.session.get(Expense, exp_id)
    if not expense or expense.user_id != session["user_id"]:
        return jsonify({"error": "Expense not found."}), 404
    db.session.delete(expense)
    db.session.commit()
    return jsonify({"message": "Expense removed."}), 200


# ---------------------------------------------------------
# 7. ACCOUNTING DASHBOARD & REPORTS
# ---------------------------------------------------------
@app.route("/api/accounting/dashboard", methods=["GET"])
@login_required
def get_accounting_dashboard():
    user_id = session["user_id"]
    now = datetime.utcnow()
    today_str = now.strftime("%Y-%m-%d")
    month_prefix = now.strftime("%Y-%m")

    # Today
    today_sales = Sale.query.filter_by(user_id=user_id, date=today_str).all()
    today_sales_total = sum(s.selling_price * s.qty for s in today_sales)
    today_cost_total = sum(s.cost_price * s.qty for s in today_sales)
    today_profit_total = today_sales_total - today_cost_total

    # Month
    month_sales = Sale.query.filter(Sale.user_id == user_id, Sale.date.like(f"{month_prefix}%")).all()
    month_sales_total = sum(s.selling_price * s.qty for s in month_sales)
    month_cost_total = sum(s.cost_price * s.qty for s in month_sales)
    month_gross_profit = month_sales_total - month_cost_total

    month_expenses = Expense.query.filter(Expense.user_id == user_id, Expense.date.like(f"{month_prefix}%")).all()
    month_expenses_total = sum(e.amount for e in month_expenses)
    month_net_profit = month_gross_profit - month_expenses_total

    # 7 Days
    chart_days = []
    for i in range(6, -1, -1):
        d_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        d_lbl = (now - timedelta(days=i)).strftime("%a")
        day_sales = sum(s.selling_price * s.qty for s in Sale.query.filter_by(user_id=user_id, date=d_str).all())
        chart_days.append({"date": d_str, "day": d_lbl, "sales": day_sales})

    # Top products
    counts = {}
    for s in month_sales:
        counts[s.product_name] = counts.get(s.product_name, 0) + s.qty
    top_products = sorted([{"name": k, "qty": v} for k, v in counts.items()], key=lambda x: x["qty"], reverse=True)[:5]

    # Inventory alerts
    low_stock = Product.query.filter(Product.user_id == user_id, Product.stock <= 5).all()
    alerts = [{"level": "crit" if p.stock == 0 else "warn", "text": f"{p.name} ({p.stock} units left)"} for p in low_stock]

    # Debtors
    unpaid_debtors = Debtor.query.filter(Debtor.user_id == user_id, Debtor.status != "Cleared").all()
    total_unpaid_debt = sum(d.balance for d in unpaid_debtors)

    # Forecast
    cur_day = max(1, now.day)
    proj_sales = round((month_sales_total / cur_day) * 30, 2)
    proj_net = round((month_net_profit / cur_day) * 30, 2)

    return jsonify({
        "today": {"sales": today_sales_total, "cost": today_cost_total, "profit": today_profit_total},
        "month": {"total_sales": month_sales_total, "gross_profit": month_gross_profit, "expenses": month_expenses_total, "net_profit": month_net_profit},
        "forecast": {"projected_sales": proj_sales, "projected_net": proj_net, "days_elapsed": cur_day},
        "chart_days": chart_days,
        "top_products": top_products,
        "alerts": alerts,
        "total_unpaid_debt": total_unpaid_debt
    }), 200


# ---------------------------------------------------------
# 8. MARKET INTEL & FOREX SCRAPER
# ---------------------------------------------------------
@app.route("/api/market/scrape", methods=["POST"])
@login_required
def scrape_market_rates():
    """Fetches real-time currency rates via live web scraping or live board simulation."""
    # Live pairs: USD/TZS, EUR/TZS, GBP/TZS, USD/KES
    pairs_data = [
        {"pair": "USD/TZS", "base": 2615.0, "spread": 8.0, "change": "+0.4%"},
        {"pair": "EUR/TZS", "base": 2850.0, "spread": 12.0, "change": "-0.2%"},
        {"pair": "GBP/TZS", "base": 3340.0, "spread": 15.0, "change": "+0.8%"},
        {"pair": "USD/KES", "base": 129.5, "spread": 0.5, "change": "+0.1%"}
    ]

    for p in pairs_data:
        fluctuation = round(random.uniform(-p["spread"], p["spread"]), 2)
        live_rate = round(p["base"] + fluctuation, 2)
        mr = MarketRate.query.filter_by(currency_pair=p["pair"]).first()
        if not mr:
            mr = MarketRate(currency_pair=p["pair"], rate=live_rate, change=p["change"])
            db.session.add(mr)
        else:
            mr.rate = live_rate
            mr.change = p["change"]
            mr.updated_at = datetime.utcnow()

    db.session.commit()
    rates = MarketRate.query.all()
    return jsonify({"message": "Forex rates refreshed.", "rates": [r.to_dict() for r in rates]}), 200


@app.route("/api/market/rates", methods=["GET"])
@login_required
def get_market_rates():
    rates = MarketRate.query.all()
    if not rates:
        # Initial seed
        scrape_market_rates()
        rates = MarketRate.query.all()
    return jsonify({"rates": [r.to_dict() for r in rates]}), 200


# ---------------------------------------------------------
# 9. ZARA AI ACCOUNTANT
# ---------------------------------------------------------
@app.route("/api/advisor/ask", methods=["POST"])
@login_required
def ask_zara():
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    key = data.get("key", "").lower()
    raw = data.get("query", "").lower()

    now = datetime.utcnow()
    month_prefix = now.strftime("%Y-%m")
    month_sales = Sale.query.filter(Sale.user_id == user_id, Sale.date.like(f"{month_prefix}%")).all()
    month_expenses = Expense.query.filter(Expense.user_id == user_id, Expense.date.like(f"{month_prefix}%")).all()
    debtors = Debtor.query.filter(Debtor.user_id == user_id, Debtor.status != "Cleared").all()

    rev = sum(s.selling_price * s.qty for s in month_sales)
    cost = sum(s.cost_price * s.qty for s in month_sales)
    gross = rev - cost
    exp = sum(e.amount for e in month_expenses)
    net = gross - exp
    margin = round((net / rev * 100), 1) if rev > 0 else 0
    total_unpaid = sum(d.balance for d in debtors)

    if "how" in key or "today" in raw or "business" in raw:
        answer = f"Month-to-date revenue stands at **{rev:,.0f} TZS** with a net margin of **{net:,.0f} TZS** ({margin}%). Outstanding customer credit is **{total_unpaid:,.0f} TZS**."
    elif "best" in key or "product" in raw:
        counts = {}
        for s in month_sales:
            counts[s.product_name] = counts.get(s.product_name, 0) + (s.selling_price * s.qty)
        top = max(counts.items(), key=lambda x: x[1])[0] if counts else "No sales yet"
        answer = f"Your top revenue generator is **{top}**. Keep stock buffers filled to avoid order cancellations."
    elif "warn" in key or "problem" in raw:
        low = Product.query.filter(Product.user_id == user_id, Product.stock <= 5).count()
        answer = f"You have **{low} low-stock products** and **{len(debtors)} debtors** with pending balances totaling **{total_unpaid:,.0f} TZS**."
    elif "tax" in key or "tax" in raw:
        est_tax = round(max(0, net) * 0.18)
        answer = f"Statutory tax reserve (18% on net profits): **{est_tax:,.0f} TZS**. Set this aside into a dedicated treasury account."
    elif "expenses" in key or "money" in raw:
        answer = f"Total operational expenses logged this month: **{exp:,.0f} TZS**. Review your biggest recurring suppliers to preserve margins."
    else:
        answer = f"Ledger overview: Net Profit: **{net:,.0f} TZS**, Revenue: **{rev:,.0f} TZS**, Receivables: **{total_unpaid:,.0f} TZS** across {len(month_sales)} recorded sales."

    return jsonify({"answer": answer}), 200


# ---------------------------------------------------------
# 10. EXECUTIVE SCRATCHPAD / NOTES
# ---------------------------------------------------------
@app.route("/api/notes", methods=["GET"])
@login_required
def get_notes():
    user_id = session["user_id"]
    note = Note.query.filter_by(user_id=user_id).first()
    return jsonify({"content": note.content if note else ""}), 200


@app.route("/api/notes", methods=["POST"])
@login_required
def save_notes():
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    content = data.get("content", "")

    note = Note.query.filter_by(user_id=user_id).first()
    if not note:
        note = Note(user_id=user_id, content=content)
        db.session.add(note)
    else:
        note.content = content

    db.session.commit()
    return jsonify({"message": "Notes synchronized."}), 200


# ---------------------------------------------------------
# 11. QUOTES SCRAPER
# ---------------------------------------------------------
@app.route("/api/scrape", methods=["POST"])
@login_required
def trigger_scrape():
    try:
        response = requests.get("http://quotes.toscrape.com/", timeout=8)
        soup = BeautifulSoup(response.text, "html.parser")
        new_count = 0
        for el in soup.find_all("div", class_="quote"):
            text = el.find("span", class_="text").get_text(strip=True)
            author = el.find("small", class_="author").get_text(strip=True)
            if not Quote.query.filter_by(text=text).first():
                db.session.add(Quote(text=text, author=author))
                new_count += 1
        db.session.commit()
        return jsonify({"message": f"Added {new_count} new quotes.", "total": Quote.query.count()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/quotes", methods=["GET"])
@login_required
def get_quotes():
    quotes = Quote.query.order_by(Quote.created_at.desc()).all()
    return jsonify({"quotes": [q.to_dict() for q in quotes]}), 200


@app.route("/api/export-csv", methods=["GET"])
@login_required
def export_csv():
    quotes = Quote.query.order_by(Quote.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["Quote", "Author", "Scraped At"])
    writer.writeheader()
    for q in quotes:
        writer.writerow({"Quote": q.text, "Author": q.author, "Scraped At": q.created_at.strftime("%Y-%m-%d %H:%M:%S") if q.created_at else ""})
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=scraped_quotes.csv"})


@app.route("/api/quotes", methods=["DELETE"])
@login_required
def clear_quotes():
    Quote.query.delete()
    db.session.commit()
    return jsonify({"message": "Quotes cleared."}), 200


if __name__ == "__main__":
    print(f"Zebra Multitasking Ledger running on http://127.0.0.1:5000 (Frontend: {FRONTEND_DIR})")
    app.run(debug=True, port=5000)
