const HISTORY_MONTHS = 6;

const RECURRING_TEMPLATES = [
  {
    key: 'rent',
    description: 'House rent',
    category: 'Bills',
    amount: 18500,
  },
  {
    key: 'broadband',
    description: 'Broadband bill',
    category: 'Bills',
    amount: 799,
  },
  {
    key: 'netflix',
    description: 'Netflix subscription',
    category: 'Entertainment',
    amount: 649,
  },
];

const CURRENT_BUDGETS = [
  { category: 'Food', amount: 13000 },
  { category: 'Bills', amount: 30000 },
  { category: 'Transport', amount: 3000 },
  { category: 'Shopping', amount: 20000 },
  { category: 'Entertainment', amount: 4000 },
  { category: 'Health', amount: 3000 },
  { category: 'Education', amount: 4000 },
];

const CURRENT_PLAN = {
  income_assumption: 90000,
  savings_target: 20000,
  objective: 'savings',
};

function pad2(value) {
  return String(value).padStart(2, '0');
}

function ymd(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function monthAt(now, offset) {
  const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function nextMonthly(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function futureOccurrence(lastDate, today) {
  let next = nextMonthly(lastDate);
  let guard = 0;
  while (next <= today && guard < 24) {
    next = nextMonthly(next);
    guard += 1;
  }
  return next;
}

function buildDemoDataset(now = new Date()) {
  const today = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const current = monthAt(now, 0);
  const transactions = [];
  const lastRecurringDate = new Map();

  const add = (year, month, maxDay, day, transaction) => {
    if (day > maxDay) return;
    const date = ymd(year, month, day);
    transactions.push({ ...transaction, date });
    if (transaction.recurringKey) {
      lastRecurringDate.set(transaction.recurringKey, date);
    }
  };

  for (let offset = HISTORY_MONTHS; offset >= 0; offset -= 1) {
    const { year, month } = monthAt(now, offset);
    const maxDay = offset === 0 ? now.getDate() : daysInMonth(year, month);

    add(year, month, maxDay, 1, {
      type: 'income',
      amount: 86000 + (offset % 3) * 1500,
      category: 'Salary',
      description: 'Monthly salary',
    });

    if (offset % 2 === 0) {
      add(year, month, maxDay, 18, {
        type: 'income',
        amount: 12000 + offset * 500,
        category: 'Freelance',
        description: 'Freelance project',
      });
    }

    if (offset % 3 === 1) {
      add(year, month, maxDay, 24, {
        type: 'income',
        amount: 2400 + offset * 100,
        category: 'Investment',
        description: 'Dividend payout',
      });
    }

    add(year, month, maxDay, 3, {
      type: 'expense',
      amount: 18500,
      category: 'Bills',
      description: 'House rent',
      isEssential: 1,
      recurringKey: 'rent',
    });

    add(year, month, maxDay, 5, {
      type: 'expense',
      amount: 799,
      category: 'Bills',
      description: 'Broadband bill',
      isEssential: 1,
      recurringKey: 'broadband',
    });

    add(year, month, maxDay, 8, {
      type: 'expense',
      amount: 1400 + (offset % 4) * 220,
      category: 'Bills',
      description: 'Electricity bill',
      isEssential: 1,
    });

    if (offset % 6 === 0) {
      add(year, month, maxDay, 9, {
        type: 'expense',
        amount: 4800,
        category: 'Bills',
        description: 'Health insurance premium',
        isEssential: 1,
      });
    }

    add(year, month, maxDay, 4, {
      type: 'expense',
      amount: 3200 + (offset % 3) * 150,
      category: 'Food',
      description: 'Groceries',
      isEssential: 1,
    });

    add(year, month, maxDay, 11, {
      type: 'expense',
      amount: 2900 + (offset % 2) * 120,
      category: 'Food',
      description: 'Groceries',
      isEssential: 1,
    });

    add(year, month, maxDay, 18, {
      type: 'expense',
      amount: 3600 + (offset % 3) * 120,
      category: 'Food',
      description: 'Groceries',
      isEssential: 1,
    });

    add(year, month, maxDay, 25, {
      type: 'expense',
      amount: 3100 + (offset % 2) * 180,
      category: 'Food',
      description: 'Groceries',
      isEssential: 1,
    });

    add(year, month, maxDay, 14, {
      type: 'expense',
      amount: 950 + (offset % 3) * 120,
      category: 'Food',
      description: 'Dinner out',
      isEssential: 0,
    });

    add(year, month, maxDay, 22, {
      type: 'expense',
      amount: 1250 + (offset % 2) * 100,
      category: 'Food',
      description: 'Weekend brunch',
      isEssential: 0,
    });

    add(year, month, maxDay, 2, {
      type: 'expense',
      amount: 2600 + (offset % 3) * 80,
      category: 'Transport',
      description: 'Metro card recharge',
      isEssential: 1,
    });

    add(year, month, maxDay, 6, {
      type: 'expense',
      amount: 380 + (offset % 3) * 30,
      category: 'Transport',
      description: 'Cab ride',
      isEssential: 0,
    });

    add(year, month, maxDay, 13, {
      type: 'expense',
      amount: 520 + (offset % 3) * 40,
      category: 'Transport',
      description: 'Cab ride',
      isEssential: 0,
    });

    add(year, month, maxDay, 21, {
      type: 'expense',
      amount: 640 + (offset % 2) * 40,
      category: 'Transport',
      description: 'Cab ride',
      isEssential: 0,
    });

    add(year, month, maxDay, 16, {
      type: 'expense',
      amount: 2800 + (offset % 3) * 400,
      category: 'Shopping',
      description: 'Clothing',
      isEssential: 0,
    });

    add(year, month, maxDay, 12, {
      type: 'expense',
      amount: 649,
      category: 'Entertainment',
      description: 'Netflix subscription',
      isEssential: 0,
      recurringKey: 'netflix',
    });

    add(year, month, maxDay, 27, {
      type: 'expense',
      amount: 900 + (offset % 3) * 100,
      category: 'Entertainment',
      description: 'Cinema tickets',
      isEssential: 0,
    });

    add(year, month, maxDay, 7, {
      type: 'expense',
      amount: 299,
      category: 'Entertainment',
      description: 'Prime Video subscription',
      isEssential: 0,
    });

    add(year, month, maxDay, 10, {
      type: 'expense',
      amount: 199,
      category: 'Bills',
      description: 'Cloud backup plan',
      isEssential: 1,
    });

    if (offset % 2 === 0) {
      add(year, month, maxDay, 10, {
        type: 'expense',
        amount: 560 + (offset % 3) * 60,
        category: 'Health',
        description: 'Pharmacy',
        isEssential: 1,
      });
    }

    if (offset % 3 === 0) {
      add(year, month, maxDay, 19, {
        type: 'expense',
        amount: 2999,
        category: 'Education',
        description: 'Online course',
        isEssential: 1,
      });
    }

    if (offset === 0) {
      add(year, month, maxDay, Math.min(now.getDate(), 22), {
        type: 'expense',
        amount: 16500,
        category: 'Shopping',
        description: 'New laptop',
        isEssential: 0,
      });
    }
  }

  const recurring = RECURRING_TEMPLATES.map((template) => {
    const lastDate = lastRecurringDate.get(template.key) || ymd(current.year, current.month, 1);
    return {
      ...template,
      type: 'expense',
      frequency: 'monthly',
      next_occurrence: futureOccurrence(lastDate, today),
    };
  });

  return {
    transactions,
    recurring,
    budgets: CURRENT_BUDGETS.map((budget) => ({
      ...budget,
      month: current.month,
      year: current.year,
    })),
    plan: {
      ...CURRENT_PLAN,
      month: current.month,
      year: current.year,
    },
  };
}

module.exports = {
  HISTORY_MONTHS,
  buildDemoDataset,
};
