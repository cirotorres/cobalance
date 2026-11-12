import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { modules, apiError } from '../../services/loansService';
import api from '../../services/api';
import styles from './ModuleSwitcher.module.css';
import { ACTIVE_MODULE_KEY, moduleSelectionKey } from './moduleSession';

const PATHS = { cards: '/home', loans: '/loans' };
const LABELS = { cards: 'Cartões', loans: 'Empréstimos' };

/** Seletor explícito de ambiente. Não agrega dados entre módulos. */
function ModuleSwitcher({ current, redirectToDefault = false }) {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(null);
  const [ownerKey, setOwnerKey] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([modules.get(), api.get('/auth/me')]).then(([p, identity]) => {
      if (!alive) return;
      const key = moduleSelectionKey(identity.data.email);
      // Chave global legada nunca deve influenciar outra identidade autenticada.
      sessionStorage.removeItem(ACTIVE_MODULE_KEY);
      let local = sessionStorage.getItem(key);
      if (local && !p[`${local}_enabled`]) {
        sessionStorage.removeItem(key);
        local = null;
      }
      setOwnerKey(key);
      setPrefs(p);
      if (redirectToDefault && !local && p.default_module !== current && p[`${p.default_module}_enabled`]) {
        navigate(PATHS[p.default_module]);
      }
    }).catch(() => alive && setError('Não foi possível carregar os módulos.'));
    return () => { alive = false; };
  }, [current, navigate, redirectToDefault]);

  const go = (mod, activePrefs = prefs) => {
    if (!activePrefs?.[`${mod}_enabled`] || !ownerKey) return;
    sessionStorage.setItem(ownerKey, mod);
    navigate(PATHS[mod]);
  };

  const enableLoans = async () => {
    try {
      const p = await modules.patch({ loans_enabled: true });
      setPrefs(p);
      go('loans', p);
    } catch (e) {
      setError(apiError(e));
    }
  };

  if (!prefs) return error ? <span className={styles.error}>{error}</span> : null;

  const enabled = ['cards', 'loans'].filter((m) => prefs[`${m}_enabled`]);
  return (
    <nav className={styles.switcher} aria-label="Ambiente financeiro">
      {enabled.map((m) => (
        <button
          key={m}
          type="button"
          className={`${styles.option} ${m === current ? styles.active : ''}`}
          aria-current={m === current ? 'page' : undefined}
          onClick={() => m !== current && go(m)}
        >
          {LABELS[m]}
        </button>
      ))}
      {!prefs.loans_enabled && (
        <button type="button" className={styles.enable} onClick={enableLoans}>
          Ativar Empréstimos
        </button>
      )}
      {error && <span className={styles.error} role="alert">{error}</span>}
    </nav>
  );
}

export default ModuleSwitcher;
