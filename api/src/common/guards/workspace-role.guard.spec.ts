import { hasRole } from './workspace-role.guard.js';

describe('hasRole', () => {
  it('sin roles requeridos basta con ser miembro', () => {
    expect(hasRole('MEMBER', [])).toBe(true);
  });

  it('ADMIN cumple cualquier requisito', () => {
    expect(hasRole('ADMIN', ['ADMIN'])).toBe(true);
    expect(hasRole('ADMIN', ['MEMBER'])).toBe(true);
  });

  it('MEMBER no cumple ADMIN', () => {
    expect(hasRole('MEMBER', ['ADMIN'])).toBe(false);
  });
});
