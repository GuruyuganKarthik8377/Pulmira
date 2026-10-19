import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Activity, ArrowUpRight, LoaderCircle, X } from 'lucide-react';
import { AppLink } from './AppLink';

export function Brand({ light = false }: { light?: boolean }) {
  return <AppLink href="/" className={`pulmira-brand${light ? ' pulmira-brand-light' : ''}`} aria-label="Pulmira home">
    <span className="brand-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span>
    <span>Pulmira<span className="brand-dot">.</span></span>
  </AppLink>;
}

export function ArchiveLoader({ error, retry }: { error: string; retry: () => void }) {
  return <div className="workspace-loader" role={error ? 'alert' : 'status'}>
    {error ? <Activity size={30} /> : <LoaderCircle size={30} className="loading-spin" />}
    <h2>{error ? 'We couldn’t open the archive.' : 'Opening your workspace…'}</h2>
    <p>{error || 'Preparing the recorded observations and their source information.'}</p>
    {error && <button className="ui-button ui-button-primary" onClick={retry}>Try again <ArrowUpRight size={17} /></button>}
    {error && <AppLink href="/" className="text-link">Back to homepage</AppLink>}
  </div>;
}

export function Modal({ open, onClose, title, children, drawer = false }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
    return () => { if (dialog?.open) dialog.close(); };
  }, [open]);
  return <dialog ref={ref} className={`workspace-dialog${drawer ? ' workspace-drawer' : ''}`}
    aria-label={title} onCancel={onClose} onClose={() => { if (open) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}
