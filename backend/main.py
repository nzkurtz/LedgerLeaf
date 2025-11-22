from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime, date
import sqlite3
import math
import json

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Database Setup
# -------------------------

def init_db():
    conn = sqlite3.connect('ledgerleaf.db')
    c = conn.cursor()

    c.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS income (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            source TEXT,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')

    conn.commit()
    conn.close()

init_db()

# -------------------------
# Data Models
# -------------------------

class ExpenseCreate(BaseModel):
    amount: float
    category: str
    description: Optional[str] = ""
    date: str

class IncomeCreate(BaseModel):
    amount: float
    source: Optional[str] = ""
    date: str

class Expense(BaseModel):
    id: int
    amount: float
    category: str
    description: Optional[str]
    date: str
    created_at: str

class Income(BaseModel):
    id: int
    amount: float
    source: Optional[str]
    date: str
    created_at: str

class LoanInput(BaseModel):
    principal: float
    annual_rate: float
    years: int
    extra_payment: float = 0


# -------------------------
# Database Helper Functions
# -------------------------

def get_db():
    conn = sqlite3.connect('ledgerleaf.db')
    conn.row_factory = sqlite3.Row
    return conn

# -------------------------
# Calculation Functions
# -------------------------

def calculate_loan(data: LoanInput):
    P = data.principal
    r = data.annual_rate / 100 / 12
    n = data.years * 12
    extra = data.extra_payment

    if r == 0:
        monthly = P / n
    else:
        monthly = P * r / (1 - (1 + r) ** -n)

    total_payment = monthly + extra
    total_paid = 0
    total_interest = 0
    balance = P
    amortization_schedule = []
    payment_num = 1

    while balance > 0 and payment_num <= n * 2:
        interest_payment = balance * r
        principal_payment = min(monthly + extra - interest_payment, balance)

        if principal_payment <= 0:
            break

        balance -= principal_payment
        total_paid += principal_payment + interest_payment
        total_interest += interest_payment

        amortization_schedule.append({
            "payment_number": payment_num,
            "payment_amount": round(principal_payment + interest_payment, 2),
            "principal_paid": round(principal_payment, 2),
            "interest_paid": round(interest_payment, 2),
            "remaining_balance": round(max(balance, 0), 2)
        })

        payment_num += 1

    actual_months = len(amortization_schedule)

    return {
        "monthly_payment": round(monthly, 2),
        "total_with_extra": round(monthly + extra, 2),
        "total_paid": round(total_paid, 2),
        "total_interest": round(total_interest, 2),
        "months_to_payoff": actual_months,
        "years_to_payoff": round(actual_months / 12, 1),
        "amortization_schedule": amortization_schedule[:12]
    }


# -------------------------
# Routes
# -------------------------

@app.get("/")
def root():
    return {"message": "LedgerLeaf Expense Tracker API"}

# Expense Routes
@app.post("/expenses", response_model=Expense)
def create_expense(expense: ExpenseCreate):
    conn = get_db()
    c = conn.cursor()
    created_at = datetime.now().isoformat()

    c.execute('''
        INSERT INTO expenses (amount, category, description, date, created_at)
        VALUES (?, ?, ?, ?, ?)
    ''', (expense.amount, expense.category, expense.description, expense.date, created_at))

    conn.commit()
    expense_id = c.lastrowid
    conn.close()

    return Expense(
        id=expense_id,
        amount=expense.amount,
        category=expense.category,
        description=expense.description,
        date=expense.date,
        created_at=created_at
    )

@app.get("/expenses", response_model=List[Expense])
def get_expenses(category: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None):
    conn = get_db()
    c = conn.cursor()

    query = "SELECT * FROM expenses WHERE 1=1"
    params = []

    if category:
        query += " AND category = ?"
        params.append(category)
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    query += " ORDER BY date DESC"

    c.execute(query, params)
    rows = c.fetchall()
    conn.close()

    return [Expense(**dict(row)) for row in rows]

@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    conn.commit()
    deleted = c.rowcount
    conn.close()

    if deleted == 0:
        raise HTTPException(status_code=404, detail="Expense not found")

    return {"message": "Expense deleted"}

# Income Routes
@app.post("/income", response_model=Income)
def create_income(income: IncomeCreate):
    conn = get_db()
    c = conn.cursor()
    created_at = datetime.now().isoformat()

    c.execute('''
        INSERT INTO income (amount, source, date, created_at)
        VALUES (?, ?, ?, ?)
    ''', (income.amount, income.source, income.date, created_at))

    conn.commit()
    income_id = c.lastrowid
    conn.close()

    return Income(
        id=income_id,
        amount=income.amount,
        source=income.source,
        date=income.date,
        created_at=created_at
    )

@app.get("/income", response_model=List[Income])
def get_income(start_date: Optional[str] = None, end_date: Optional[str] = None):
    conn = get_db()
    c = conn.cursor()

    query = "SELECT * FROM income WHERE 1=1"
    params = []

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    query += " ORDER BY date DESC"

    c.execute(query, params)
    rows = c.fetchall()
    conn.close()

    return [Income(**dict(row)) for row in rows]

@app.delete("/income/{income_id}")
def delete_income(income_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM income WHERE id = ?", (income_id,))
    conn.commit()
    deleted = c.rowcount
    conn.close()

    if deleted == 0:
        raise HTTPException(status_code=404, detail="Income not found")

    return {"message": "Income deleted"}

# Analytics Route
@app.get("/analytics")
def get_analytics(start_date: Optional[str] = None, end_date: Optional[str] = None):
    conn = get_db()
    c = conn.cursor()

    # Get expense summary by category
    query = "SELECT category, SUM(amount) as total FROM expenses WHERE 1=1"
    params = []

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    query += " GROUP BY category"

    c.execute(query, params)
    categories = {row[0]: row[1] for row in c.fetchall()}

    # Get total income
    income_query = "SELECT SUM(amount) FROM income WHERE 1=1"
    income_params = []

    if start_date:
        income_query += " AND date >= ?"
        income_params.append(start_date)
    if end_date:
        income_query += " AND date <= ?"
        income_params.append(end_date)

    c.execute(income_query, income_params)
    total_income = c.fetchone()[0] or 0

    # Get total expenses
    expense_query = "SELECT SUM(amount) FROM expenses WHERE 1=1"
    c.execute(expense_query, params)
    total_expenses = c.fetchone()[0] or 0

    conn.close()

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "net": round(total_income - total_expenses, 2),
        "by_category": {k: round(v, 2) for k, v in categories.items()}
    }

# Loan Calculator Route
@app.post("/calc/loan")
def loan_route(data: LoanInput):
    return calculate_loan(data)
