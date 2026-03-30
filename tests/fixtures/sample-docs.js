/**
 * Calculate the total price including tax.
 * @param {number} price - Base price
 * @param {number} taxRate - Tax rate as decimal
 * @returns {number} Total price
 */
function calculateTotal(price, taxRate) {
  return price * (1 + taxRate);
}

/** Format a currency value with the given locale */
export function formatCurrency(value, locale) {
  return new Intl.NumberFormat(locale).format(value);
}

// Not a JSDoc comment
function noDocsHelper() {}

/** API base URL for all requests */
export const API_URL = 'https://api.example.com';
