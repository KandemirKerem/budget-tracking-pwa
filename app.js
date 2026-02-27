// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered', reg))
            .catch(err => console.log('SW error', err));
    });
}

// State
let dailyLimit = parseFloat(localStorage.getItem('budget_limit')) || 0;
let expenses = JSON.parse(localStorage.getItem('budget_expenses')) || {};
let currentDate = new Date(); // To track Calendar month
const todayStr = getLocalIsoDate(new Date());

// DOM Elements
const views = {
    today: document.getElementById('view-today'),
    calendar: document.getElementById('view-calendar')
};
const btns = {
    today: document.getElementById('btn-today'),
    calendar: document.getElementById('btn-calendar')
};

// Toggle Views
btns.today.addEventListener('click', () => switchView('today'));
btns.calendar.addEventListener('click', () => {
    switchView('calendar');
    renderCalendar();
});

function switchView(viewName) {
    Object.keys(views).forEach(k => {
        views[k].classList.remove('active');
        btns[k].classList.remove('active');
    });
    views[viewName].classList.add('active');
    btns[viewName].classList.add('active');
}

// Modals logic
function openModal(id) {
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modalId = e.currentTarget.getAttribute('data-modal');
        closeModal(modalId);
    });
});
document.getElementById('limit-card').addEventListener('click', () => {
    document.getElementById('limit-amount').value = dailyLimit > 0 ? dailyLimit : '';
    openModal('modal-limit');
});
document.getElementById('fab-add').addEventListener('click', () => {
    document.getElementById('form-expense').reset();
    openModal('modal-expense');
});

// Tags logic
document.querySelectorAll('.suggestion-tags .tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
        const input = document.getElementById('expense-desc');
        input.value = e.target.textContent;
    });
});

// Forms
document.getElementById('form-limit').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = parseFloat(document.getElementById('limit-amount').value);
    if (val > 0) {
        dailyLimit = val;
        localStorage.setItem('budget_limit', dailyLimit);
        updateTodayView();
        closeModal('modal-limit');
    }
});

document.getElementById('form-expense').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const desc = document.getElementById('expense-desc').value.trim();

    if (amount > 0 && desc) {
        if (!expenses[todayStr]) expenses[todayStr] = [];
        expenses[todayStr].push({ id: Date.now(), amount, desc });
        localStorage.setItem('budget_expenses', JSON.stringify(expenses));

        updateTodayView();
        closeModal('modal-expense');
    }
});

// Utils
function getLocalIsoDate(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return (new Date(date - tzOffset)).toISOString().split('T')[0];
}

function formatMoney(amount) {
    return amount.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' zł';
}

// Logic: Today View
function updateTodayView() {
    // Limit
    document.getElementById('daily-limit-display').textContent = dailyLimit > 0 ? formatMoney(dailyLimit) : 'Belirlenmedi';

    // Total spent today
    const todaysExpenses = expenses[todayStr] || [];
    const totalSpent = todaysExpenses.reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('today-total-display').textContent = formatMoney(totalSpent);

    // Status bar
    const statusBar = document.getElementById('status-bar');
    if (dailyLimit > 0) {
        let pct = (totalSpent / dailyLimit) * 100;
        if (pct > 100) pct = 100;
        statusBar.style.setProperty('--progress', `${pct}%`);
        if (totalSpent > dailyLimit) statusBar.classList.add('danger');
        else statusBar.classList.remove('danger');
    } else {
        statusBar.style.setProperty('--progress', '0%');
        statusBar.classList.remove('danger');
    }

    // List
    const listEl = document.getElementById('expense-list');
    listEl.innerHTML = '';
    if (todaysExpenses.length === 0) {
        listEl.innerHTML = '<p class="empty-state">Henüz harcama eklenmedi.</p>';
    } else {
        // Reverse to show latest first
        [...todaysExpenses].reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'expense-item';
            div.innerHTML = `
                <div class="expense-info">
                    <span class="desc">${item.desc}</span>
                    <span class="amount">${formatMoney(item.amount)}</span>
                </div>
                <button class="delete-btn" onclick="deleteExpense('${todayStr}', ${item.id})" aria-label="Sil">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            `;
            listEl.appendChild(div);
        });
    }
}

// Logic: Calendar View
const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

