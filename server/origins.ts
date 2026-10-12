import publicSites from './site-origins.json';

// Keep the public website origin with the deployment configuration so a copied
// or stale dashboard value cannot prevent this site's clients from connecting.
// This is an exact allowlist; unrelated browser origins remain rejected.
export function gameOrigins(configured = 'http://localhost:3000'): string[] {
  return [
    ...new Set(
      [...configured.split(','), ...publicSites]
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean),
    ),
  ];
}
