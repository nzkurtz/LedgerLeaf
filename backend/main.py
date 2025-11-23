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

    c.execute('''
        CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            principal REAL NOT NULL,
            annual_rate REAL NOT NULL,
            years INTEGER NOT NULL,
            extra_payment REAL DEFAULT 0,
            monthly_payment REAL NOT NULL,
            start_date TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS recurring_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            source TEXT,
            description TEXT,
            day_of_month INTEGER NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL UNIQUE,
            monthly_limit REAL NOT NULL,
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

class LoanCreate(BaseModel):
    name: str
    principal: float
    annual_rate: float
    years: int
    extra_payment: float = 0
    start_date: str

class Loan(BaseModel):
    id: int
    name: str
    principal: float
    annual_rate: float
    years: int
    extra_payment: float
    monthly_payment: float
    start_date: str
    is_active: bool
    created_at: str

class RecurringTransactionCreate(BaseModel):
    type: str  # 'expense' or 'income'
    amount: float
    category: Optional[str] = None
    source: Optional[str] = None
    description: Optional[str] = ""
    day_of_month: int

class RecurringTransaction(BaseModel):
    id: int
    type: str
    amount: float
    category: Optional[str]
    source: Optional[str]
    description: Optional[str]
    day_of_month: int
    is_active: bool
    created_at: str

class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float

class Budget(BaseModel):
    id: int
    category: str
    monthly_limit: float
    created_at: str


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
def get_expenses(
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    conn = get_db()
    c = conn.cursor()

    query = "SELECT * FROM expenses WHERE 1=1"
    params = []

    if month and year:
        query += " AND strftime('%Y', date) = ? AND strftime('%m', date) = ?"
        params.append(str(year))
        params.append(f"{month:02d}")
    else:
        if start_date:
            query += " AND date >= ?"
            params.append(start_date)
        if end_date:
            query += " AND date <= ?"
            params.append(end_date)

    if category:
        query += " AND category = ?"
        params.append(category)

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
def get_income(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    conn = get_db()
    c = conn.cursor()

    query = "SELECT * FROM income WHERE 1=1"
    params = []

    if month and year:
        query += " AND strftime('%Y', date) = ? AND strftime('%m', date) = ?"
        params.append(str(year))
        params.append(f"{month:02d}")
    else:
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
def get_analytics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    conn = get_db()
    c = conn.cursor()

    # Get expense summary by category
    query = "SELECT category, SUM(amount) as total FROM expenses WHERE 1=1"
    params = []

    if month and year:
        query += " AND strftime('%Y', date) = ? AND strftime('%m', date) = ?"
        params.append(str(year))
        params.append(f"{month:02d}")
    else:
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

    if month and year:
        income_query += " AND strftime('%Y', date) = ? AND strftime('%m', date) = ?"
        income_params.append(str(year))
        income_params.append(f"{month:02d}")
    else:
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
    if month and year:
        expense_query += " AND strftime('%Y', date) = ? AND strftime('%m', date) = ?"
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

# Loan Management Routes
@app.post("/loans", response_model=Loan)
def create_loan(loan: LoanCreate):
    conn = get_db()
    c = conn.cursor()
    created_at = datetime.now().isoformat()

    # Calculate monthly payment
    P = loan.principal
    r = loan.annual_rate / 100 / 12
    n = loan.years * 12

    if r == 0:
        monthly_payment = P / n
    else:
        monthly_payment = P * r / (1 - (1 + r) ** -n)

    monthly_payment = round(monthly_payment, 2)

    c.execute('''
        INSERT INTO loans (name, principal, annual_rate, years, extra_payment, monthly_payment, start_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (loan.name, loan.principal, loan.annual_rate, loan.years, loan.extra_payment, monthly_payment, loan.start_date, created_at))

    conn.commit()
    loan_id = c.lastrowid
    conn.close()

    return Loan(
        id=loan_id,
        name=loan.name,
        principal=loan.principal,
        annual_rate=loan.annual_rate,
        years=loan.years,
        extra_payment=loan.extra_payment,
        monthly_payment=monthly_payment,
        start_date=loan.start_date,
        is_active=True,
        created_at=created_at
    )

@app.get("/loans", response_model=List[Loan])
def get_loans(active_only: bool = True):
    conn = get_db()
    c = conn.cursor()

    query = "SELECT * FROM loans"
    if active_only:
        query += " WHERE is_active = 1"
    query += " ORDER BY created_at DESC"

    c.execute(query)
    rows = c.fetchall()
    conn.close()

    return [Loan(**dict(row)) for row in rows]

@app.delete("/loans/{loan_id}")
def delete_loan(loan_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE loans SET is_active = 0 WHERE id = ?", (loan_id,))
    conn.commit()
    updated = c.rowcount
    conn.close()

    if updated == 0:
        raise HTTPException(status_code=404, detail="Loan not found")

    return {"message": "Loan deactivated"}

@app.get("/loans/monthly-total")
def get_monthly_loan_total(month: Optional[int] = None, year: Optional[int] = None):
    conn = get_db()
    c = conn.cursor()

    # Get all active loans
    c.execute("SELECT monthly_payment, extra_payment, start_date FROM loans WHERE is_active = 1")
    loans = c.fetchall()
    conn.close()

    total = 0
    for loan in loans:
        monthly_payment = loan[0]
        extra_payment = loan[1]
        start_date = loan[2]

        # Check if loan is active for the given month
        if month and year:
            start = datetime.fromisoformat(start_date)
            if start.year < year or (start.year == year and start.month <= month):
                total += monthly_payment + extra_payment
        else:
            total += monthly_payment + extra_payment

    return {"total": round(total, 2)}

# Recurring Transaction Routes
@app.post("/recurring-transactions", response_model=RecurringTransaction)
def create_recurring_transaction(recurring: RecurringTransactionCreate):
    conn = get_db()
    c = conn.cursor()
    created_at = datetime.now().isoformat()

    c.execute('''
        INSERT INTO recurring_transactions (type, amount, category, source, description, day_of_month, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (recurring.type, recurring.amount, recurring.category, recurring.source, recurring.description, recurring.day_of_month, created_at))

    conn.commit()
    recurring_id = c.lastrowid
    conn.close()

    return RecurringTransaction(
        id=recurring_id,
        type=recurring.type,
        amount=recurring.amount,
        category=recurring.category,
        source=recurring.source,
        description=recurring.description,
        day_of_month=recurring.day_of_month,
        is_active=True,
        created_at=created_at
    )

@app.get("/recurring-transactions", response_model=List[RecurringTransaction])
def get_recurring_transactions(active_only: bool = True):
    conn = get_db()
    c = conn.cursor()

    query = "SELECT * FROM recurring_transactions"
    if active_only:
        query += " WHERE is_active = 1"
    query += " ORDER BY day_of_month ASC"

    c.execute(query)
    rows = c.fetchall()
    conn.close()

    return [RecurringTransaction(**dict(row)) for row in rows]

@app.delete("/recurring-transactions/{recurring_id}")
def delete_recurring_transaction(recurring_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE recurring_transactions SET is_active = 0 WHERE id = ?", (recurring_id,))
    conn.commit()
    updated = c.rowcount
    conn.close()

    if updated == 0:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")

    return {"message": "Recurring transaction deactivated"}

# Budget Routes
@app.post("/budgets", response_model=Budget)
def create_or_update_budget(budget: BudgetCreate):
    conn = get_db()
    c = conn.cursor()
    created_at = datetime.now().isoformat()

    # Check if budget already exists for this category
    c.execute("SELECT id FROM budgets WHERE category = ?", (budget.category,))
    existing = c.fetchone()

    if existing:
        # Update existing budget
        c.execute('''
            UPDATE budgets SET monthly_limit = ? WHERE category = ?
        ''', (budget.monthly_limit, budget.category))
        budget_id = existing[0]
    else:
        # Create new budget
        c.execute('''
            INSERT INTO budgets (category, monthly_limit, created_at)
            VALUES (?, ?, ?)
        ''', (budget.category, budget.monthly_limit, created_at))
        budget_id = c.lastrowid

    conn.commit()

    # Fetch the budget to return
    c.execute("SELECT * FROM budgets WHERE id = ?", (budget_id,))
    row = c.fetchone()
    conn.close()

    return Budget(**dict(row))

@app.get("/budgets", response_model=List[Budget])
def get_budgets():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM budgets ORDER BY category ASC")
    rows = c.fetchall()
    conn.close()

    return [Budget(**dict(row)) for row in rows]

@app.delete("/budgets/{budget_id}")
def delete_budget(budget_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM budgets WHERE id = ?", (budget_id,))
    conn.commit()
    deleted = c.rowcount
    conn.close()

    if deleted == 0:
        raise HTTPException(status_code=404, detail="Budget not found")

    return {"message": "Budget deleted"}

@app.get("/budgets/status")
def get_budget_status(month: Optional[int] = None, year: Optional[int] = None):
    conn = get_db()
    c = conn.cursor()

    # Get all budgets
    c.execute("SELECT category, monthly_limit FROM budgets")
    budgets = {row[0]: row[1] for row in c.fetchall()}

    # Get spending by category for the month
    query = "SELECT category, SUM(amount) as total FROM expenses WHERE 1=1"
    params = []

    if month and year:
        query += " AND strftime('%Y', date) = ? AND strftime('%m', date) = ?"
        params.append(str(year))
        params.append(f"{month:02d}")

    query += " GROUP BY category"
    c.execute(query, params)
    spending = {row[0]: row[1] for row in c.fetchall()}

    # Get recurring transaction expenses
    c.execute("SELECT category, amount FROM recurring_transactions WHERE type = 'expense'")
    recurring = c.fetchall()
    for category, amount in recurring:
        if category in spending:
            spending[category] += amount
        else:
            spending[category] = amount

    conn.close()

    # Build status for each budget
    status = []
    total_spending = sum(spending.values())

    for category, limit in budgets.items():
        # For "Overall" budget, use total spending across all categories
        if category == "Overall":
            spent = total_spending
        else:
            spent = spending.get(category, 0)

        percentage = (spent / limit * 100) if limit > 0 else 0
        remaining = limit - spent

        status.append({
            "category": category,
            "limit": round(limit, 2),
            "spent": round(spent, 2),
            "remaining": round(remaining, 2),
            "percentage": round(percentage, 1),
            "is_over": spent > limit,
            "is_overall": category == "Overall"
        })

    # Sort to put Overall first if it exists
    status.sort(key=lambda x: (not x["is_overall"], x["category"]))

    return status
