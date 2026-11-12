import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loansApi, modules, apiError } from '../../services/loansService';
import styles from './Loans.module.css';

const EMPTY = { label: '', key: '', holder_name: '', city: '', institution: '' };

function SettingsTab() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [prefs, setPrefs] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => loansApi.listPix().then(setAccounts).catch((e) => setError(apiError(e)));
  useEffect(() => { load(); modules.get().then(setPrefs); }, []);

  const run = async (fn, ok) => {
    setError(''); setMsg('');
    try { await fn(); setMsg(ok); await load(); } catch (e) { setError(apiError(e)); }
  };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      const body = { ...form };
      if (!body.institution) delete body.institution;
      await loansApi.createPix(body);
      setForm(EMPTY);
    }, 'Conta Pix cadastrada.');
  };

  const setDefaultModule = (m) => run(async () => setPrefs(await modules.patch({ default_module: m })), 'Módulo padrão atualizado.');
  const disableLoans = () => run(async () => {
    await modules.patch({ loans_enabled: false, default_module: 'cards' });
    navigate('/home');
  }, '');

  return (
    <div className={styles.stack}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {msg && <p role="status" className={styles.ok}>{msg}</p>}
      <div className={styles.card}>
        <h3>Contas Pix de recebimento</h3>
        <p className={styles.muted}>Exatamente uma conta ativa é a padrão. A chave é dado pessoal e aparece mascarada aqui.</p>
        <ul className={styles.list} aria-label="Contas Pix">
          {accounts.map((a) => (
            <li key={a.id} className={styles.row} data-testid={`pix-${a.id}`}>
              <span>
                <strong>{a.label}</strong> · {a.key_masked} · {a.holder_name} ({a.city})
                {a.is_default && <span className={styles.badge}> Padrão</span>}
                {!a.is_active && <span className={styles.badgeMuted}> Inativa</span>}
              </span>
              <span className={styles.actions}>
                {a.is_active && !a.is_default && (
                  <button type="button" onClick={() => run(() => loansApi.setDefaultPix(a.id), 'Conta padrão atualizada.')}>
                    Tornar padrão: {a.label}
                  </button>
                )}
                {a.is_active ? (
                  <button type="button" onClick={() => run(() => loansApi.patchPix(a.id, { is_active: false }), 'Conta desativada.')}>Desativar</button>
                ) : (
                  <button type="button" onClick={() => run(() => loansApi.patchPix(a.id, { is_active: true }), 'Conta reativada.')}>Reativar</button>
                )}
              </span>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className={styles.formGrid} aria-label="Nova conta Pix">
          <label className={styles.field}>Apelido<input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
          <label className={styles.field}>Chave Pix<input required value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="e-mail, +55…, CPF, CNPJ ou aleatória" /></label>
          <label className={styles.field}>Nome do recebedor<input required value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} /></label>
          <label className={styles.field}>Cidade do recebedor<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label className={styles.field}>Instituição (opcional)<input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} /></label>
          <button type="submit" className={styles.primary}>Adicionar conta Pix</button>
        </form>
      </div>
      {prefs && (
        <div className={styles.card}>
          <h3>Módulos</h3>
          <label className={styles.field}>
            Módulo padrão ao entrar
            <select value={prefs.default_module} onChange={(e) => setDefaultModule(e.target.value)}>
              {prefs.cards_enabled && <option value="cards">Cartões</option>}
              <option value="loans">Empréstimos</option>
            </select>
          </label>
          {prefs.cards_enabled && (
            <button type="button" onClick={disableLoans}>Ocultar módulo Empréstimos (dados preservados)</button>
          )}
        </div>
      )}
    </div>
  );
}

export default SettingsTab;
