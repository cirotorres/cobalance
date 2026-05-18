import { useMemo } from 'react';

export function useMonthsAndParticipants(finances, participants) {
  const months = useMemo(() => {
    const set = new Set();
    finances.forEach((f) => {
      if (f.transaction_date) {
        set.add(f.transaction_date.slice(0, 7));
      }
    });
    return [...set].sort();
  }, [finances]);

  const days = useMemo(() => {
    const set = new Set();
    finances.forEach((f) => {
      if (f.transaction_date) set.add(f.transaction_date);
    });
    return set;
  }, [finances]);

  const { availableParticipants, hasNullParticipant } = useMemo(() => {
    const usedIds = new Set();
    let hasNull = false;
    finances.forEach((f) => {
      if (f.participant_id === null || f.participant_id === undefined) {
        hasNull = true;
      } else {
        usedIds.add(f.participant_id);
      }
    });
    const filtered = participants.filter((p) => usedIds.has(p.id));
    return { availableParticipants: filtered, hasNullParticipant: hasNull };
  }, [finances, participants]);

  return { months, days, availableParticipants, hasNullParticipant };
}
