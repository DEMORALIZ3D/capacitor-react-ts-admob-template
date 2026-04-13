import { useEffect } from 'react';

export function useGameEvents(
  eventName: string,
  callback: (e: CustomEvent) => void
) {
  useEffect(() => {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [eventName, callback]);
}
