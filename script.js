"use strict";

const STORAGE_KEY = "duitku:data:v1";
const LEGACY_KEY = "transactions";
const CATEGORIES = {
  income: ["Uang bulanan", "Beasiswa", "Gaji atau pekerjaan", "Hadiah", "Lainnya"],
  expense: [
    "Makanan",
    "Transportasi",
    "Pendidikan",
    "Kebutuhan pribadi",
    "Hiburan",
    "Kesehatan",
    "Tagihan",
    "Lainnya",
  ],
};
const CATEGORY_COLORS = [
  "#4775eb",
  "#45b993",
  "#f2a04b",
  "#9570d4",
  "#e67582",
  "#39a9c2",
  "#d5b541",
  "#8493a8",
];
const PAGE_TITLES = {
  dashboard: "Dashboard",
  transactions: "Transaksi",
  budgets: "Anggaran",
  goals: "Target tabungan",
  reports: "Laporan",
  settings: "Pengaturan",
};

const elements = {
  notice: document.getElementById("app-notice"),
  toast: document.getElementById("toast"),
  pageTitle: document.getElementById("page-title"),
  todayLabel: document.getElementById("today-label"),
  dashboardMonth: document.getElementById("dashboard-month"),
  metricBalance: document.getElementById("metric-balance"),
  metricIncome: document.getElementById("metric-income"),
  metricExpense: document.getElementById("metric-expense"),
  metricCount: document.getElementById("metric-count"),
  metricNet: document.getElementById("metric-net"),
  metricIncomeCaption: document.getElementById("metric-income-caption"),
  metricExpenseCaption: document.getElementById("metric-expense-caption"),
  metricCountCaption: document.getElementById("metric-count-caption"),
  recentTransactions: document.getElementById("recent-transactions"),
  transactionForm: document.getElementById("transaction-form"),
  transactionEditor: document.getElementById("transaction-editor-panel"),
  transactionFormTitle: document.getElementById("transaction-form-title"),
  transactionSubmit: document.getElementById("transaction-submit"),
  transactionId: document.getElementById("transaction-id"),
  transactionDescription: document.getElementById("transaction-description"),
  transactionType: document.getElementById("transaction-type"),
  transactionCategory: document.getElementById("transaction-category"),
  transactionAmount: document.getElementById("transaction-amount"),
  transactionDate: document.getElementById("transaction-date"),
  transactionNote: document.getElementById("transaction-note"),
  transactionsTable: document.getElementById("transactions-table"),
  filterSearch: document.getElementById("filter-search"),
  filterType: document.getElementById("filter-type"),
  filterCategory: document.getElementById("filter-category"),
  filterMonth: document.getElementById("filter-month"),
  filterSort: document.getElementById("filter-sort"),
  budgetMonth: document.getElementById("budget-month"),
  budgetPeriodLabel: document.getElementById("budget-period-label"),
  overallBudgetForm: document.getElementById("overall-budget-form"),
  overallBudgetLimit: document.getElementById("overall-budget-limit"),
  overallBudgetProgress: document.getElementById("overall-budget-progress"),
  budgetCategory: document.getElementById("budget-category"),
  categoryBudgetForm: document.getElementById("category-budget-form"),
  categoryBudgetLimit: document.getElementById("category-budget-limit"),
  categoryBudgetList: document.getElementById("category-budget-list"),
  goalForm: document.getElementById("goal-form"),
  goalName: document.getElementById("goal-name"),
  goalTarget: document.getElementById("goal-target"),
  goalDate: document.getElementById("goal-date"),
  goalsList: document.getElementById("goals-list"),
  reportMonth: document.getElementById("report-month"),
  reportIncome: document.getElementById("report-income"),
  reportExpense: document.getElementById("report-expense"),
  reportNet: document.getElementById("report-net"),
  reportTopCategory: document.getElementById("report-top-category"),
  monthlyReportTable: document.getElementById("monthly-report-table"),
  themeSelect: document.getElementById("theme-select"),
  importFile: document.getElementById("import-file"),
  cashflowFallback: document.getElementById("cashflow-fallback"),
  categoryFallback: document.getElementById("category-fallback"),
  reportFallback: document.getElementById("report-fallback"),
  categoryLegend: document.getElementById("category-legend"),
  goalAmountDialog: document.getElementById("goal-amount-dialog"),
  goalAmountForm: document.getElementById("goal-amount-form"),
  goalAmountTitle: document.getElementById("goal-amount-title"),
  goalAmountDescription: document.getElementById("goal-amount-description"),
  goalAmountId: document.getElementById("goal-amount-id"),
  goalAmountDirection: document.getElementById("goal-amount-direction"),
  goalAmountValue: document.getElementById("goal-amount-value"),
};

