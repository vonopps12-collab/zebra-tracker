from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    pin = db.Column(db.String(10), default="1234")
    currency = db.Column(db.String(10), default="TZS")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "currency": self.currency or "TZS",
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None
        }


class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(150), nullable=False)
    selling_price = db.Column(db.Float, default=0.0)
    cost_price = db.Column(db.Float, default=0.0)
    category = db.Column(db.String(50), default="general")
    unit = db.Column(db.String(50), default="piece")
    stock = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "selling_price": self.selling_price,
            "cost_price": self.cost_price,
            "category": self.category,
            "unit": self.unit,
            "stock": self.stock,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else None
        }


class Sale(db.Model):
    __tablename__ = 'sales'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_name = db.Column(db.String(150), nullable=False)
    qty = db.Column(db.Integer, default=1)
    selling_price = db.Column(db.Float, default=0.0)
    cost_price = db.Column(db.Float, default=0.0)
    profit = db.Column(db.Float, default=0.0)
    category = db.Column(db.String(50), default="general")
    customer_name = db.Column(db.String(150), default="")
    customer_phone = db.Column(db.String(50), default="")
    payment_method = db.Column(db.String(50), default="cash") # cash, mpesa, bank, card, credit
    receipt_no = db.Column(db.String(50), default="")
    date = db.Column(db.String(20), nullable=False) # YYYY-MM-DD
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        total_sales = self.selling_price * self.qty
        total_cost = self.cost_price * self.qty
        total_profit = total_sales - total_cost
        return {
            "id": self.id,
            "product_name": self.product_name,
            "qty": self.qty,
            "selling_price": self.selling_price,
            "cost_price": self.cost_price,
            "total_sales": total_sales,
            "total_cost": total_cost,
            "profit": total_profit,
            "category": self.category,
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "payment_method": self.payment_method,
            "receipt_no": self.receipt_no or f"ZB-{self.id:05d}",
            "date": self.date,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else None
        }


class Expense(db.Model):
    __tablename__ = 'expenses'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, default=0.0)
    expense_type = db.Column(db.String(50), default="general")
    vendor = db.Column(db.String(150), default="")
    receipt_no = db.Column(db.String(100), default="")
    date = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "description": self.description,
            "amount": self.amount,
            "expense_type": self.expense_type,
            "vendor": self.vendor,
            "receipt_no": self.receipt_no,
            "date": self.date,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else None
        }


class Debtor(db.Model):
    __tablename__ = 'debtors'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    customer_name = db.Column(db.String(150), nullable=False)
    customer_phone = db.Column(db.String(50), default="")
    total_amount = db.Column(db.Float, default=0.0)
    paid_amount = db.Column(db.Float, default=0.0)
    balance = db.Column(db.Float, default=0.0)
    due_date = db.Column(db.String(50), default="")
    status = db.Column(db.String(20), default="Unpaid") # Unpaid, Partial, Cleared
    notes = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "total_amount": self.total_amount,
            "paid_amount": self.paid_amount,
            "balance": self.balance,
            "due_date": self.due_date,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else None
        }


class MarketRate(db.Model):
    __tablename__ = 'market_rates'

    id = db.Column(db.Integer, primary_key=True)
    currency_pair = db.Column(db.String(20), nullable=False, unique=True)
    rate = db.Column(db.Float, default=0.0)
    change = db.Column(db.String(20), default="+0.0%")
    source = db.Column(db.String(100), default="Live Market Feed")
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "pair": self.currency_pair,
            "rate": self.rate,
            "change": self.change,
            "source": self.source,
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M") if self.updated_at else None
        }


class Quote(db.Model):
    __tablename__ = 'quotes'

    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False, unique=True)
    author = db.Column(db.String(150), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "author": self.author,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else None
        }


class Note(db.Model):
    __tablename__ = 'notes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    content = db.Column(db.Text, default="")
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "content": self.content,
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M") if self.updated_at else None
        }
