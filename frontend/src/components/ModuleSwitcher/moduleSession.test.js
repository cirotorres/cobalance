import { afterEach, describe, expect, it } from 'vitest';
import { ACTIVE_MODULE_KEY, clearActiveModuleSelection, moduleSelectionKey } from './moduleSession';

afterEach(() => sessionStorage.clear());

describe('SPEC003-R7 — seleção transitória de módulos', () => {
  it('limpa apenas a conta que fez logout e a chave antiga', () => {
    const a = moduleSelectionKey(' A@Example.Test ');
    const b = moduleSelectionKey('b@example.test');
    sessionStorage.setItem(a, 'cards');
    sessionStorage.setItem(b, 'loans');
    sessionStorage.setItem(ACTIVE_MODULE_KEY, 'cards');
    sessionStorage.setItem('unrelated.session.data', 'keep');
    clearActiveModuleSelection('A@example.test');
    expect(sessionStorage.getItem(a)).toBeNull();
    expect(sessionStorage.getItem(ACTIVE_MODULE_KEY)).toBeNull();
    expect(sessionStorage.getItem(b)).toBe('loans');
    expect(sessionStorage.getItem('unrelated.session.data')).toBe('keep');
  });

  it('logout antes de resolver identidade só limpa o namespace de módulos', () => {
    sessionStorage.setItem(moduleSelectionKey('a@example.test'), 'cards');
    sessionStorage.setItem(moduleSelectionKey('b@example.test'), 'loans');
    sessionStorage.setItem('other.module.state', 'preserve');
    clearActiveModuleSelection(null);
    expect(sessionStorage.getItem(moduleSelectionKey('a@example.test'))).toBeNull();
    expect(sessionStorage.getItem(moduleSelectionKey('b@example.test'))).toBeNull();
    expect(sessionStorage.getItem('other.module.state')).toBe('preserve');
  });
});