let shouldMigrateLegacy = false;
let state = loadState();
let toastTimer;
let cashflowChart = null;
let categoryChart = null;
let reportChart = null;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonth() {
  return localDateString().slice(0, 7);
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `dk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidDate(value, allowEmpty = false) {
  if (allowEmpty && value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validAmount(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function normalizeTransactions(items) {
  const usedIds = new Set();
  const normalized = [];
  let skipped = false;

  items.forEach((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.description !== "string" ||
      !item.description.trim() ||
      !["income", "expense"].includes(item.type) ||
      !validAmount(item.amount)
    ) {
      skipped = true;
      return;
    }

    let id = typeof item.id === "string" && item.id ? item.id : createId();
    if (usedIds.has(id)) {
      skipped = true;
      id = createId();
      while (usedIds.has(id)) id = createId();
    }
    usedIds.add(id);

    const categoryIsValid =
      item.category === undefined || CATEGORIES[item.type].includes(item.category);
    const dateIsValid = item.date === undefined || isValidDate(item.date);
    const noteIsValid = item.note === undefined || typeof item.note === "string";
    if (!categoryIsValid || !dateIsValid || !noteIsValid) skipped = true;
    const category = CATEGORIES[item.type].includes(item.category)
      ? item.category
      : "Lainnya";
    normalized.push({
      id,
      description: item.description.trim().slice(0, 80),
      type: item.type,
      category,
      amount: item.amount,
      date: isValidDate(item.date) ? item.date : localDateString(),
      note: typeof item.note === "string" ? item.note.slice(0, 240) : "",
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
    });
  });

  return { transactions: normalized, skipped };
}

function normalizeState(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const transactionResult = normalizeTransactions(
    Array.isArray(source.transactions) ? source.transactions : [],
  );
  const budgets = {};
  let skippedData = transactionResult.skipped ||
    (source.transactions !== undefined && !Array.isArray(source.transactions));

  if (source.budgets && typeof source.budgets === "object" && !Array.isArray(source.budgets)) {
    Object.entries(source.budgets).forEach(([month, budget]) => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !budget || typeof budget !== "object") {
        skippedData = true;
        return;
      }
      const cleanBudget = { overall: null, categories: {} };
      if (budget.overall !== null && budget.overall !== undefined) {
        if (validAmount(budget.overall)) cleanBudget.overall = budget.overall;
        else skippedData = true;
      }
      if (budget.categories && typeof budget.categories === "object") {
        Object.entries(budget.categories).forEach(([category, amount]) => {
          if (CATEGORIES.expense.includes(category) && validAmount(amount)) {
            cleanBudget.categories[category] = amount;
          } else skippedData = true;
        });
      } else if (budget.categories !== undefined) {
        skippedData = true;
      }
      budgets[month] = cleanBudget;
    });
  } else if (source.budgets !== undefined) {
    skippedData = true;
  }

  const goalIds = new Set();
  const goals = [];
  if (Array.isArray(source.goals)) {
    source.goals.forEach((goal) => {
      if (
        !goal ||
        typeof goal.name !== "string" ||
        !goal.name.trim() ||
        !validAmount(goal.target) ||
        !Number.isSafeInteger(goal.saved) ||
        goal.saved < 0
      ) {
        skippedData = true;
        return;
      }
      let id = typeof goal.id === "string" && goal.id ? goal.id : createId();
      if (goalIds.has(id)) {
        id = createId();
        skippedData = true;
      }
      goalIds.add(id);
      if (goal.date !== undefined && !isValidDate(goal.date, true)) skippedData = true;
      goals.push({
        id,
        name: goal.name.trim().slice(0, 70),
        target: goal.target,
        saved: goal.saved,
        date: isValidDate(goal.date, true) ? goal.date : "",
        createdAt: typeof goal.createdAt === "string" ? goal.createdAt : new Date().toISOString(),
      });
    });
  } else if (source.goals !== undefined) {
    skippedData = true;
  }

  const settings = source.settings && typeof source.settings === "object"
    ? source.settings
    : {};
  if (
    source.settings !== undefined &&
    (!source.settings || typeof source.settings !== "object" || Array.isArray(source.settings))
  ) {
    skippedData = true;
  }
  if (
    settings.theme !== undefined &&
    settings.theme !== "light" &&
    settings.theme !== "dark"
  ) {
    skippedData = true;
  }
  return {
    version: 1,
    transactions: transactionResult.transactions,
    budgets,
    goals,
    settings: { theme: settings.theme === "dark" ? "dark" : "light" },
    skippedData,
  };
}

function loadState() {
  let rawNewData = null;
  let loadNotice = "";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      try {
        rawNewData = JSON.parse(saved);
        if (!rawNewData || typeof rawNewData !== "object" || Array.isArray(rawNewData)) {
          rawNewData = null;
          loadNotice = "Format data DuitKu tersimpan tidak valid. Salinan lama tidak dihapus.";
        }
      } catch {
        loadNotice = "Data DuitKu tersimpan tidak dapat dibaca. Salinan lama tidak dihapus; periksa backup jika tersedia.";
      }
    } else {
      shouldMigrateLegacy = true;
    }
  } catch (error) {
    console.error("Tidak dapat membaca Local Storage DuitKu:", error);
    loadNotice = "Browser tidak mengizinkan pembacaan Local Storage. Perubahan mungkin tidak tersimpan.";
  }

  let normalized;
  if (rawNewData) {
    normalized = normalizeState(rawNewData);
    if (typeof rawNewData !== "object" || Array.isArray(rawNewData) || normalized.skippedData) {
      loadNotice = "Sebagian data tersimpan tidak valid dan dilewati. Data mentah tetap berada di Local Storage.";
    }
  } else {
    let legacyTransactions = [];
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) legacyTransactions = parsed;
        else loadNotice = "Format data transaksi lama tidak valid. Data mentah tidak dihapus.";
      }
    } catch (error) {
      console.error("Tidak dapat membaca data transaksi lama:", error);
      loadNotice = "Data transaksi lama tidak dapat dibaca. Data mentah tidak dihapus.";
    }
    normalized = normalizeState({ transactions: legacyTransactions });
    if (normalized.skippedData) {
      loadNotice = "Sebagian data transaksi lama tidak valid dan dilewati. Data mentah tetap tersimpan.";
    }
  }

  if (loadNotice) {
    elements.notice.textContent = loadNotice;
    elements.notice.hidden = false;
  }
  return normalized;
}

function persistState() {
  const savedState = {
    version: 1,
    transactions: state.transactions,
    budgets: state.budgets,
    goals: state.goals,
    settings: state.settings,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
    return true;
  } catch (error) {
    console.error("Gagal menyimpan data DuitKu:", error);
    showToast("Data gagal disimpan. Periksa ruang penyimpanan browser.", true);
    return false;
  }
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.style.background = isError ? "#b83c49" : "";
  elements.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 3200);
}

function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value) {
  if (!isValidDate(value)) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fillSelect(select, options, includeAll = false) {
  select.replaceChildren();
  if (includeAll) {
    const allOption = element("option", "", "Semua kategori");
    allOption.value = "all";
    select.appendChild(allOption);
  }
  options.forEach((value) => {
    const option = element("option", "", value);
    option.value = value;
    select.appendChild(option);
  });
}

function setUpCategoryOptions() {
  fillSelect(elements.transactionCategory, CATEGORIES.expense);
  fillSelect(elements.filterCategory, [...CATEGORIES.income, ...CATEGORIES.expense], true);
  fillSelect(elements.budgetCategory, CATEGORIES.expense);
  updateTransactionCategoryOptions();
}

function updateTransactionCategoryOptions(selected) {
  const categories = CATEGORIES[elements.transactionType.value] || CATEGORIES.expense;
  fillSelect(elements.transactionCategory, categories);
  if (selected && categories.includes(selected)) {
    elements.transactionCategory.value = selected;
  }
}

function getTotals(items) {
  return items.reduce(
    (totals, transaction) => {
      if (transaction.type === "income") totals.income += transaction.amount;
      else totals.expense += transaction.amount;
      totals.count += 1;
      return totals;
    },
    { income: 0, expense: 0, count: 0 },
  );
}

function renderDashboard() {
  const month = elements.dashboardMonth.value || currentMonth();
  const monthlyTransactions = state.transactions.filter((item) => item.date.startsWith(month));
  const totals = getTotals(monthlyTransactions);
  const allTotals = getTotals(state.transactions);
  elements.metricBalance.textContent = formatRupiah(allTotals.income - allTotals.expense);
  elements.metricIncome.textContent = formatRupiah(totals.income);
  elements.metricExpense.textContent = formatRupiah(totals.expense);
  elements.metricCount.textContent = String(totals.count);
  elements.metricNet.textContent = formatRupiah(totals.income - totals.expense);
  elements.metricIncomeCaption.textContent = `Pemasukan ${formatMonth(month)}`;
  elements.metricExpenseCaption.textContent = `Pengeluaran ${formatMonth(month)}`;
  elements.metricCountCaption.textContent = `Transaksi ${formatMonth(month)}`;

  renderTransactionTable(
    elements.recentTransactions,
    [...state.transactions]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
    { actions: false, emptyText: "Belum ada transaksi. Tambahkan transaksi pertamamu." },
  );
  renderCharts(month);
}

function renderTransactionTable(container, transactions, options = {}) {
  container.replaceChildren();
  const table = element("table", "transaction-table");
  const head = element("thead");
  const headerRow = element("tr");
  ["Transaksi", "Kategori", "Tanggal", "Jenis", "Nominal"].forEach((label) => {
    headerRow.appendChild(element("th", "", label));
  });
  if (options.actions) headerRow.appendChild(element("th", "", "Aksi"));
  head.appendChild(headerRow);
  table.appendChild(head);

  const body = element("tbody");
  if (!transactions.length) {
    const row = element("tr");
    const cell = element("td", "empty-state", options.emptyText || "Tidak ada transaksi.");
    cell.colSpan = options.actions ? 6 : 5;
    row.appendChild(cell);
    body.appendChild(row);
  } else {
    transactions.forEach((transaction) => {
      const row = element("tr");
      const nameCell = element("td");
      const name = element("div", "transaction-name");
      const avatar = element("span", `transaction-avatar ${transaction.type}`);
      avatar.textContent = transaction.description.trim().charAt(0).toUpperCase();
      const titleWrap = element("span");
      titleWrap.appendChild(element("span", "", transaction.description));
      if (transaction.note) {
        titleWrap.appendChild(element("small", "transaction-subtitle", transaction.note));
      }
      name.append(avatar, titleWrap);
      nameCell.appendChild(name);
      row.appendChild(nameCell);
      row.appendChild(element("td", "", transaction.category));
      row.appendChild(element("td", "", formatDate(transaction.date)));
      const typeCell = element("td");
      typeCell.appendChild(
        element(
          "span",
          `type-pill ${transaction.type}`,
          transaction.type === "income" ? "Pemasukan" : "Pengeluaran",
        ),
      );
      row.appendChild(typeCell);
      row.appendChild(
        element(
          "td",
          transaction.type === "income" ? "amount-income" : "amount-expense",
          `${transaction.type === "income" ? "+" : "−"} ${formatRupiah(transaction.amount)}`,
        ),
      );
      if (options.actions) {
        const actionCell = element("td");
        const actions = element("div", "row-actions");
        const editButton = element("button", "row-action", "Edit");
        editButton.type = "button";
        editButton.dataset.action = "edit-transaction";
        editButton.dataset.id = transaction.id;
        const deleteButton = element("button", "row-action delete", "Hapus");
        deleteButton.type = "button";
        deleteButton.dataset.action = "delete-transaction";
        deleteButton.dataset.id = transaction.id;
        actions.append(editButton, deleteButton);
        actionCell.appendChild(actions);
        row.appendChild(actionCell);
      }
      body.appendChild(row);
    });
  }

  table.appendChild(body);
  container.appendChild(table);
}

function renderTransactions() {
  const search = elements.filterSearch.value.trim().toLocaleLowerCase("id-ID");
  const type = elements.filterType.value;
  const category = elements.filterCategory.value;
  const month = elements.filterMonth.value;
  const direction = elements.filterSort.value === "oldest" ? 1 : -1;
  const filtered = state.transactions
    .filter((transaction) => !search || transaction.description.toLocaleLowerCase("id-ID").includes(search))
    .filter((transaction) => type === "all" || transaction.type === type)
    .filter((transaction) => category === "all" || transaction.category === category)
    .filter((transaction) => !month || transaction.date.startsWith(month))
    .sort((a, b) => direction * (a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)));
  renderTransactionTable(elements.transactionsTable, filtered, {
    actions: true,
    emptyText: "Tidak ada transaksi yang cocok dengan pencarian atau filter.",
  });
}

function showTransactionForm(transaction) {
  elements.transactionEditor.hidden = false;
  if (transaction) {
    elements.transactionFormTitle.textContent = "Edit transaksi";
    elements.transactionSubmit.textContent = "Simpan perubahan";
    elements.transactionId.value = transaction.id;
    elements.transactionDescription.value = transaction.description;
    elements.transactionType.value = transaction.type;
    updateTransactionCategoryOptions(transaction.category);
    elements.transactionAmount.value = String(transaction.amount);
    elements.transactionDate.value = transaction.date;
    elements.transactionNote.value = transaction.note;
  } else {
    elements.transactionForm.reset();
    elements.transactionFormTitle.textContent = "Tambah transaksi";
    elements.transactionSubmit.textContent = "Simpan transaksi";
    elements.transactionId.value = "";
    elements.transactionType.value = "expense";
    updateTransactionCategoryOptions();
    elements.transactionDate.value = localDateString();
  }
  elements.transactionEditor.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.transactionDescription.focus({ preventScroll: true });
}

function hideTransactionForm() {
  elements.transactionEditor.hidden = true;
  elements.transactionForm.reset();
  elements.transactionId.value = "";
}

function saveTransaction(event) {
  event.preventDefault();
  const description = elements.transactionDescription.value.trim();
  const type = elements.transactionType.value;
  const amount = Number(elements.transactionAmount.value);
  const date = elements.transactionDate.value;
  if (
    !description ||
    description.length > 80 ||
    !["income", "expense"].includes(type) ||
    !CATEGORIES[type].includes(elements.transactionCategory.value) ||
    !validAmount(amount) ||
    !isValidDate(date)
  ) {
    showToast("Periksa kembali nama, kategori, tanggal, dan nominal transaksi.", true);
    return;
  }

  const id = elements.transactionId.value;
  const duplicate = state.transactions.some(
    (item) =>
      item.id !== id &&
      item.description.toLocaleLowerCase("id-ID") === description.toLocaleLowerCase("id-ID") &&
      item.type === type &&
      item.category === elements.transactionCategory.value &&
      item.amount === amount &&
      item.date === date &&
      item.note === elements.transactionNote.value.trim(),
  );
  if (duplicate) {
    showToast("Transaksi dengan detail yang sama sudah tercatat.", true);
    return;
  }

  const transaction = {
    id: id || createId(),
    description,
    type,
    category: elements.transactionCategory.value,
    amount,
    date,
    note: elements.transactionNote.value.trim().slice(0, 240),
    createdAt: id
      ? state.transactions.find((item) => item.id === id)?.createdAt || new Date().toISOString()
      : new Date().toISOString(),
  };
  const existingIndex = state.transactions.findIndex((item) => item.id === id);
  if (existingIndex >= 0) state.transactions[existingIndex] = transaction;
  else state.transactions.push(transaction);

  const persisted = persistState();
  hideTransactionForm();
  renderAll();
  if (persisted) {
    showToast(existingIndex >= 0 ? "Transaksi berhasil diperbarui." : "Transaksi berhasil ditambahkan.");
  }
}

function deleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  if (!window.confirm(`Hapus transaksi "${transaction.description}"?`)) return;
  state.transactions = state.transactions.filter((item) => item.id !== id);
  const persisted = persistState();
  renderAll();
  if (persisted) showToast("Transaksi berhasil dihapus.");
}

function monthlyExpenses(month) {
  return state.transactions.filter(
    (transaction) => transaction.type === "expense" && transaction.date.startsWith(month),
  );
}

function createProgress(used, limit) {
  const wrapper = element("div", "progress-block");
  const percent = limit > 0 ? (used / limit) * 100 : 0;
  const displayPercent = Math.min(100, Math.round(percent));
  const stateClass = percent >= 100 ? "over" : percent >= 80 ? "warning" : "";
  const copy = element("div", "progress-copy");
  copy.append(
    element("span", "", `${formatRupiah(used)} terpakai`),
    element("strong", "", `${Math.round(percent)}%`),
  );
  const track = element("div", "progress-track");
  const fill = element("div", `progress-fill ${stateClass}`);
  fill.style.width = `${displayPercent}%`;
  track.appendChild(fill);
  const remaining = limit - used;
  const statusText = remaining < 0
    ? `Melebihi anggaran ${formatRupiah(Math.abs(remaining))}.`
    : percent >= 80
      ? `Hati-hati, sisa anggaran ${formatRupiah(remaining)}.`
      : `Sisa anggaran ${formatRupiah(remaining)}.`;
  const status = element("p", `budget-status ${stateClass}`, statusText);
  wrapper.append(copy, track, status);
  return wrapper;
}

function renderBudgets() {
  const month = elements.budgetMonth.value || currentMonth();
  elements.budgetPeriodLabel.textContent = formatMonth(month);
  const budget = state.budgets[month] || { overall: null, categories: {} };
  const expenses = monthlyExpenses(month);
  const used = expenses.reduce((sum, item) => sum + item.amount, 0);
  elements.overallBudgetLimit.value = budget.overall || "";
  elements.overallBudgetProgress.replaceChildren();
  if (budget.overall) {
    elements.overallBudgetProgress.appendChild(createProgress(used, budget.overall));
  } else {
    elements.overallBudgetProgress.appendChild(
      element("p", "budget-status", "Belum ada batas anggaran untuk bulan ini."),
    );
  }

  elements.categoryBudgetList.replaceChildren();
  const savedCategories = Object.entries(budget.categories || {});
  if (!savedCategories.length) {
    elements.categoryBudgetList.appendChild(
      element("p", "budget-status", "Anggaran kategori belum ditambahkan."),
    );
  }
  savedCategories.forEach(([category, limit]) => {
    const categoryUsed = expenses
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + item.amount, 0);
    const row = element("div", "budget-row");
    const header = element("div", "budget-row-head");
    header.append(
      element("strong", "", category),
      element("span", "", `${formatRupiah(categoryUsed)} / ${formatRupiah(limit)}`),
    );
    const remove = element("button", "remove-budget", "Hapus anggaran");
    remove.type = "button";
    remove.dataset.action = "remove-budget";
    remove.dataset.category = category;
    header.appendChild(remove);
    row.append(header, createProgress(categoryUsed, limit));
    elements.categoryBudgetList.appendChild(row);
  });
}

function saveOverallBudget(event) {
  event.preventDefault();
  const month = elements.budgetMonth.value || currentMonth();
  const amount = Number(elements.overallBudgetLimit.value);
  if (!/^\d{4}-\d{2}$/.test(month) || !validAmount(amount)) {
    showToast("Masukkan batas anggaran bulanan yang valid.", true);
    return;
  }
  if (!state.budgets[month]) state.budgets[month] = { overall: null, categories: {} };
  state.budgets[month].overall = amount;
  const persisted = persistState();
  renderBudgets();
  if (persisted) showToast("Batas anggaran bulanan disimpan.");
}

function saveCategoryBudget(event) {
  event.preventDefault();
  const month = elements.budgetMonth.value || currentMonth();
  const category = elements.budgetCategory.value;
  const amount = Number(elements.categoryBudgetLimit.value);
  if (!CATEGORIES.expense.includes(category) || !validAmount(amount)) {
    showToast("Pilih kategori dan batas anggaran yang valid.", true);
    return;
  }
  if (!state.budgets[month]) state.budgets[month] = { overall: null, categories: {} };
  state.budgets[month].categories[category] = amount;
  const persisted = persistState();
  elements.categoryBudgetForm.reset();
  renderBudgets();
  if (persisted) showToast("Anggaran kategori disimpan.");
}

function removeCategoryBudget(category) {
  const month = elements.budgetMonth.value || currentMonth();
  if (!window.confirm(`Hapus anggaran kategori "${category}" untuk ${formatMonth(month)}?`)) return;
  if (state.budgets[month]) delete state.budgets[month].categories[category];
  const persisted = persistState();
  renderBudgets();
  if (persisted) showToast("Anggaran kategori dihapus.");
}

function renderGoals() {
  elements.goalsList.replaceChildren();
  if (!state.goals.length) {
    const empty = element("article", "panel empty-state", "Belum ada target tabungan. Buat target pertamamu di atas.");
    elements.goalsList.appendChild(empty);
    return;
  }
  state.goals.forEach((goal) => {
    const card = element("article", "panel goal-card");
    const top = element("div", "goal-card-top");
    top.appendChild(element("span", "goal-icon", "◎"));
    if (goal.date) top.appendChild(element("span", "goal-date", `Target ${formatDate(goal.date)}`));
    const name = element("h3", "goal-name", goal.name);
    const remaining = Math.max(0, goal.target - goal.saved);
    const percent = Math.min(100, Math.round((goal.saved / goal.target) * 100));
    const amounts = element("div", "goal-amounts");
    amounts.append(
      element("strong", "", formatRupiah(goal.saved)),
      element("span", "", `dari ${formatRupiah(goal.target)}`),
    );
    const progress = element("div", "goal-progress");
    const copy = element("div", "progress-copy");
    copy.append(element("span", "", `Tersisa ${formatRupiah(remaining)}`), element("strong", "", `${percent}%`));
    const track = element("div", "progress-track");
    const fill = element("div", "progress-fill");
    fill.style.width = `${percent}%`;
    track.appendChild(fill);
    progress.append(copy, track);

    const actions = element("div", "goal-actions");
    const add = element("button", "button button-primary", "＋ Tambah dana");
    add.type = "button";
    add.dataset.action = "goal-add";
    add.dataset.id = goal.id;
    const subtract = element("button", "button button-secondary", "− Kurangi dana");
    subtract.type = "button";
    subtract.dataset.action = "goal-subtract";
    subtract.dataset.id = goal.id;
    const remove = element("button", "row-action goal-delete", "Hapus target");
    remove.type = "button";
    remove.dataset.action = "goal-delete";
    remove.dataset.id = goal.id;
    actions.append(add, subtract, remove);
    card.append(top, name, amounts, progress, actions);
    elements.goalsList.appendChild(card);
  });
}

function createGoal(event) {
  event.preventDefault();
  const name = elements.goalName.value.trim();
  const target = Number(elements.goalTarget.value);
  const date = elements.goalDate.value;
  if (!name || name.length > 70 || !validAmount(target) || !isValidDate(date, true)) {
    showToast("Periksa nama, nominal, dan tanggal target.", true);
    return;
  }
  if (state.goals.some((goal) => goal.name.toLocaleLowerCase("id-ID") === name.toLocaleLowerCase("id-ID"))) {
    showToast("Target dengan nama yang sama sudah ada.", true);
    return;
  }
  state.goals.push({ id: createId(), name, target, saved: 0, date, createdAt: new Date().toISOString() });
  const persisted = persistState();
  elements.goalForm.reset();
  renderGoals();
  if (persisted) showToast("Target tabungan berhasil dibuat.");
}

function changeGoalAmount(id, direction) {
  const goal = state.goals.find((item) => item.id === id);
  if (!goal) return;
  if (direction < 0 && !window.confirm(`Kurangi dana dari target "${goal.name}"?`)) return;
  elements.goalAmountTitle.textContent = direction > 0 ? "Tambah dana" : "Kurangi dana";
  elements.goalAmountDescription.textContent = goal.name;
  elements.goalAmountId.value = goal.id;
  elements.goalAmountDirection.value = String(direction);
  elements.goalAmountValue.value = "";
  elements.goalAmountDialog.showModal();
  elements.goalAmountValue.focus();
}

function saveGoalAmount(event) {
  event.preventDefault();
  const goal = state.goals.find((item) => item.id === elements.goalAmountId.value);
  const direction = Number(elements.goalAmountDirection.value);
  const amount = Number(elements.goalAmountValue.value);
  if (!goal || ![-1, 1].includes(direction)) {
    showToast("Target tabungan tidak ditemukan.", true);
    elements.goalAmountDialog.close();
    return;
  }
  if (!validAmount(amount)) {
    showToast("Nominal harus berupa angka positif yang valid.", true);
    return;
  }
  if (direction < 0 && amount > goal.saved) {
    showToast("Nominal pengurangan melebihi dana target yang tersedia.", true);
    return;
  }
  if (direction > 0 && goal.saved + amount > Number.MAX_SAFE_INTEGER) {
    showToast("Nominal melebihi batas angka yang dapat disimpan.", true);
    return;
  }
  goal.saved += amount * direction;
  const persisted = persistState();
  elements.goalAmountDialog.close();
  renderGoals();
  if (persisted) {
    showToast(direction > 0 ? "Dana target berhasil ditambahkan." : "Dana target berhasil dikurangi.");
  }
}

function deleteGoal(id) {
  const goal = state.goals.find((item) => item.id === id);
  if (!goal || !window.confirm(`Hapus target "${goal.name}"?`)) return;
  state.goals = state.goals.filter((item) => item.id !== id);
  const persisted = persistState();
  renderGoals();
  if (persisted) showToast("Target tabungan dihapus.");
}

function monthValues(centerMonth, count) {
  const [year, month] = centerMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - count + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function totalsForMonth(month) {
  return getTotals(state.transactions.filter((item) => item.date.startsWith(month)));
}

function categoryTotals(month) {
  const totals = new Map();
  monthlyExpenses(month).forEach((item) => {
    totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
  });
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function chartOptions() {
  const styles = getComputedStyle(document.body);
  return {
    text: styles.getPropertyValue("--muted").trim() || "#8290a5",
    grid: styles.getPropertyValue("--line").trim() || "#e8edf5",
  };
}

function renderCharts(month) {
  const available = typeof window.Chart === "function";
  elements.cashflowFallback.hidden = available;
  elements.categoryFallback.hidden = available;
  if (!available) {
    elements.categoryLegend.replaceChildren();
    return;
  }

  const colors = chartOptions();
  const recentMonths = monthValues(month, 6);
  const cashflowContext = document.getElementById("cashflow-chart").getContext("2d");
  if (cashflowChart) cashflowChart.destroy();
  cashflowChart = new window.Chart(cashflowContext, {
    type: "bar",
    data: {
      labels: recentMonths.map(formatMonth),
      datasets: [
        {
          label: "Pemasukan",
          data: recentMonths.map((value) => totalsForMonth(value).income),
          backgroundColor: "#4ab895",
          borderRadius: 5,
          maxBarThickness: 26,
        },
        {
          label: "Pengeluaran",
          data: recentMonths.map((value) => totalsForMonth(value).expense),
          backgroundColor: "#f08a91",
          borderRadius: 5,
          maxBarThickness: 26,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: colors.text, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: colors.grid }, ticks: { color: colors.text, font: { size: 9 }, callback: (value) => formatCompact(value) } },
      },
    },
  });

  const categories = categoryTotals(month);
  const categoryContext = document.getElementById("category-chart").getContext("2d");
  if (categoryChart) categoryChart.destroy();
  categoryChart = new window.Chart(categoryContext, {
    type: "doughnut",
    data: {
      labels: categories.map(([category]) => category),
      datasets: [{
        data: categories.map(([, amount]) => amount),
        backgroundColor: CATEGORY_COLORS,
        borderWidth: 0,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${context.label}: ${formatRupiah(context.raw)}` } },
      },
    },
  });
  elements.categoryLegend.replaceChildren();
  categories.slice(0, 6).forEach(([category], index) => {
    const label = element("span");
    const dot = element("i", "legend-dot");
    dot.style.backgroundColor = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
    label.append(dot, document.createTextNode(category));
    elements.categoryLegend.appendChild(label);
  });
}

