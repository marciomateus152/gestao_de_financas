'use strict';

class FinanceApp {
    constructor() {
        this.transactions = [];
        this.isEditing = false;
        this.editingID = null;
        this.currentFilter = 'month'; 
        this.currentSearch = '';
        this.categoryChart = null;
        this.flowChart = null;

        this.STORAGE_KEY = 'financeAppTransactions_v2';
        this.THEME_KEY = 'financeAppTheme_v2';

        this._selectDOM();
        this._loadTransactions();
        this._loadTheme();
        this._initListeners();
        this._init();
    }

    _selectDOM() {
        
        this.balanceDisplay = document.getElementById('balance-display');
        this.incomeDisplay = document.getElementById('income-display');
        this.expenseDisplay = document.getElementById('expense-display');
        
        
        this.transactionList = document.getElementById('transaction-list');
        this.emptyState = document.getElementById('empty-state');

        
        this.modal = document.getElementById('modal');
        this.form = document.getElementById('transaction-form');
        this.formTitle = document.getElementById('form-title');
        this.formError = document.getElementById('form-error');
        this.openModalBtn = document.getElementById('add-transaction-btn');
        this.closeModalBtn = document.getElementById('close-modal-btn');

        
        this.descInput = document.getElementById('description');
        this.amountInput = document.getElementById('amount');
        this.dateInput = document.getElementById('date');
        this.categoryInput = document.getElementById('category');
        this.transactionIdInput = document.getElementById('transaction-id');
        
        
        this.timeFilterSelect = document.getElementById('time-filter');
        this.searchBar = document.getElementById('search-bar');
        
        // Charts
        this.categoryChartCtx = document.getElementById('category-chart').getContext('2d');
        this.flowChartCtx = document.getElementById('flow-chart').getContext('2d');

        
        this.themeToggle = document.getElementById('theme-toggle-checkbox');
        
        
        this.clearDataBtn = document.getElementById('clear-all-data');
    }

