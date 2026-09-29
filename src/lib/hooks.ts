import { useEffect, useState } from 'react';
import { isoToday } from './utils';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** The local date, kept current: rolls over at midnight and re-checks when a sleeping tab wakes up. */
export function useToday() {
  const [today, setToday] = useState(isoToday);
  useEffect(() => {
    let timeout = 0;
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timeout = window.setTimeout(() => { setToday(isoToday()); schedule(); }, nextMidnight.getTime() - now.getTime());
    };
    const sync = () => setToday(isoToday());
    schedule();
    document.addEventListener('visibilitychange', sync);
    return () => { window.clearTimeout(timeout); document.removeEventListener('visibilitychange', sync); };
  }, []);
  return today;
}
