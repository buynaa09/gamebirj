import { useEffect, useState } from 'react';
import { fetchBankAccount, fetchBanks, updateBankAccount } from '../../services/banks';
import type { Bank } from '../../types';
import styles from './AccountManageModal.module.css';

export function AccountManageModal({ onClose }: { onClose: () => void }) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankId, setBankId] = useState<number | null>(null);
  const [bankQuery, setBankQuery] = useState('');
  const [holder, setHolder] = useState('');
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchBanks(), fetchBankAccount()]).then(([bankList, account]) => {
      if (cancelled) return;
      setBanks(bankList);
      setBankId(account.bank_id);
      setHolder(account.account_holder);
      setNumber(account.account_number);
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Дансны мэдээллийг ачаалж чадсангүй.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const save = async () => {
    if (!bankId) {
      setError('Банк сонгоно уу.');
      return;
    }
    if (!holder.trim() || !number.trim()) {
      setError('Хүлээн авагчийн нэр болон дансны дугаарийг оруулна уу.');
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const account = await updateBankAccount({ bank_id: bankId, account_holder: holder, account_number: number });
      setBankId(account.bank_id);
      setHolder(account.account_holder);
      setNumber(account.account_number);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Дансны мэдээллийг хадгалж чадсангүй.');
    } finally {
      setSaving(false);
    }
  };

  const filteredBanks = banks.filter((bank) => {
    const query = bankQuery.trim().toLowerCase();
    return !query || `${bank.name} ${bank.description}`.toLowerCase().includes(query);
  });

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="account-manage-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.head}>
          <h2 id="account-manage-title">Данс Manage</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Хаах">×</button>
        </div>
        {loading ? <p className={styles.muted}>Дансны мэдээллийг ачааллаж байна…</p> : (
          <div className={styles.form}>
            <div className={styles.bankPicker}>
              <span className={styles.label}>Банк сонгох</span>
              <input className={styles.bankSearch} value={bankQuery} onChange={(event) => setBankQuery(event.target.value)} placeholder="Хайх ......." />
              <div className={styles.bankList}>
                {filteredBanks.map((bank) => (
                  <button
                    type="button"
                    key={bank.id}
                    className={`${styles.bankOption} ${bankId === bank.id ? styles.bankSelected : ''}`}
                    aria-pressed={bankId === bank.id}
                    onClick={() => setBankId(bank.id)}
                  >
                    <img src={bank.logo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    <span>{bank.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <label>Хүлээн авагчийн нэр
              <input value={holder} onChange={(event) => setHolder(event.target.value)} placeholder="Нэр, овог" />
            </label>
            <label>Дансны дугаар
              <input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" placeholder="Дансны дугаар" />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            {saved && <p className={styles.saved}>✓ Дансны мэдээллийг хадгаллаа</p>}
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>{saving ? 'Хадгалж байна…' : 'Хадгалах'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
