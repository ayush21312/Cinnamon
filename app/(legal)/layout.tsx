import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="legal-page">
      <a href="/" className="legal-brand">
        Cinnamon
      </a>
      <article>{children}</article>
      <footer className="legal-footer">
        <a href="/">Play</a>
        <span>|</span>
        <a href="/contact">Contact</a>
        <span>|</span>
        <a href="/privacy">Privacy</a>
        <span>|</span>
        <a href="/terms">Terms</a>
      </footer>
    </main>
  );
}
