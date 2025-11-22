# LedgerLeaf - Expense Tracker

A modern expense tracking web application similar to Mint and Buxfer. Track your daily expenses, manage income, and analyze your spending patterns with an intuitive interface.

## Features

### Expense Tracking
- Add expenses with category, description, amount, and date
- 10 expense categories: Housing, Food & Dining, Transportation, Utilities, Entertainment, Healthcare, Shopping, Personal Care, Education, and Other
- Add income entries with source and date
- Delete transactions easily
- Filter transactions by category
- Persistent storage with SQLite database

### Dashboard Analytics
- Real-time summary showing total income, total expenses, and net balance
- Spending breakdown by category
- Recent transactions view
- Visual representation of where your money goes

### Loan Calculator
- Calculate monthly loan payments
- See total interest over the loan lifetime
- Extra payment support to pay off loans faster
- Detailed amortization schedule (first 12 months)
- Accurate payoff timeline calculation

## Tech Stack

- **Backend**: FastAPI (Python) + SQLite
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **API**: RESTful JSON endpoints
- **Database**: SQLite for data persistence

## Installation

1. Install dependencies:
```bash
pip install fastapi uvicorn pydantic
```

2. Start the backend server:
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

The database (ledgerleaf.db) will be created automatically on first run.

3. Open the frontend:
```bash
cd frontend
# Open index.html in your browser
```

## API Endpoints

### Expense Management

#### POST /expenses
Add a new expense.

**Request:**
```json
{
  "amount": 45.99,
  "category": "Food",
  "description": "Grocery shopping",
  "date": "2025-11-22"
}
```

#### GET /expenses
Get all expenses (optionally filtered).

**Query Parameters:**
- `category`: Filter by category
- `start_date`: Filter by start date
- `end_date`: Filter by end date

#### DELETE /expenses/{id}
Delete an expense by ID.

### Income Management

#### POST /income
Add income entry.

**Request:**
```json
{
  "amount": 3000,
  "source": "Salary",
  "date": "2025-11-22"
}
```

#### GET /income
Get all income entries.

**Query Parameters:**
- `start_date`: Filter by start date
- `end_date`: Filter by end date

#### DELETE /income/{id}
Delete an income entry by ID.

### Analytics

#### GET /analytics
Get spending analytics.

**Response:**
```json
{
  "total_income": 3000.0,
  "total_expenses": 45.99,
  "net": 2954.01,
  "by_category": {
    "Food": 45.99
  }
}
```

### Loan Calculator

#### POST /calc/loan
Calculate loan payment details with amortization.

**Request:**
```json
{
  "principal": 25000,
  "annual_rate": 5.5,
  "years": 5,
  "extra_payment": 100
}
```

**Response:**
```json
{
  "monthly_payment": 477.53,
  "total_with_extra": 577.53,
  "total_paid": 27930.28,
  "total_interest": 2930.28,
  "months_to_payoff": 49,
  "years_to_payoff": 4.1,
  "amortization_schedule": [...]
}
```

## Usage

1. Start the backend server (see Installation)
2. Open `frontend/index.html` in your browser
3. Navigate between tabs:
   - **Dashboard**: View your financial summary and analytics
   - **Transactions**: Add new expenses/income and view all transactions
   - **Loan Calculator**: Calculate loan payments with amortization
4. Add transactions by selecting type (Expense/Income), filling in details, and clicking "Add Transaction"
5. View and filter your transaction history
6. Monitor your spending patterns through the dashboard

## License

MIT
