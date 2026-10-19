import type { AnchorHTMLAttributes } from 'react';
import { navigate } from '../lib/navigation';

export function AppLink({ href = '/', onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank') return;
    if (!href.startsWith('/') || href.includes('#')) return;
    event.preventDefault();
    navigate(href);
  }}>{children}</a>;
}
