import { useEffect, useState } from 'react';

const BREAKPOINTS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export function useBreakpoint(size: keyof typeof BREAKPOINTS) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const minWidth = BREAKPOINTS[size];
    const query = window.matchMedia(`(min-width: ${minWidth}px)`);
    const listener = () => setMatches(query.matches);
    listener();
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, [size]);

  return matches;
}
