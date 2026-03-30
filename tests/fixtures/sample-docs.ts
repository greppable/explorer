/** User authentication service */
export class AuthService {
  /** Validate a JWT token and return the decoded payload */
  validateToken(token: string): Promise<Payload> {
    // ...
    return {} as any;
  }

  /** Hash a password using bcrypt. Returns the salted hash. */
  hashPassword(password: string): string {
    // ...
    return '';
  }

  // This is NOT a JSDoc comment (single //)
  logout(): void {}
}

/**
 * Calculate total price including tax.
 * @param price - Base price
 * @param taxRate - Tax rate as decimal
 * @returns Total price with tax
 */
export function calculateTotal(price: number, taxRate: number): number {
  return price * (1 + taxRate);
}

/** Maximum retry attempts for authentication */
export const MAX_RETRIES = 3;

// No JSDoc here
export function helperWithoutDocs(): void {}
