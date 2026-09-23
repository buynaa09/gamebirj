import { useEffect, useState } from 'react';
import { registerTeam } from '../../services/tournaments';
import type { Tournament } from '../../types';
import styles from './RegisterTeamModal.module.css';

interface RegisterTeamModalProps {
  tournament: Tournament;
  onClose: () => void;
  onRegistered: () => void;
}

export function RegisterTeamModal({ tournament, onClose, onRegistered }: RegisterTeamModalProps) {
  const [teamName, setTeamName] = useState('');
  const [leaderGameId, setLeaderGameId] = useState('');
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

  const submit = async () => {
    const name = teamName.trim();
    const gameId = leaderGameId.trim();
    if (!name || !gameId) {
      setError('Багийн нэр болон ахлагчийн game ID-г бөглөнө үү.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await registerTeam(tournament.id, { team_name: name, leader_game_id: gameId });
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
