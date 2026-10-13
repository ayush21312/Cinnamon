import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Cinnamon',
  description: 'A multiplayer word association game for 2–8 players.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
