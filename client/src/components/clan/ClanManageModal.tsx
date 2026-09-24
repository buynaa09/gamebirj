import { useEffect, useState } from 'react';
import { fetchMyTeams, renameTeam } from '../../services/tournaments';
import type { TournamentTeam } from '../../types';
import styles from './ClanManageModal.module.css';

export function ClanManageModal({ onClose }: { onClose: () => void }) {
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyTeams().then(
      (result) => {
        if (!cancelled) {
          setTeams(result);
          setNames(Object.fromEntries(result.map((team) => [team.id, team.name])));
        }
      },
      (err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Багуудыг ачаалж чадсангүй.');
      },
    ).finally(() => {
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

  const save = async (team: TournamentTeam) => {
    const name = (names[team.id] ?? '').trim();
    if (!name) {
      setError('Клангийн нэрийг оруулна уу.');
      return;
    }
    setSavingId(team.id);
    setSavedId(null);
    setError(null);
    try {
      const updated = await renameTeam(team.id, name);
      setTeams((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSavedId(updated.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Клангийн нэрийг солих боломжгүй байна.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="clan-manage-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.head}>
          <h2 id="clan-manage-title">Clan Manage</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Хаах">×</button>
        </div>
        {loading ? <p className={styles.muted}>Клангуудыг ачааллаж байна…</p> : teams.length === 0 ? <p className={styles.muted}>Турнирийн баг байхгүй байна.</p> : (
          <div className={styles.teams}>
            {teams.map((team) => (
              <div className={styles.team} key={team.id}>
                <div className={styles.teamInfo}><b>{team.game}</b><span>{team.leader_nickname || team.leader_game_id}</span></div>
                <div className={styles.form}>
                  <input aria-label={`${team.game} кланын нэр`} value={names[team.id] ?? ''} maxLength={100} onChange={(event) => setNames((current) => ({ ...current, [team.id]: event.target.value }))} />
                  <button type="button" className="btn btn-primary" disabled={savingId === team.id} onClick={() => void save(team)}>{savingId === team.id ? '…' : 'Хадгалах'}</button>
                  {savedId === team.id && <span className={styles.saved}>✓</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
