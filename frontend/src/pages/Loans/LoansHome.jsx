import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/AppLayout/AppLayout';
import Tabs from '../../components/Tabs/Tabs';
import ModuleSwitcher from '../../components/ModuleSwitcher/ModuleSwitcher';
import { clearActiveModuleSelection } from '../../components/ModuleSwitcher/moduleSession';
import api from '../../services/api';
import { modules } from '../../services/loansService';
import BorrowersTab from './BorrowersTab';
import NewLoanTab from './NewLoanTab';
import BalanceTab from './BalanceTab';
import SettingsTab from './SettingsTab';
import styles from './Loans.module.css';

const TABS = [
  { id: 'pessoas', label: 'Pessoas', shortLabel: 'Pessoas', icon: 'users' },
  { id: 'novo', label: 'Novo empréstimo', shortLabel: 'Novo', icon: 'list' },
  { id: 'balanco', label: 'Balanço', shortLabel: 'Balanço', icon: 'chart' },
  { id: 'config', label: 'Configurações', shortLabel: 'Config.', icon: 'file' },
];

function LoansHome() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pessoas');
  const [userName, setUserName] = useState('Usuário');
  const [userEmail, setUserEmail] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | disabled
  const [focusBorrower, setFocusBorrower] = useState(null);

  useEffect(() => {
    api.get('/auth/me').then((r) => {
      setUserEmail(r.data.email);
      const n = r.data.email.split('@')[0];
      setUserName(n.charAt(0).toUpperCase() + n.slice(1));
    }).catch(() => {});
    modules.get().then((p) => setState(p.loans_enabled ? 'ready' : 'disabled')).catch(() => setState('disabled'));
  }, []);

  const logout = () => {
    clearActiveModuleSelection(userEmail);
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    navigate('/');
  };

  return (
    <AppLayout userName={userName} onLogout={logout} containedScroll headerExtra={<ModuleSwitcher current="loans" />}>
      <div className={styles.page}>
        <p className={styles.envBadge} data-testid="env-badge">Ambiente: <strong>Empréstimos pessoais</strong></p>
        {state === 'loading' && <p>Carregando…</p>}
        {state === 'disabled' && (
          <div className={styles.card} role="status">
            <p>O módulo Empréstimos não está ativo para sua conta. Use “Ativar Empréstimos” no topo.</p>
          </div>
        )}
        {state === 'ready' && (
          <>
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
            <section className={styles.content}>
              {tab === 'pessoas' && <BorrowersTab key={focusBorrower || 'none'} focusId={focusBorrower} />}
              {tab === 'novo' && (
                <NewLoanTab onOpenBorrower={(id) => { setFocusBorrower(id); setTab('pessoas'); }} />
              )}
              {tab === 'balanco' && <BalanceTab />}
              {tab === 'config' && <SettingsTab />}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default LoansHome;
