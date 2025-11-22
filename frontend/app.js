const API = "http://127.0.0.1:8000";
let currentTransactionType = 'expense';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    loadDashboard();
    loadTransactions();
});

// -------------------------
// Tab Switching
// -------------------------
function switchTab(tab) {
    const dashboardSection = document.getElementById('dashboard-section');
    const transactionsSection = document.getElementById('transactions-section');
    const loanSection = document.getElementById('loan-section');
    const navBtns = document.querySelectorAll('.nav-btn');

    navBtns.forEach(t => t.classList.remove('active'));

    [dashboardSection, transactionsSection, loanSection].forEach(s => s.classList.remove('active'));

    if (tab === 'dashboard') {
        dashboardSection.classList.add('active');
        navBtns[0].classList.add('active');
        loadDashboard();
    } else if (tab === 'transactions') {
        transactionsSection.classList.add('active');
        navBtns[1].classList.add('active');
        loadTransactions();
    } else if (tab === 'loan') {
        loanSection.classList.add('active');
        navBtns[2].classList.add('active');
    }
}

// -------------------------
// Transaction Type Toggle
// -------------------------
function setTransactionType(type) {
    currentTransactionType = type;
    const expenseBtn = document.getElementById('expense-btn');
    const incomeBtn = document.getElementById('income-btn');
    const expenseFields = document.getElementById('expense-fields');
    const incomeFields = document.getElementById('income-fields');
    const category = document.getElementById('category');
    const source = document.getElementById('source');

    if (type === 'expense') {
        expenseBtn.classList.add('active');
        incomeBtn.classList.remove('active');
        expenseFields.style.display = 'block';
        incomeFields.style.display = 'none';
        category.required = true;
        source.required = false;
    } else {
        incomeBtn.classList.add('active');
        expenseBtn.classList.remove('active');
        expenseFields.style.display = 'none';
        incomeFields.style.display = 'block';
        category.required = false;
        source.required = false;
    }
}

// -------------------------
// Add Transaction
// -------------------------
async function addTransaction(event) {
    event.preventDefault();

    const amount = parseFloat(document.getElementById('amount').value);
    const date = document.getElementById('date').value;

    try {
        if (currentTransactionType === 'expense') {
            const category = document.getElementById('category').value;
            const description = document.getElementById('description').value;

            await fetch(`${API}/expenses`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amount, category, description, date})
            });
        } else {
            const source = document.getElementById('source').value;

            await fetch(`${API}/income`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amount, source, date})
            });
        }

        document.getElementById('transaction-form').reset();
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;

        loadDashboard();
        loadTransactions();

        alert('Transaction added successfully!');
    } catch (error) {
        alert('Error adding transaction. Make sure the backend is running.');
    }
}