function formatCompact(value) {
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (value >= 1_000) return `Rp${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return `Rp${value}`;
}

function renderReports() {
  const month = elements.reportMonth.value || currentMonth();
  const totals = totalsForMonth(month);
  const categories = categoryTotals(month);
  elements.reportIncome.textContent = formatRupiah(totals.income);
  elements.reportExpense.textContent = formatRupiah(totals.expense);
  elements.reportNet.textContent = formatRupiah(totals.income - totals.expense);
  elements.reportTopCategory.textContent = categories.length
    ? `${categories[0][0]} · ${formatRupiah(categories[0][1])}`
    : "—";
  renderMonthlyTable();
  renderReportChart();
}

function renderMonthlyTable() {
  const months = new Set(state.transactions.map((transaction) => transaction.date.slice(0, 7)));
  if (!months.size) months.add(currentMonth());
  const table = element("table", "transaction-table");
  const head = element("thead");
  const header = element("tr");
  ["Bulan", "Pemasukan", "Pengeluaran", "Selisih", "Jumlah transaksi"].forEach((label) =>
    header.appendChild(element("th", "", label)),
  );
  head.appendChild(header);
  table.appendChild(head);
  const body = element("tbody");
  [...months].sort((a, b) => b.localeCompare(a)).forEach((month) => {
    const totals = totalsForMonth(month);
    const row = element("tr");
    [
      formatMonth(month),
      formatRupiah(totals.income),
      formatRupiah(totals.expense),
      formatRupiah(totals.income - totals.expense),
      String(totals.count),
    ].forEach((value) => row.appendChild(element("td", "", value)));
    body.appendChild(row);
  });
  table.appendChild(body);
  elements.monthlyReportTable.replaceChildren(table);
}

function renderReportChart() {
  const available = typeof window.Chart === "function";
  elements.reportFallback.hidden = available;
  if (!available) return;
  const months = monthValues(elements.reportMonth.value || currentMonth(), 6);
  const colors = chartOptions();
  if (reportChart) reportChart.destroy();
  reportChart = new window.Chart(document.getElementById("report-chart").getContext("2d"), {
    type: "line",
    data: {
      labels: months.map(formatMonth),
      datasets: [
        { label: "Pemasukan", data: months.map((month) => totalsForMonth(month).income), borderColor: "#45b993", backgroundColor: "rgba(69,185,147,.1)", fill: true, tension: .35, pointRadius: 3 },
        { label: "Pengeluaran", data: months.map((month) => totalsForMonth(month).expense), borderColor: "#e67582", backgroundColor: "rgba(230,117,130,.08)", fill: true, tension: .35, pointRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: colors.text, usePointStyle: true, boxWidth: 7, font: { size: 10 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: colors.text, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: colors.grid }, ticks: { color: colors.text, font: { size: 9 }, callback: (value) => formatCompact(value) } },
      },
    },
  });
}

function downloadFile(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = element("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  const text = String(value ?? "");
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = [["ID", "Nama transaksi", "Jenis", "Kategori", "Nominal (IDR)", "Tanggal", "Catatan"]];
  [...state.transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((item) => {
      rows.push([
        item.id,
        item.description,
        item.type === "income" ? "Pemasukan" : "Pengeluaran",
        item.category,
        item.amount,
        item.date,
        item.note,
      ]);
    });
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  downloadFile(`duitku-transaksi-${currentMonth()}.csv`, csv, "text/csv;charset=utf-8");
  showToast("File CSV transaksi berhasil dibuat.");
}

function exportJson() {
  const data = {
    application: "DuitKu",
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: state.transactions,
    budgets: state.budgets,
    goals: state.goals,
    settings: state.settings,
  };
  downloadFile(
    `duitku-backup-${currentMonth()}.json`,
    JSON.stringify(data, null, 2),
    "application/json",
  );
  showToast("Backup JSON berhasil dibuat.");
}

function validateBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.transactions)) {
    throw new Error("Struktur backup tidak valid atau tidak memiliki daftar transaksi.");
  }
  const transactionIds = data.transactions
    .map((item) => item && item.id)
    .filter((id) => typeof id === "string" && id);
  if (new Set(transactionIds).size !== transactionIds.length) {
    throw new Error("Backup memiliki ID transaksi duplikat.");
  }
  const goalIds = Array.isArray(data.goals)
    ? data.goals.map((goal) => goal && goal.id).filter((id) => typeof id === "string" && id)
    : [];
  if (new Set(goalIds).size !== goalIds.length) {
    throw new Error("Backup memiliki ID target tabungan duplikat.");
  }
  const normalized = normalizeState(data);
  if (normalized.skippedData) {
    throw new Error("Backup memiliki anggaran atau data lain yang tidak valid. Tidak ada data yang diimpor.");
  }
  if (normalized.transactions.length !== data.transactions.length) {
    throw new Error("Backup memiliki transaksi yang tidak valid. Tidak ada data yang diimpor.");
  }
  if (Array.isArray(data.goals) && normalized.goals.length !== data.goals.length) {
    throw new Error("Backup memiliki target tabungan yang tidak valid.");
  }
  return normalized;
}

async function importJson(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = validateBackup(parsed);
    if (!window.confirm("Impor backup akan mengganti data DuitKu saat ini. Lanjutkan?")) return;
    state = imported;
    delete state.skippedData;
    const persisted = persistState();
    applyTheme();
    renderAll();
    if (persisted) showToast("Backup berhasil diimpor.");
  } catch (error) {
    console.error("Gagal mengimpor backup:", error);
    showToast(error instanceof SyntaxError ? "File JSON tidak valid." : error.message, true);
  } finally {
    elements.importFile.value = "";
  }
}

function clearAllData() {
  if (!window.confirm("Hapus seluruh transaksi, anggaran, dan target tabungan? Tindakan ini tidak dapat dibatalkan.")) return;
  if (!window.confirm("Konfirmasi kedua: data yang dihapus tidak dapat dipulihkan. Lanjutkan?")) {
    showToast("Penghapusan dibatalkan.");
    return;
  }
  state = normalizeState({ settings: state.settings });
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    showToast("Semua data DuitKu telah dihapus.");
  } catch (error) {
    console.error("Gagal menghapus data DuitKu:", error);
    showToast("Sebagian data tidak dapat dihapus dari Local Storage.", true);
  }
  renderAll();
}

function applyTheme() {
  document.body.classList.toggle("dark", state.settings.theme === "dark");
  elements.themeSelect.value = state.settings.theme;
}

function changeTheme() {
  state.settings.theme = elements.themeSelect.value === "dark" ? "dark" : "light";
  persistState();
  applyTheme();
  renderCharts(elements.dashboardMonth.value || currentMonth());
  renderReportChart();
}

function navigateTo(page) {
  if (!PAGE_TITLES[page]) return;
  document.querySelectorAll(".page-section").forEach((section) => {
    section.classList.toggle("active", section.id === `page-${page}`);
  });
  document.querySelectorAll("[data-page-link]").forEach((button) => {
    button.classList.toggle("active", button.dataset.pageLink === page);
  });
  elements.pageTitle.textContent = PAGE_TITLES[page];
  if (page === "dashboard") renderDashboard();
  if (page === "transactions") renderTransactions();
  if (page === "budgets") renderBudgets();
  if (page === "goals") renderGoals();
  if (page === "reports") renderReports();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderBudgets();
  renderGoals();
  renderReports();
}

function handleAction(action, target) {
  if (action === "new-transaction") {
    navigateTo("transactions");
    showTransactionForm();
  } else if (action === "cancel-edit") {
    hideTransactionForm();
  } else if (action === "edit-transaction") {
    const transaction = state.transactions.find((item) => item.id === target.dataset.id);
    if (transaction) showTransactionForm(transaction);
  } else if (action === "delete-transaction") {
    deleteTransaction(target.dataset.id);
  } else if (action === "remove-budget") {
    removeCategoryBudget(target.dataset.category);
  } else if (action === "goal-add") {
    changeGoalAmount(target.dataset.id, 1);
  } else if (action === "goal-subtract") {
    changeGoalAmount(target.dataset.id, -1);
  } else if (action === "goal-delete") {
    deleteGoal(target.dataset.id);
  } else if (action === "close-goal-dialog") {
    elements.goalAmountDialog.close();
  } else if (action === "export-csv") {
    exportCsv();
  } else if (action === "print-report") {
    window.print();
  } else if (action === "export-json") {
    exportJson();
  } else if (action === "clear-data") {
    clearAllData();
  }
}

function initialize() {
  const now = new Date();
  elements.todayLabel.textContent = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  elements.dashboardMonth.value = currentMonth();
  elements.budgetMonth.value = currentMonth();
  elements.reportMonth.value = currentMonth();
  elements.filterMonth.value = "";
  setUpCategoryOptions();
  applyTheme();

  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page-link]");
    if (pageButton) {
      event.preventDefault();
      navigateTo(pageButton.dataset.pageLink);
      return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) handleAction(actionButton.dataset.action, actionButton);
  });
  elements.transactionForm.addEventListener("submit", saveTransaction);
  elements.transactionType.addEventListener("change", () => updateTransactionCategoryOptions());
  elements.filterSearch.addEventListener("input", renderTransactions);
  [elements.filterType, elements.filterCategory, elements.filterMonth, elements.filterSort].forEach((input) =>
    input.addEventListener("change", renderTransactions),
  );
  elements.dashboardMonth.addEventListener("change", renderDashboard);
  elements.budgetMonth.addEventListener("change", renderBudgets);
  elements.reportMonth.addEventListener("change", renderReports);
  elements.overallBudgetForm.addEventListener("submit", saveOverallBudget);
  elements.categoryBudgetForm.addEventListener("submit", saveCategoryBudget);
  elements.goalForm.addEventListener("submit", createGoal);
  elements.goalAmountForm.addEventListener("submit", saveGoalAmount);
  elements.themeSelect.addEventListener("change", changeTheme);
  elements.importFile.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importJson(file);
  });

  if (shouldMigrateLegacy && state.transactions.length) persistState();
  renderAll();
}

initialize();
