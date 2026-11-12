/** Preferência de navegação transitória (não substitui default_module do backend). */
export const ACTIVE_MODULE_KEY = 'cobalance.activeModule';

export function moduleSelectionKey(email) {
  return typeof email === 'string' && email.trim()
    ? `${ACTIVE_MODULE_KEY}:${email.trim().toLowerCase()}`
    : null;
}

/** Logout remove só a seleção de módulo, nunca o sessionStorage inteiro.
 * Sem identidade pronta (logout imediato), limpa apenas o namespace de módulos.
 */
export function clearActiveModuleSelection(email) {
  sessionStorage.removeItem(ACTIVE_MODULE_KEY); // chave global legada
  const key = moduleSelectionKey(email);
  if (key) {
    sessionStorage.removeItem(key);
  } else {
    Object.keys(sessionStorage)
      .filter((name) => name.startsWith(`${ACTIVE_MODULE_KEY}:`))
      .forEach((name) => sessionStorage.removeItem(name));
  }
}