// -------------------------
// Load Dashboard
// -------------------------
async function loadDashboard() {
    try {
        const analyticsRes = await fetch(`${API}/analytics`);
        const analytics = await analyticsRes.json();

        document.getElementById('totalIncome').textContent = `$${analytics.total_income.toFixed(2)}`;
        document.getElementById('totalExpenses').textContent = `$${analytics.total_expenses.toFixed(2)}`;
        document.getElementById('netAmount').textContent = `$${analytics.net.toFixed(2)}`;

        const categoryContainer = document.getElementById('categoryBreakdown');
        if (Object.keys(analytics.by_category).length > 0) {
            let html = '';
            for (const [category, amount] of Object.entries(analytics.by_category)) {
                html += `
                    <div class="category-item">
                        <span class="category-name">${category}</span>
                        <span class="category-amount">$${amount.toFixed(2)}</span>
                    </div>
                `;
            }
            categoryContainer.innerHTML = html;
        } else {
            categoryContainer.innerHTML = '<p class="text-muted">No expenses yet</p>';
        }

        const expensesRes = await fetch(`${API}/expenses`);
        const expenses = await expensesRes.json();

        const incomeRes = await fetch(`${API}/income`);
        const income = await incomeRes.json();

        const allTransactions = [
            ...expenses.map(e => ({...e, type: 'expense'})),
            ...income.map(i => ({...i, type: 'income', category: i.source}))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

        displayRecentTransactions(allTransactions);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function displayRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');

    if (transactions.length === 0) {
        container.innerHTML = '<p class="text-muted">No transactions yet</p>';
        return;
    }

    let html = '';
    transactions.forEach(t => {
        const typeClass = t.type;
        const sign = t.type === 'income' ? '+' : '-';
        const displayCategory = t.type === 'income' ? (t.source || 'Income') : t.category;
        const displayDesc = t.type === 'income' ? '' : t.description;

        html += `
            <div class="transaction-item ${typeClass}">
                <div class="transaction-info">
                    <div class="transaction-category">${displayCategory}</div>
                    ${displayDesc ? `<div class="transaction-desc">${displayDesc}</div>` : ''}
                    <div class="transaction-date">${formatDate(t.date)}</div>
                </div>
                <span class="transaction-amount ${typeClass}">${sign}$${t.amount.toFixed(2)}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

// -------------------------
// Load All Transactions
// -------------------------
async function loadTransactions() {
    try {
        const category = document.getElementById('filterCategory')?.value || '';
        let url = `${API}/expenses`;
        if (category) {
            url += `?category=${category}`;
        }

        const expensesRes = await fetch(url);
        const expenses = await expensesRes.json();

        const incomeRes = await fetch(`${API}/income`);
        const income = await incomeRes.json();

        const allTransactions = [
            ...expenses.map(e => ({...e, type: 'expense'})),
            ...income.map(i => ({...i, type: 'income', category: i.source}))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        displayAllTransactions(allTransactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function displayAllTransactions(transactions) {
    const container = document.getElementById('allTransactions');

    if (transactions.length === 0) {
        container.innerHTML = '<p class="text-muted">No transactions yet</p>';
        return;
    }

    let html = '';
    transactions.forEach(t => {
        const typeClass = t.type;
        const sign = t.type === 'income' ? '+' : '-';
        const displayCategory = t.type === 'income' ? (t.source || 'Income') : t.category;
        const displayDesc = t.type === 'income' ? '' : t.description;

        html += `
            <div class="transaction-item ${typeClass}">
                <div class="transaction-info">
                    <div class="transaction-category">${displayCategory}</div>
                    ${displayDesc ? `<div class="transaction-desc">${displayDesc}</div>` : ''}
                    <div class="transaction-date">${formatDate(t.date)}</div>
                </div>
                <span class="transaction-amount ${typeClass}">${sign}$${t.amount.toFixed(2)}</span>
                <button class="transaction-delete" onclick="deleteTransaction(${t.id}, '${t.type}')">Delete</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// -------------------------
// Delete Transaction
// -------------------------
async function deleteTransaction(id, type) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }

    try {
        const endpoint = type === 'expense' ? 'expenses' : 'income';
        await fetch(`${API}/${endpoint}/${id}`, {
            method: 'DELETE'
        });

        loadDashboard();
        loadTransactions();
    } catch (error) {
        alert('Error deleting transaction.');
    }
}

// -------------------------
// Helper Functions
// -------------------------
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// -------------------------
// Loan Calculator
// -------------------------
async function calculateLoan() {
    const data = {
        principal: parseFloat(document.getElementById("principal").value) || 0,
        annual_rate: parseFloat(document.getElementById("rate").value) || 0,
        years: parseInt(document.getElementById("years").value) || 0,
        extra_payment: parseFloat(document.getElementById("extra_payment").value) || 0
    };

    if (data.principal <= 0 || data.years <= 0) {
        document.getElementById("loanResult").innerHTML =
            '<div class="alert alert-warning">Please enter valid loan amount and term.</div>';
        return;
    }

    try {
        const res = await fetch(`${API}/calc/loan`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        });

        const result = await res.json();
        displayLoanResults(result, data.extra_payment);
    } catch (error) {
        document.getElementById("loanResult").innerHTML =
            '<div class="alert alert-warning">Error calculating loan. Make sure the backend is running.</div>';
    }
}

function displayLoanResults(result, extraPayment) {
    const container = document.getElementById("loanResult");

    let html = `
        <div class="result-summary">
            <div class="result-item">
                <span class="label">Monthly Payment</span>
                <span class="value">$${result.monthly_payment.toFixed(2)}</span>
            </div>
    `;

    if (extraPayment > 0) {
        html += `
            <div class="result-item">
                <span class="label">Total with Extra Payment</span>
                <span class="value">$${result.total_with_extra.toFixed(2)}</span>
            </div>
        `;
    }

    html += `
            <div class="result-item">
                <span class="label">Total Amount Paid</span>
                <span class="value">$${result.total_paid.toFixed(2)}</span>
            </div>
            <div class="result-item">
                <span class="label">Total Interest</span>
                <span class="value">$${result.total_interest.toFixed(2)}</span>
            </div>
            <div class="result-item">
                <span class="label">Time to Pay Off</span>
                <span class="value">${result.years_to_payoff} years (${result.months_to_payoff} months)</span>
            </div>
        </div>
    `;

    if (result.amortization_schedule && result.amortization_schedule.length > 0) {
        html += `
            <div class="amortization-table">
                <h3>First Year Amortization Schedule</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Payment</th>
                            <th>Principal</th>
                            <th>Interest</th>
                            <th>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        result.amortization_schedule.forEach(payment => {
            html += `
                <tr>
                    <td>${payment.payment_number}</td>
                    <td>$${payment.payment_amount.toFixed(2)}</td>
                    <td>$${payment.principal_paid.toFixed(2)}</td>
                    <td>$${payment.interest_paid.toFixed(2)}</td>
                    <td>$${payment.remaining_balance.toFixed(2)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    }

    container.innerHTML = html;
}
