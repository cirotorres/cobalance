import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { loansApi, apiError } from '../../services/loansService';
import { formatBRL, formatDate } from './money';
import styles from './Loans.module.css';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand?.('copy');
  ta.remove();
  return !!ok;
}

export function ChargeView({ charge, onShared, onClose }) {
  const [qr, setQr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    QRCode.toDataURL(charge.brcode, { errorCorrectionLevel: 'M', margin: 1, width: 240 }).then(setQr).catch(() => setQr(''));
  }, [charge.brcode]);

  const markShared = async () => {
    try { onShared?.(await loansApi.markShared(charge.id)); } catch { /* histórico local apenas */ }
  };

  const share = async () => {
    setMsg('');
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cobrança', text: charge.message });
        await markShared();
        setMsg('Mensagem compartilhada.');
        return;
      } catch { /* cancelado → fallback */ }
    }
    const ok = await copyText(charge.message);
    if (ok) await markShared();
    setMsg(ok ? 'Compartilhamento indisponível: mensagem copiada.' : 'Não foi possível copiar; selecione o texto manualmente.');
  };

  const copyPix = async () => {
    const ok = await copyText(charge.brcode);
    setMsg(ok ? 'Pix Copia e Cola copiado.' : 'Selecione o código manualmente.');
  };

  return (
    <div className={styles.card} aria-label={`Cobrança ${charge.id}`}>
      <h3>Cobrança #{charge.id} — {formatBRL(charge.total)} <span className={styles.badgeMuted}>{charge.status === 'SHARED' ? 'Compartilhada' : 'Gerada'}</span></h3>
      <p className={styles.warn} role="note">
        Gerar ou compartilhar a cobrança <strong>não</strong> registra pagamento. Quando o Pix cair, confirme o recebimento manualmente.
      </p>
      {charge.values_may_have_changed && <p className={styles.warn}>Valores atuais podem divergir desta cobrança histórica.</p>}
      <ul className={styles.list}>
        {charge.items.map((i) => (
          <li key={i.installment_id}>Empréstimo #{i.loan_id} · parcela {i.installment_number} · venc. {formatDate(i.due_on)} · {formatBRL(i.amount)}</li>
        ))}
      </ul>
      <p>Recebedor: {charge.holder_name} ({charge.city})</p>
      {charge.pix_key && <p>Chave Pix da cobrança: {charge.pix_key}</p>}
      <div className={styles.qrRow}>
        {qr ? <img src={qr} alt="QR Code Pix estático" width={240} height={240} data-testid="pix-qr" /> : <p>Gerando QR…</p>}
        <label className={styles.field}>Pix Copia e Cola
          <textarea readOnly value={charge.brcode} rows={4} data-testid="pix-brcode" onFocus={(e) => e.target.select()} />
        </label>
      </div>
      <label className={styles.field}>Mensagem
        <textarea readOnly value={charge.message} rows={6} data-testid="charge-message" />
      </label>
      <div className={styles.actions}>
        {onClose && <button type="button" onClick={onClose}>Fechar detalhes</button>}
        <button type="button" onClick={copyPix}>Copiar Pix Copia e Cola</button>
        <button type="button" className={styles.primary} onClick={share}>Compartilhar mensagem</button>
      </div>
      {msg && <p role="status" className={styles.ok}>{msg}</p>}
    </div>
  );
}

function ChargePanel({ borrowerId, items, pixAccounts, onCreated, onCancel }) {
  const active = pixAccounts.filter((p) => p.is_active);
  const def = active.find((p) => p.is_default);
  const [pixId, setPixId] = useState(def ? String(def.id) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true); setError('');
    try {
      onCreated(await loansApi.createCharge({ borrower_id: borrowerId, installment_ids: items.map((i) => i.id), pix_account_id: parseInt(pixId, 10) }));
    } catch (e) {
      setError(apiError(e));
      setBusy(false);
    }
  };

  if (!active.length) {
    return <p role="alert" className={styles.error}>Cadastre uma conta Pix em Configurações para gerar cobranças.</p>;
  }
  return (
    <div className={styles.dialog} aria-label="Gerar cobrança Pix">
      <h3>Gerar cobrança Pix ({items.length} parcela{items.length > 1 ? 's' : ''})</h3>
      <label className={styles.field}>Conta Pix de destino
        <select value={pixId} onChange={(e) => setPixId(e.target.value)}>
          {active.map((p) => <option key={p.id} value={p.id}>{p.label}{p.is_default ? ' (padrão)' : ''} — {p.key_masked}</option>)}
        </select>
      </label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" onClick={onCancel}>Cancelar</button>
        <button type="button" className={styles.primary} onClick={create} disabled={busy || !pixId}>Gerar cobrança</button>
      </div>
    </div>
  );
}

export default ChargePanel;