    _initListeners() {
        this.form.addEventListener('submit', this._handleFormSubmit.bind(this));
        this.openModalBtn.addEventListener('click', this._openModal.bind(this));
        this.closeModalBtn.addEventListener('click', this._closeModal.bind(this));
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this._closeModal();
        });
        
        this.transactionList.addEventListener('click', this._handleTransactionClick.bind(this));
        this.timeFilterSelect.addEventListener('change', this._handleFilterChange.bind(this));
        this.searchBar.addEventListener('input', this._handleSearch.bind(this));
        this.themeToggle.addEventListener('change', this._toggleTheme.bind(this));
        this.clearDataBtn.addEventListener('click', this._clearAllData.bind(this));
    }

    _init() {
        this._updateDOM();
        feather.replace();
    }


    _loadTransactions() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        this.transactions = stored ? JSON.parse(stored) : [];
    }

    _saveTransactions() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.transactions));
    }

    _getFilteredTransactions() {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        return this.transactions
            .filter(txn => {
                const searchMatch = txn.description.toLowerCase().includes(this.currentSearch.toLowerCase());
                
                if (this.currentFilter === 'month') {
                    return txn.date >= firstDayOfMonth && searchMatch;
                }
                
                return searchMatch;
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }


    _updateDOM() {
        const filteredTxns = this._getFilteredTransactions();
        
        this._updateDashboard(filteredTxns);
        this._renderTransactionList(filteredTxns);
        this._updateCharts(filteredTxns);
        this._saveTransactions();
    }

    _updateDashboard(txns) {
        const incomes = txns
            .filter(t => t.amount > 0)
            .reduce((acc, t) => acc + t.amount, 0);
        
        const expenses = txns
            .filter(t => t.amount < 0)
            .reduce((acc, t) => acc + t.amount, 0);

        const balance = incomes + expenses;

        this.balanceDisplay.textContent = this._formatCurrency(balance);
        this.incomeDisplay.textContent = this._formatCurrency(incomes);
        this.expenseDisplay.textContent = this._formatCurrency(Math.abs(expenses));
    }

    _renderTransactionList(txns) {
        this.transactionList.innerHTML = '';

        if (txns.length === 0) {
            this.emptyState.style.display = 'block';
        } else {
            this.emptyState.style.display = 'none';
            txns.forEach(txn => {
                const li = this._createTransactionElement(txn);
                this.transactionList.appendChild(li);
            });
        }
        feather.replace(); 
    }

    _createTransactionElement(txn) {
        const li = document.createElement('li');
        const type = txn.amount > 0 ? 'income' : 'expense';
        const sign = txn.amount > 0 ? '+' : '-';
        const icon = this._getCategoryIcon(txn.category, type);

        li.className = `list-item ${type}`;
        li.dataset.id = txn.id;

        li.innerHTML = `
            <div class="list-item-icon">
                <i data-feather="${icon}"></i>
            </div>
            <div class="list-item-details">
                <span class="desc">${txn.description}</span>
                <span class="category">${txn.category}</span>
                <span class="date">${this._formatDate(txn.date)}</span>
            </div>
            <span class="list-item-value ${type}">
                ${sign} ${this._formatCurrency(Math.abs(txn.amount))}
            </span>
            <div class="list-item-actions">
                <button class="edit-btn" title="Editar">
                    <i data-feather="edit-2"></i>
                </button>
                <button class="delete-btn" title="Excluir">
                    <i data-feather="trash-2"></i>
                </button>
            </div>
        `;
        return li;
    }


    _handleFormSubmit(e) {
        e.preventDefault();
        
        const description = this.descInput.value;
        const amount = parseFloat(this.amountInput.value);
        const date = this.dateInput.value;
        const type = document.querySelector('input[name="type"]:checked').value;
        const category = this.categoryInput.value;
        
        if (!description.trim() || !amount || !date) {
            this._showError('Por favor, preencha todos os campos.');
            return;
        }
        this._clearError();

        const finalAmount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);

        if (this.isEditing) {
            this.transactions = this.transactions.map(t =>
                t.id === this.editingID
                    ? { ...t, description, amount: finalAmount, date, category }
                    : t
            );
        } else {
            const newTransaction = {
                id: this._generateID(),
                description,
                amount: finalAmount,
                date,
                category
            };
            this.transactions.push(newTransaction);
        }

        this._closeModal();
        this._updateDOM();
    }
    
    _handleTransactionClick(e) {
        const item = e.target.closest('.list-item');
        if (!item) return;
        
        const id = item.dataset.id;
        
        if (e.target.closest('.edit-btn')) {
            this._startEdit(id);
        } else if (e.target.closest('.delete-btn')) {
            this._removeTransaction(id);
        }
    }

    _startEdit(id) {
        const txn = this.transactions.find(t => t.id === id);
        if (!txn) return;

        this.isEditing = true;
        this.editingID = id;

        this.formTitle.textContent = 'Editar Transação';
        this.transactionIdInput.value = txn.id;
        this.descInput.value = txn.description;
        this.amountInput.value = Math.abs(txn.amount);
        this.dateInput.value = txn.date;
        this.categoryInput.value = txn.category;
        
        if (txn.amount > 0) {
            document.getElementById('type-income').checked = true;
        } else {
            document.getElementById('type-expense').checked = true;
        }
        
        this._openModal();
    }

    _removeTransaction(id) {
        if (confirm('Tem certeza que deseja excluir esta transação?')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this._updateDOM();
        }
    }
    
    _clearAllData() {
        if (confirm('ATENÇÃO! Isso apagará TODOS os seus dados permanentemente. Deseja continuar?')) {
            this.transactions = [];
            this._saveTransactions();
            this._updateDOM();
        }
    }


    _openModal() {
        this.modal.style.display = 'flex';
        if (!this.isEditing) {
            this.dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    _closeModal() {
        this.modal.style.display = 'none';
        this._resetForm();
    }

    _resetForm() {
        this.form.reset();
        this.isEditing = false;
        this.editingID = null;
        this.formTitle.textContent = 'Nova Transação';
        document.getElementById('type-income').checked = true;
        this.dateInput.value = new Date().toISOString().split('T')[0];
        this._clearError();
    }
    
    _handleFilterChange(e) {
        this.currentFilter = e.target.value;
        this._updateDOM();
    }
    
    _handleSearch(e) {
        this.currentSearch = e.target.value;
        this._updateDOM();
    }

    _showError(message) {
        this.formError.textContent = message;
        this.formError.style.display = 'block';
    }

    _clearError() {
        this.formError.textContent = '';
        this.formError.style.display = 'none';
    }
    
    
    
    _updateCharts(txns) {
        this._renderCategoryChart(txns);
        this._renderFlowChart(txns);
    }

    _renderCategoryChart(txns) {
        const expenseData = txns
            .filter(t => t.amount < 0)
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
                return acc;
            }, {});

        const labels = Object.keys(expenseData);
        const data = Object.values(expenseData);
        
        const chartColors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
            '#9966FF', '#FF9F40', '#E7E9ED', '#8B008B'
        ];
        
        if (this.categoryChart) {
            this.categoryChart.destroy();
        }
        
        this.categoryChart = new Chart(this.categoryChartCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: chartColors,
                    borderColor: document.body.classList.contains('dark-theme') ? '#1e1e1e' : '#ffffff',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: document.body.classList.contains('dark-theme') ? '#f1f1f1' : '#0a0a0a'
                        }
                    }
                }
            }
        });
    }

    _renderFlowChart(txns) {
        const daysToShow = 30;
        const labels = [];
        const incomeData = [];
        const expenseData = [];
        const today = new Date();

        for (let i = daysToShow - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            const shortLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            
            labels.push(shortLabel);

            const txnsOnDay = txns.filter(t => t.date === dateString);
            
            incomeData.push(
                txnsOnDay
                    .filter(t => t.amount > 0)
                    .reduce((acc, t) => acc + t.amount, 0)
            );
            
            expenseData.push(
                Math.abs(
                    txnsOnDay
                        .filter(t => t.amount < 0)
                        .reduce((acc, t) => acc + t.amount, 0)
                )
            );
        }

        if (this.flowChart) {
            this.flowChart.destroy();
        }

        const legendColor = document.body.classList.contains('dark-theme') ? '#f1f1f1' : '#0a0a0a';
        
        this.flowChart = new Chart(this.flowChartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Receita',
                        data: incomeData,
                        borderColor: 'rgba(46, 204, 113, 1)',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Despesa',
                        data: expenseData,
                        borderColor: 'rgba(231, 76, 60, 1)',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: legendColor },
                        grid: { color: document.body.classList.contains('dark-theme') ? '#333' : '#eee' }
                    },
                    x: {
                        ticks: { color: legendColor },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: legendColor }
                    }
                }
            }
        });
    }

    

    _loadTheme() {
        const storedTheme = localStorage.getItem(this.THEME_KEY);
        if (storedTheme === 'light') {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            this.themeToggle.checked = false;
        } else {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            this.themeToggle.checked = true;
        }
    }

    _toggleTheme() {
        if (this.themeToggle.checked) {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            localStorage.setItem(this.THEME_KEY, 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            localStorage.setItem(this.THEME_KEY, 'light');
        }
        
        this._updateCharts(this._getFilteredTransactions());
    }



    _formatCurrency(value) {
        return `R$ ${parseFloat(value).toLocaleString('pt-BR', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;
    }

    _formatDate(dateString) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }

    _generateID() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }
    
    _getCategoryIcon(category, type) {
        if (type === 'income') {
            switch (category) {
                case 'salario': return 'briefcase';
                case 'investimentos': return 'bar-chart-2';
                default: return 'dollar-sign';
            }
        } else {
            switch (category) {
                case 'alimentacao': return 'shopping-cart';
                case 'moradia': return 'home';
                case 'transporte': return 'truck';
                case 'lazer': return 'film';
                case 'saude': return 'heart';
                case 'investimentos': return 'trending-down';
                default: return 'tag';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FinanceApp();
});