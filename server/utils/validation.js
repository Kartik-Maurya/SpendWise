function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(trimmed) && trimmed.length <= 254;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8 && password.length <= 128;
}

function validateAmount(amount) {
  const num = Number(amount);
  return !isNaN(num) && num > 0 && num <= 1e12;
}

function validateType(type) {
  return ['income', 'expense'].includes(type);
}

function validateCategory(category, type) {
  const incomeCategories = ['Salary', 'Freelance', 'Investment', 'Other Income'];
  const expenseCategories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Education', 'Health', 'Other'];
  const allCategories = [...incomeCategories, ...expenseCategories];
  if (!category || typeof category !== 'string') return false;
  return allCategories.includes(category);
}

function validateDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;
  const d = new Date(dateString);
  return !isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

function validateFrequency(frequency) {
  return ['weekly', 'monthly', 'yearly'].includes(frequency);
}

module.exports = {
  validateEmail,
  validatePassword,
  validateAmount,
  validateType,
  validateCategory,
  validateDate,
  validateFrequency,
};