document.getElementById('prev-month').addEventListener('click', () => {
    // Prevent going before February (index 1) 2026
    if (currentDate.getFullYear() === 2026 && currentDate.getMonth() === 1) {
        return;
    }
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});
document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById('current-month-display').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let firstDayIndex = firstDay.getDay() - 1; // 0 is Monday in our UI, JS getDay() is 0 for Sunday
    if (firstDayIndex === -1) firstDayIndex = 6;

    const daysInMonth = lastDay.getDate();
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // Update prev-month button state visually
    const prevBtn = document.getElementById('prev-month');
    if (year === 2026 && month === 1) {
        prevBtn.style.opacity = '0.3';
        prevBtn.style.cursor = 'not-allowed';
    } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
    }

    // Calculate monthly limit and spent
    let monthlyTotal = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = getLocalIsoDate(new Date(year, month, i));
        const dayExpenses = expenses[dateStr] || [];
        monthlyTotal += dayExpenses.reduce((s, x) => s + x.amount, 0);
    }

    if (dailyLimit > 0) {
        // Calculate previous month's debt
        let previousMonthDebt = 0;
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

        let prevMonthTotal = 0;
        for (let i = 1; i <= daysInPrevMonth; i++) {
            const dateStr = getLocalIsoDate(new Date(prevYear, prevMonth, i));
            const dayExpenses = expenses[dateStr] || [];
            prevMonthTotal += dayExpenses.reduce((s, x) => s + x.amount, 0);
        }

        const prevMonthLimit = dailyLimit * daysInPrevMonth;
        if (prevMonthTotal > prevMonthLimit) {
            previousMonthDebt = prevMonthTotal - prevMonthLimit;
        }

        const baseMonthlyLimit = dailyLimit * daysInMonth;
        const effectiveMonthlyLimit = baseMonthlyLimit - previousMonthDebt;

        document.getElementById('monthly-limit-display').textContent = formatMoney(effectiveMonthlyLimit);

        const remaining = effectiveMonthlyLimit - monthlyTotal;
        const remainingEl = document.getElementById('monthly-remaining-display');
        remainingEl.textContent = formatMoney(remaining);
        if (remaining < 0) {
            remainingEl.classList.add('negative');
        } else {
            remainingEl.classList.remove('negative');
        }
    } else {
        document.getElementById('monthly-limit-display').textContent = 'Belirlenmedi';
        const remainingEl = document.getElementById('monthly-remaining-display');
        remainingEl.textContent = 'Belirlenmedi';
        remainingEl.classList.remove('negative');
    }

    // Empty cells before first day
    for (let i = 0; i < firstDayIndex; i++) {
        const div = document.createElement('div');
        div.className = 'cal-day empty';
        grid.appendChild(div);
    }

    // Days of month
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = getLocalIsoDate(new Date(year, month, i));
        const dayExpenses = expenses[dateStr] || [];
        const total = dayExpenses.reduce((s, x) => s + x.amount, 0);

        const div = document.createElement('div');
        div.className = 'cal-day';
        div.textContent = i;

        if (total > 0) {
            div.classList.add('has-data');
            if (dailyLimit > 0 && total > dailyLimit) {
                div.classList.add('exceeded');
            }
        }

        div.addEventListener('click', () => showDayInfo(dateStr, total));
        grid.appendChild(div);
    }
}

function showDayInfo(dateStr, totalSpent) {
    if (totalSpent === 0) return; // Ignore days with no expenses

    // Date formatting (e.g. 15 Ekim 2023)
    const d = new Date(dateStr);
    const title = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    document.getElementById('day-info-title').textContent = title;
    document.getElementById('day-spent').textContent = formatMoney(totalSpent);
    const exceedBox = document.getElementById('day-exceed-box');
    const remainingEl = document.getElementById('day-remaining');

    if (dailyLimit > 0) {
        document.getElementById('day-limit').textContent = formatMoney(dailyLimit);

        const remaining = dailyLimit - totalSpent;
        remainingEl.textContent = formatMoney(remaining);

        if (remaining < 0) {
            remainingEl.style.color = 'var(--danger)';
            exceedBox.classList.add('active');
            document.getElementById('day-exceeded').textContent = formatMoney(Math.abs(remaining));
        } else {
            remainingEl.style.color = 'inherit';
            exceedBox.classList.remove('active');
        }
    } else {
        document.getElementById('day-limit').textContent = 'Belirlenmedi';
        remainingEl.textContent = 'Belirlenmedi';
        remainingEl.style.color = 'inherit';
        exceedBox.classList.remove('active');
    }

    // Render day's expenses with delete buttons
    const dayExpenses = expenses[dateStr] || [];
    const listEl = document.getElementById('day-expense-list');
    listEl.innerHTML = '';

    [...dayExpenses].reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'expense-item';
        div.innerHTML = `
            <div class="expense-info">
                <span class="desc">${item.desc}</span>
                <span class="amount">${formatMoney(item.amount)}</span>
            </div>
            <button class="delete-btn" onclick="deleteExpense('${dateStr}', ${item.id}, true)" aria-label="Sil">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
        `;
        listEl.appendChild(div);
    });

    openModal('modal-day-info');
}

// Delete Expense globally
let pendingDelete = null;

window.deleteExpense = function (dateStr, id, isFromModal = false) {
    pendingDelete = { dateStr, id, isFromModal };
    openModal('modal-confirm-delete');
};

document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    if (!pendingDelete) return;

    const { dateStr, id, isFromModal } = pendingDelete;

    if (expenses[dateStr]) {
        expenses[dateStr] = expenses[dateStr].filter(item => item.id !== id);

        // If empty array, we can delete the key
        if (expenses[dateStr].length === 0) {
            delete expenses[dateStr];
        }

        localStorage.setItem('budget_expenses', JSON.stringify(expenses));

        // Update views based on context
        updateTodayView();
        renderCalendar();

        if (isFromModal) {
            // If from modal, recalculate the total for the currently opened day
            const remainingExpenses = expenses[dateStr] || [];
            const newTotal = remainingExpenses.reduce((s, x) => s + x.amount, 0);

            if (newTotal === 0) {
                closeModal('modal-day-info');
            } else {
                showDayInfo(dateStr, newTotal);
            }
        }
    }

    closeModal('modal-confirm-delete');
    pendingDelete = null;
});

// Init
updateTodayView();
