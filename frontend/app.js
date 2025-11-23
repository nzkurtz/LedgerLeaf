const API = "http://127.0.0.1:8000";
let currentTransactionType = 'expense';
let categoryChart = null;

// Month state
let currentMonth = new Date().getMonth() + 1; // 1-12
let currentYear = new Date().getFullYear();

// Month names
const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    updateMonthDisplay();
    loadDashboard();
    loadTransactions();
});

// -------------------------
// Month Navigation
// -------------------------
function updateMonthDisplay() {
    const monthText = `${monthNames[currentMonth - 1]} ${currentYear}`;
    document.getElementById('currentMonth').textContent = monthText;
}

function changeMonth(delta) {
    currentMonth += delta;

    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }

    updateMonthDisplay();
    loadDashboard();
    loadTransactions();
}

// -------------------------
// Tab Switching
// -------------------------
function switchTab(tab) {
    const dashboardSection = document.getElementById('dashboard-section');
    const transactionsSection = document.getElementById('transactions-section');
    const budgetsSection = document.getElementById('budgets-section');
    const loanSection = document.getElementById('loan-section');
    const navBtns = document.querySelectorAll('.nav-btn');

    navBtns.forEach(t => t.classList.remove('active'));

    [dashboardSection, transactionsSection, budgetsSection, loanSection].forEach(s => s.classList.remove('active'));

    if (tab === 'dashboard') {
        dashboardSection.classList.add('active');
        navBtns[0].classList.add('active');
        loadDashboard();
    } else if (tab === 'transactions') {
        transactionsSection.classList.add('active');
        navBtns[1].classList.add('active');
        loadTransactions();
        loadRecurringTransactions();
    } else if (tab === 'budgets') {
        budgetsSection.classList.add('active');
        navBtns[2].classList.add('active');
        loadBudgetStatus();
    } else if (tab === 'loan') {
        loanSection.classList.add('active');
        navBtns[3].classList.add('active');
        loadActiveLoans();
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

function toggleRecurring() {
    const isRecurring = document.getElementById('is-recurring').checked;
    const dateField = document.getElementById('date-field');
    const dayOfMonthField = document.getElementById('day-of-month-field');
    const dateInput = document.getElementById('date');
    const dayOfMonthInput = document.getElementById('day-of-month');

    if (isRecurring) {
        dateField.style.display = 'none';
        dayOfMonthField.style.display = 'block';
        dateInput.required = false;
        dayOfMonthInput.required = true;
    } else {
        dateField.style.display = 'block';
        dayOfMonthField.style.display = 'none';
        dateInput.required = true;
        dayOfMonthInput.required = false;
    }
}

// -------------------------
// Add Transaction
// -------------------------
async function addTransaction(event) {
    event.preventDefault();

    const amount = parseFloat(document.getElementById('amount').value);
    const isRecurring = document.getElementById('is-recurring').checked;

    try {
        if (isRecurring) {
            // Create recurring transaction
            const day_of_month = parseInt(document.getElementById('day-of-month').value);
            const data = {
                type: currentTransactionType,
                amount: amount,
                day_of_month: day_of_month
            };

            if (currentTransactionType === 'expense') {
                data.category = document.getElementById('category').value;
                data.description = document.getElementById('description').value;
            } else {
                data.source = document.getElementById('source').value;
            }

            await fetch(`${API}/recurring-transactions`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });

            alert('Recurring transaction added successfully!');
        } else {
            // Create regular transaction
            const date = document.getElementById('date').value;

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

            alert('Transaction added successfully!');
        }

        document.getElementById('transaction-form').reset();
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
        document.getElementById('is-recurring').checked = false;
        toggleRecurring();

        loadDashboard();
        loadTransactions();
        loadRecurringTransactions();
    } catch (error) {
        alert('Error adding transaction. Make sure the backend is running.');
    }
}

// -------------------------
// Render Category Pie Chart
// -------------------------
function renderCategoryChart(categories) {
    const ctx = document.getElementById('categoryChart');

    if (!ctx) return;

    // Destroy existing chart if it exists
    if (categoryChart) {
        categoryChart.destroy();
    }

    const labels = Object.keys(categories);
    const data = Object.values(categories);

    if (labels.length === 0) {
        return;
    }

    const colors = [
        '#2b6ba8',
        '#56ab2f',
        '#dc3545',
        '#ffc107',
        '#17a2b8',
        '#6f42c1',
        '#fd7e14',
        '#20c997',
        '#e83e8c',
        '#6c757d'
    ];

    categoryChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += '$' + context.parsed.toFixed(2);
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// -------------------------
// Load Dashboard
// -------------------------
async function loadDashboard() {
    try {
        const analyticsRes = await fetch(`${API}/analytics?month=${currentMonth}&year=${currentYear}`);
        const analytics = await analyticsRes.json();

        const loanTotalRes = await fetch(`${API}/loans/monthly-total?month=${currentMonth}&year=${currentYear}`);
        const loanTotal = await loanTotalRes.json();
        const loanPayments = loanTotal.total || 0;

        // Fetch recurring transactions to calculate their total and add to categories
        let recurringExpenseTotal = 0;
        let recurringIncomeTotal = 0;
        const recurringByCategory = {};
        try {
            const recurringRes = await fetch(`${API}/recurring-transactions`);
            const recurring = await recurringRes.json();
            recurring.forEach(r => {
                if (r.type === 'expense') {
                    recurringExpenseTotal += r.amount;
                    if (recurringByCategory[r.category]) {
                        recurringByCategory[r.category] += r.amount;
                    } else {
                        recurringByCategory[r.category] = r.amount;
                    }
                } else if (r.type === 'income') {
                    recurringIncomeTotal += r.amount;
                }
            });
        } catch (error) {
            console.error('Error loading recurring transactions for analytics:', error);
        }

        const totalIncomeWithRecurring = analytics.total_income + recurringIncomeTotal;
        const totalExpensesWithLoansAndRecurring = analytics.total_expenses + loanPayments + recurringExpenseTotal;

        document.getElementById('totalIncome').textContent = `$${totalIncomeWithRecurring.toFixed(2)}`;
        document.getElementById('totalExpenses').textContent = `$${totalExpensesWithLoansAndRecurring.toFixed(2)}`;
        document.getElementById('netAmount').textContent = `$${(totalIncomeWithRecurring - totalExpensesWithLoansAndRecurring).toFixed(2)}`;

        const categoryContainer = document.getElementById('categoryBreakdown');
        let html = '';

        // Combine categories with loan payments and recurring transactions for chart
        const allCategories = {...analytics.by_category};

        // Add recurring expenses to categories
        for (const [category, amount] of Object.entries(recurringByCategory)) {
            if (allCategories[category]) {
                allCategories[category] += amount;
            } else {
                allCategories[category] = amount;
            }
        }

        if (loanPayments > 0) {
            allCategories['Loan Payments'] = loanPayments;
        }

        // Render pie chart
        renderCategoryChart(allCategories);

        if (loanPayments > 0) {
            html += `
                <div class="category-item">
                    <span class="category-name">Loan Payments</span>
                    <span class="category-amount">$${loanPayments.toFixed(2)}</span>
                </div>
            `;
        }

        if (Object.keys(allCategories).length > 0) {
            for (const [category, amount] of Object.entries(allCategories)) {
                if (category !== 'Loan Payments') {
                    html += `
                        <div class="category-item">
                            <span class="category-name">${category}</span>
                            <span class="category-amount">$${amount.toFixed(2)}</span>
                        </div>
                    `;
                }
            }
        }

        if (html) {
            categoryContainer.innerHTML = html;
        } else {
            categoryContainer.innerHTML = '<p class="text-muted">No expenses yet</p>';
        }

        const expensesRes = await fetch(`${API}/expenses?month=${currentMonth}&year=${currentYear}`);
        const expenses = await expensesRes.json();

        const incomeRes = await fetch(`${API}/income?month=${currentMonth}&year=${currentYear}`);
        const income = await incomeRes.json();

        // Fetch loans and generate payments for recent transactions
        let loanPaymentsForRecent = [];
        try {
            const loansRes = await fetch(`${API}/loans`);
            const loans = await loansRes.json();
            loanPaymentsForRecent = generateLoanPayments(loans, currentMonth, currentYear);
        } catch (error) {
            console.error('Error loading loans for recent transactions:', error);
        }

        // Fetch recurring transactions for recent transactions
        let recurringPaymentsForRecent = [];
        try {
            const recurringRes = await fetch(`${API}/recurring-transactions`);
            const recurring = await recurringRes.json();
            recurringPaymentsForRecent = generateRecurringTransactions(recurring, currentMonth, currentYear);
        } catch (error) {
            console.error('Error loading recurring transactions for recent transactions:', error);
        }

        const allTransactions = [
            ...expenses.map(e => ({...e, type: 'expense'})),
            ...income.map(i => ({...i, type: 'income', category: i.source})),
            ...loanPaymentsForRecent,
            ...recurringPaymentsForRecent
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

        displayRecentTransactions(allTransactions);

        // Calculate and display monthly stats
        const totalCount = expenses.length + income.length;
        const avgExpense = expenses.length > 0 ? expenses.reduce((sum, e) => sum + e.amount, 0) / expenses.length : 0;
        const largestExpense = expenses.length > 0 ? Math.max(...expenses.map(e => e.amount)) : 0;

        document.getElementById('totalTransactions').textContent = totalCount;
        document.getElementById('avgExpense').textContent = `$${avgExpense.toFixed(2)}`;
        document.getElementById('largestExpense').textContent = `$${largestExpense.toFixed(2)}`;

        // Load budget progress summary
        loadDashboardBudgets();
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
// Generate Loan Payment Transactions
// -------------------------
function generateLoanPayments(loans, month, year) {
    const loanPayments = [];

    if (!loans || !Array.isArray(loans)) {
        return loanPayments;
    }

    loans.forEach(loan => {
        try {
            const startDate = new Date(loan.start_date + 'T00:00:00');
            const startYear = startDate.getFullYear();
            const startMonth = startDate.getMonth() + 1;
            const dayOfMonth = startDate.getDate();

            // First payment is in the month after the loan was taken out
            if (startYear < year || (startYear === year && startMonth < month)) {
                // Construct date string directly to avoid timezone issues
                const day = String(dayOfMonth).padStart(2, '0');
                const monthStr = String(month).padStart(2, '0');
                const dateString = `${year}-${monthStr}-${day}`;
                const totalPayment = loan.monthly_payment + loan.extra_payment;

                loanPayments.push({
                    id: `loan-${loan.id}`,
                    amount: totalPayment,
                    category: 'Loan Payment',
                    description: loan.name,
                    date: dateString,
                    type: 'expense',
                    isLoan: true
                });
            }
        } catch (error) {
            console.error('Error generating loan payment:', error);
        }
    });

    return loanPayments;
}

// -------------------------
// Load All Transactions
// -------------------------
async function loadTransactions() {
    try {
        const category = document.getElementById('filterCategory')?.value || '';
        const sortBy = document.getElementById('sortBy')?.value || 'date-desc';

        let url = `${API}/expenses?month=${currentMonth}&year=${currentYear}`;
        if (category) {
            url += `&category=${category}`;
        }

        const expensesRes = await fetch(url);
        const expenses = await expensesRes.json();

        const incomeRes = await fetch(`${API}/income?month=${currentMonth}&year=${currentYear}`);
        const income = await incomeRes.json();

        // Fetch loans and generate payments
        let loanPayments = [];
        try {
            const loansRes = await fetch(`${API}/loans`);
            const loans = await loansRes.json();
            loanPayments = generateLoanPayments(loans, currentMonth, currentYear);
        } catch (error) {
            console.error('Error loading loans:', error);
        }

        // Fetch recurring transactions and generate for current month
        let recurringPayments = [];
        try {
            const recurringRes = await fetch(`${API}/recurring-transactions`);
            const recurring = await recurringRes.json();
            recurringPayments = generateRecurringTransactions(recurring, currentMonth, currentYear);
        } catch (error) {
            console.error('Error loading recurring transactions:', error);
        }

        let allTransactions = [
            ...expenses.map(e => ({...e, type: 'expense'})),
            ...income.map(i => ({...i, type: 'income', category: i.source})),
            ...loanPayments,
            ...recurringPayments
        ];

        // Apply sorting
        switch(sortBy) {
            case 'date-desc':
                allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'date-asc':
                allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'amount-desc':
                allTransactions.sort((a, b) => b.amount - a.amount);
                break;
            case 'amount-asc':
                allTransactions.sort((a, b) => a.amount - b.amount);
                break;
            case 'category':
                allTransactions.sort((a, b) => {
                    const catA = (a.category || '').toLowerCase();
                    const catB = (b.category || '').toLowerCase();
                    return catA.localeCompare(catB);
                });
                break;
            default:
                allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

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
        const deleteButton = (t.isLoan || t.isRecurring) ? '' : `<button class="transaction-delete" onclick="deleteTransaction(${t.id}, '${t.type}')">Delete</button>`;

        html += `
            <div class="transaction-item ${typeClass}">
                <div class="transaction-info">
                    <div class="transaction-category">${displayCategory}</div>
                    ${displayDesc ? `<div class="transaction-desc">${displayDesc}</div>` : ''}
                    <div class="transaction-date">${formatDate(t.date)}</div>
                </div>
                <span class="transaction-amount ${typeClass}">${sign}$${t.amount.toFixed(2)}</span>
                ${deleteButton}
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

// -------------------------
// Add Loan to Budget
// -------------------------
async function addLoanToBudget() {
    const name = document.getElementById("loanName").value;
    const principal = parseFloat(document.getElementById("principal").value);
    const annual_rate = parseFloat(document.getElementById("rate").value);
    const years = parseInt(document.getElementById("years").value);
    const extra_payment = parseFloat(document.getElementById("extra_payment").value) || 0;
    const start_date = document.getElementById("loanStartDate").value;

    if (!name || !principal || !years || !start_date) {
        alert("Please fill in all required fields including loan name and start date.");
        return;
    }

    try {
        const res = await fetch(`${API}/loans`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                name,
                principal,
                annual_rate,
                years,
                extra_payment,
                start_date
            })
        });

        const loan = await res.json();
        alert(`Loan "${loan.name}" added! Monthly payment: $${loan.monthly_payment.toFixed(2)}`);

        // Reset form
        document.getElementById("loanName").value = '';
        document.getElementById("principal").value = '';
        document.getElementById("rate").value = '';
        document.getElementById("years").value = '';
        document.getElementById("extra_payment").value = '';
        document.getElementById("loanStartDate").value = '';
        document.getElementById("loanResult").innerHTML = '';

        // Reload active loans
        loadActiveLoans();
    } catch (error) {
        alert("Error adding loan. Please try again.");
    }
}

// -------------------------
// Load Active Loans
// -------------------------
async function loadActiveLoans() {
    try {
        const res = await fetch(`${API}/loans`);
        const loans = await res.json();

        const container = document.getElementById("activeLoans");

        if (loans.length === 0) {
            container.innerHTML = '<p class="text-muted">No active loans</p>';
            return;
        }

        let html = '';
        loans.forEach(loan => {
            const totalPayment = loan.monthly_payment + loan.extra_payment;
            html += `
                <div class="loan-item">
                    <div class="loan-info">
                        <div class="loan-name">${loan.name}</div>
                        <div class="loan-details">
                            $${loan.principal.toLocaleString()} @ ${loan.annual_rate}% for ${loan.years} years
                        </div>
                        <div class="loan-date">Started: ${formatDate(loan.start_date)}</div>
                    </div>
                    <div class="loan-payment">
                        <div class="loan-payment-label">Monthly Payment</div>
                        <div class="loan-payment-amount">$${totalPayment.toFixed(2)}</div>
                    </div>
                    <button class="transaction-delete" onclick="deactivateLoan(${loan.id})">Deactivate</button>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error("Error loading loans:", error);
    }
}

// -------------------------
// Deactivate Loan
// -------------------------
async function deactivateLoan(id) {
    if (!confirm("Are you sure you want to deactivate this loan?")) {
        return;
    }

    try {
        await fetch(`${API}/loans/${id}`, {
            method: "DELETE"
        });

        loadActiveLoans();
    } catch (error) {
        alert("Error deactivating loan.");
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

// -------------------------
// Recurring Transactions
// -------------------------

async function loadRecurringTransactions() {
    try {
        const res = await fetch(`${API}/recurring-transactions`);
        const recurring = await res.json();
        displayRecurringTransactions(recurring);
    } catch (error) {
        console.error('Error loading recurring transactions:', error);
    }
}

function displayRecurringTransactions(recurring) {
    const container = document.getElementById('recurringList');

    if (recurring.length === 0) {
        container.innerHTML = '<p class="text-muted">No recurring transactions yet</p>';
        return;
    }

    let html = '';
    recurring.forEach(r => {
        const typeClass = r.type;
        const displayCategory = r.type === 'income' ? (r.source || 'Income') : r.category;
        const displayDesc = r.type === 'income' ? '' : r.description;

        html += `
            <div class="transaction-item ${typeClass}">
                <div class="transaction-info">
                    <div class="transaction-category">${displayCategory}</div>
                    ${displayDesc ? `<div class="transaction-desc">${displayDesc}</div>` : ''}
                    <div class="transaction-date">Day ${r.day_of_month} of each month</div>
                </div>
                <span class="transaction-amount ${typeClass}">$${r.amount.toFixed(2)}</span>
                <button class="transaction-delete" onclick="deleteRecurringTransaction(${r.id})">Delete</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function deleteRecurringTransaction(id) {
    if (!confirm('Are you sure you want to delete this recurring transaction?')) {
        return;
    }

    try {
        await fetch(`${API}/recurring-transactions/${id}`, {
            method: 'DELETE'
        });

        loadRecurringTransactions();
        loadTransactions();
        loadDashboard();
    } catch (error) {
        alert('Error deleting recurring transaction.');
    }
}

function generateRecurringTransactions(recurring, month, year) {
    const recurringTransactions = [];

    if (!recurring || !Array.isArray(recurring)) {
        return recurringTransactions;
    }

    recurring.forEach(r => {
        try {
            const day = String(r.day_of_month).padStart(2, '0');
            const monthStr = String(month).padStart(2, '0');
            const dateString = `${year}-${monthStr}-${day}`;

            recurringTransactions.push({
                id: `recurring-${r.id}`,
                amount: r.amount,
                category: r.type === 'expense' ? r.category : r.source,
                description: r.description,
                source: r.source,
                date: dateString,
                type: r.type,
                isRecurring: true
            });
        } catch (error) {
            console.error('Error generating recurring transaction:', error);
        }
    });

    return recurringTransactions;
}

// -------------------------
// Budgets
// -------------------------

async function setBudget(event) {
    event.preventDefault();

    const category = document.getElementById('budget-category').value;
    const monthly_limit = parseFloat(document.getElementById('budget-limit').value);

    try {
        await fetch(`${API}/budgets`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({category, monthly_limit})
        });

        document.getElementById('budget-form').reset();
        loadBudgetStatus();
        loadDashboard();
        alert('Budget set successfully!');
    } catch (error) {
        alert('Error setting budget. Make sure the backend is running.');
    }
}

async function loadBudgetStatus() {
    try {
        const res = await fetch(`${API}/budgets/status?month=${currentMonth}&year=${currentYear}`);
        const status = await res.json();
        displayBudgetStatus(status);
    } catch (error) {
        console.error('Error loading budget status:', error);
    }
}

function displayBudgetStatus(status) {
    const container = document.getElementById('budgetStatus');

    if (status.length === 0) {
        container.innerHTML = '<p class="text-muted">No budgets set yet</p>';
        return;
    }

    let html = '';
    status.forEach(budget => {
        const progressWidth = Math.min(budget.percentage, 100);
        const statusClass = budget.is_over ? 'over-budget' : (budget.percentage >= 80 ? 'warning' : 'ok');

        html += `
            <div class="budget-item ${statusClass}">
                <div class="budget-header">
                    <div class="budget-header-left">
                        <span class="budget-category">${budget.category}</span>
                        <span class="budget-amounts">$${budget.spent.toFixed(2)} / $${budget.limit.toFixed(2)}</span>
                    </div>
                    <button class="budget-delete-btn" onclick="deleteBudget('${budget.category}')" title="Delete budget">×</button>
                </div>
                <div class="budget-progress-bar">
                    <div class="budget-progress-fill ${statusClass}" style="width: ${progressWidth}%"></div>
                </div>
                <div class="budget-footer">
                    <span class="budget-percentage">${budget.percentage}% used</span>
                    <span class="budget-remaining ${budget.is_over ? 'over' : ''}">
                        ${budget.is_over ? 'Over by' : 'Remaining'}: $${Math.abs(budget.remaining).toFixed(2)}
                    </span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function deleteBudget(category) {
    if (!confirm(`Are you sure you want to delete the budget for ${category}?`)) {
        return;
    }

    try {
        // First, get all budgets to find the ID
        const res = await fetch(`${API}/budgets`);
        const budgets = await res.json();
        const budget = budgets.find(b => b.category === category);

        if (budget) {
            await fetch(`${API}/budgets/${budget.id}`, {
                method: 'DELETE'
            });

            loadBudgetStatus();
            loadDashboard();
        }
    } catch (error) {
        alert('Error deleting budget.');
    }
}

// Dashboard Budget Summary Functions
async function loadDashboardBudgets() {
    try {
        const res = await fetch(`${API}/budgets/status?month=${currentMonth}&year=${currentYear}`);
        const status = await res.json();
        displayDashboardBudgets(status);
    } catch (error) {
        console.error('Error loading dashboard budgets:', error);
    }
}

function displayDashboardBudgets(status) {
    const container = document.getElementById('dashboardBudgets');

    if (status.length === 0) {
        container.innerHTML = '<p class="text-muted">No budgets set yet</p>';
        return;
    }

    // Sort by spending amount (highest first) and show top 5
    const topBudgets = status
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 5);

    let html = '<div class="dashboard-budget-list">';
    topBudgets.forEach(budget => {
        const progressWidth = Math.min(budget.percentage, 100);
        const statusClass = budget.is_over ? 'over-budget' : (budget.percentage >= 80 ? 'warning' : 'ok');

        html += `
            <div class="dashboard-budget-item">
                <div class="dashboard-budget-header">
                    <span class="dashboard-budget-category">${budget.category}</span>
                    <span class="dashboard-budget-percentage ${statusClass}">${budget.percentage}%</span>
                </div>
                <div class="dashboard-budget-progress-bar">
                    <div class="dashboard-budget-progress-fill ${statusClass}" style="width: ${progressWidth}%"></div>
                </div>
                <div class="dashboard-budget-amounts">
                    $${budget.spent.toFixed(2)} / $${budget.limit.toFixed(2)}
                </div>
            </div>
        `;
    });
    html += '</div>';

    if (status.length > 5) {
        html += '<p class="dashboard-budget-more">+ ' + (status.length - 5) + ' more budgets</p>';
    }

    container.innerHTML = html;
}
