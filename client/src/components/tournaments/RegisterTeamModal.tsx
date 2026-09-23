import { useEffect, useState } from 'react';
import { checkLeaderId, registerTeam } from '../../services/tournaments';
import type { CheckedAccount } from '../../services/tournaments';
import type { Tournament } from '../../types';
import styles from './RegisterTeamModal.module.css';

interface RegisterTeamModalProps {
  tournament: Tournament;
  onClose: () => void;
  onRegistered: () => void;
}

export function RegisterTeamModal({ tournament, onClose, onRegistered }: RegisterTeamModalProps) {
  const verifiable = tournament.id_check_slug !== '';
  const [teamName, setTeamName] = useState('');
  const [leaderGameId, setLeaderGameId] = useState('');
  const [serverId, setServerId] = useState('');
  const [checked, setChecked] = useState<CheckedAccount | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const invalidateCheck = () => setChecked(null);

  const checkAccount = async () => {
    const userId = leaderGameId.trim();
    const server = serverId.trim();
    if (!userId || !server) {
      setError('User ID болон Server ID-г бөглөнө үү.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const account = await checkLeaderId(tournament.id, userId, server);
      setChecked(account);
    } catch (err) {
      setChecked(null);
      setError(err instanceof Error ? err.message : 'Аккаунт шалгаж чадсангүй.');
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    const name = teamName.trim();
    const gameId = leaderGameId.trim();
    if (!name || !gameId) {
      setError('Багийн нэр болон ахлагчийн game ID-г бөглөнө үү.');
      return;
    }
    if (verifiable && !checked) {
      setError('Эхлээд «Шалгах» товчоор аккаунтаа баталгаажуулна уу.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await registerTeam(tournament.id, {
        team_name: name,
        leader_game_id: gameId,
        leader_server_id: verifiable ? serverId.trim() : undefined,
        leader_nickname: checked?.nickname,
      });
      setDone(true);
      onRegistered();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Бүртгэл амжилтгүй боллоо.';
      setError(
        message === 'Unauthorized' || message.includes('CSRF')
          ? 'Бүртгүүлэхийн тулд эхлээд нэвтэрнэ үү.'
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Баг бүртгүүлэх"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>{tournament.game}</p>
            <h3 className={styles.title}>{done ? 'Бүртгэл амжилттай!' : 'Баг бүртгүүлэх'}</h3>
            {!done && <p className={styles.sub}>{tournament.title}</p>}
          </div>
          <button type="button" className={styles.closeBtn} aria-label="Хаах" onClick={onClose}>
            ✕
          </button>
        </div>

        {done ? (
          <div className={styles.success}>
            <p>
              <b>{teamName.trim()}</b> баг <b>{tournament.title}</b> тэмцээнд бүртгэгдлээ.
              Тэмцээний хуваарь зарлагдахыг хүлээнэ үү.
            </p>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Хаах
            </button>
          </div>
        ) : (
          <>
            <label className={styles.field}>
              <span>Багийн нэр</span>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Жишээ: Night Wolves"
                maxLength={100}
                autoFocus
              />
            </label>
            {verifiable ? (
              <>
                <div className={styles.idRow}>
                  <label className={styles.field}>
                    <span>User ID</span>
                    <input
                      type="text"
                      value={leaderGameId}
                      onChange={(e) => {
                        setLeaderGameId(e.target.value);
                        invalidateCheck();
                      }}
                      placeholder="1234449725"
                      maxLength={100}
                      inputMode="numeric"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Server ID</span>
                    <input
                      type="text"
                      value={serverId}
                      onChange={(e) => {
                        setServerId(e.target.value);
                        invalidateCheck();
                      }}
                      placeholder="11467"
                      maxLength={100}
                      inputMode="numeric"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className={`btn btn-outline ${styles.checkBtn}`}
                  onClick={checkAccount}
                  disabled={checking}
                >
                  {checking ? 'Шалгаж байна…' : 'Шалгах'}
                </button>
                {checked && (
                  <p className={styles.verified}>
                    ✓ {checked.nickname}
                    {checked.region ? ` · ${checked.region}` : ''}
                  </p>
                )}
              </>
            ) : (
              <label className={styles.field}>
                <span>Ахлагчийн game ID</span>
                <input
                  type="text"
                  value={leaderGameId}
                  onChange={(e) => setLeaderGameId(e.target.value)}
                  placeholder="Жишээ: 512345678"
                  maxLength={100}
                />
              </label>
            )}
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Болих
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? 'Бүртгэж байна…' : 'Бүртгүүлэх'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
