import { useSyncExternalStore } from 'react';

const subscribe = (listener: () => void) => {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
};

export const usePath = () => useSyncExternalStore(subscribe, () => window.location.pathname, () => '/');

export function navigate(path: string, options: { scroll?: boolean } = {}) {
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== path) window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'instant' });
}

export const useSearch = () => useSyncExternalStore(subscribe, () => window.location.search, () => '');
