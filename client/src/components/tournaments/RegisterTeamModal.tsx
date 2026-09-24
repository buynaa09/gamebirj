import { useEffect, useState } from 'react';
import { SignIn, useAuth } from '@clerk/react';
import { checkLeaderId, createTeam, fetchMyTeams, registerTeam } from '../../services/tournaments';
import type { CheckedAccount } from '../../services/tournaments';
import type { Tournament, TournamentTeam } from '../../types';
import styles from './RegisterTeamModal.module.css';

interface RegisterTeamModalProps {
  tournament: Tournament;
  onClose: () => void;
  onRegistered: () => void;
}

type Phase = 'loading' | 'pick' | 'create' | 'done';

function authError(message: string): string {
  return message === 'Unauthorized' || message.includes('CSRF')
    ? 'Бүртгүүлэхийн тулд эхлээд нэвтэрнэ үү.'
    : message;
}

export function RegisterTeamModal({ tournament, onClose, onRegistered }: RegisterTeamModalProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const verifiable = tournament.id_check_slug !== '';
  const [phase, setPhase] = useState<Phase>('loading');
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [teamName, setTeamName] = useState('');
  const [leaderGameId, setLeaderGameId] = useState('');
  const [serverId, setServerId] = useState('');
  const [checked, setChecked] = useState<CheckedAccount | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneName, setDoneName] = useState('');

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

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded || !isSignedIn) return () => {
      cancelled = true;
    };
    fetchMyTeams(tournament.game_id).then(
      (result) => {
        if (cancelled) return;
        setTeams(result);
        setSelectedId(result.length > 0 ? result[0].id : null);
        setPhase(result.length > 0 ? 'pick' : 'create');
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(authError(err instanceof Error ? err.message : 'Багууд ачааллаж чадсангүй.'));
        setPhase('create');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tournament.game_id, isLoaded, isSignedIn]);

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

  const submitPick = async () => {
    if (selectedId === null) {
      setError('Багаа сонгоно уу.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const registration = await registerTeam(tournament.id, { team_id: selectedId });
      setDoneName(registration.team_name);
      setPhase('done');
      onRegistered();
    } catch (err) {
      setError(authError(err instanceof Error ? err.message : 'Бүртгэл амжилтгүй боллоо.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitCreate = async () => {
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
      const team = await createTeam({
        game_id: tournament.game_id,
        name,
        leader_game_id: gameId,
        leader_server_id: verifiable ? serverId.trim() : undefined,
        leader_nickname: checked?.nickname,
      });
      const registration = await registerTeam(tournament.id, { team_id: team.id });
      setTeams((prev) => [...prev, team]);
      setDoneName(registration.team_name);
      setPhase('done');
      onRegistered();
    } catch (err) {
      setError(authError(err instanceof Error ? err.message : 'Бүртгэл амжилтгүй боллоо.'));
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
        {isLoaded && !isSignedIn ? (
          <>
            <div className={styles.header}>
              <div>
                <p className={styles.kicker}>{tournament.game}</p>
                <h3 className={styles.title}>Эхлээд нэвтэрнэ үү</h3>
                <p className={styles.sub}>Тэмцээнд бүртгүүлэхийн тулд нэвтрэх шаардлагатай.</p>
              </div>
              <button type="button" className={styles.closeBtn} aria-label="Хаах" onClick={onClose}>
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <SignIn signUpUrl="/signup" />
            </div>
          </>
        ) : (
          <>
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>{tournament.game}</p>
            <h3 className={styles.title}>
              {phase === 'done' ? 'Бүртгэл амжилттай!' : 'Баг бүртгүүлэх'}
            </h3>
            {phase !== 'done' && <p className={styles.sub}>{tournament.title}</p>}
          </div>
          <button type="button" className={styles.closeBtn} aria-label="Хаах" onClick={onClose}>
            ✕
          </button>
        </div>

        {phase === 'loading' && <p className={styles.state}>Уншиж байна…</p>}

        {phase === 'done' && (
          <div className={styles.success}>
            <p>
              <b>{doneName}</b> баг <b>{tournament.title}</b> тэмцээнд бүртгэгдлээ.
              Тэмцээний хуваарь зарлагдахыг хүлээнэ үү.
            </p>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Хаах
            </button>
          </div>
        )}

        {phase === 'pick' && (
          <>
            <p className={styles.hint}>Баг сонгоно уу — дараах тэмцээнд шууд бүртгэгдэнэ.</p>
            <div className={styles.teamOptions} role="radiogroup" aria-label="Багууд">
              {teams.map((team) => (
                <label key={team.id} className={styles.teamOption}>
                  <input
                    type="radio"
                    name="register-team"
                    checked={selectedId === team.id}
                    onChange={() => setSelectedId(team.id)}
                  />
                  <span>
                    <b>{team.name}</b>
                    {team.leader_nickname && <i>{team.leader_nickname}</i>}
                  </span>
                </label>
              ))}
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className="btn btn-outline" onClick={() => setPhase('create')}>
                + Шинэ баг
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitPick}
                disabled={submitting}
              >
                {submitting ? 'Бүртгэж байна…' : 'Бүртгүүлэх'}
              </button>
            </div>
          </>
        )}

        {phase === 'create' && (
          <>
            {teams.length > 0 && (
              <button type="button" className={styles.backLink} onClick={() => setPhase('pick')}>
                ← Багууд руу буцах
              </button>
            )}
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
                        setChecked(null);
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
                        setChecked(null);
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
                onClick={submitCreate}
                disabled={submitting}
              >
                {submitting ? 'Бүртгэж байна…' : 'Баг нээж бүртгүүлэх'}
              </button>
            </div>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
