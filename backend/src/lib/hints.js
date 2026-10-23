/** Explains the usual Supabase connection failures in plain language. */
export function supabaseHint(connectionString) {
  const match = String(connectionString || '').match(/db\.([a-z0-9]+)\.supabase\.co/i);
  if (!match) return null;
  const ref = match[1];
  return [
    'Supabase direct hosts (db.<ref>.supabase.co) are IPv6-only. If this machine has no IPv6 route, use the pooler URI:',
    `  postgresql://postgres.${ref}:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`,
    'Copy the exact host and user from Supabase -> Project settings -> Database -> Connection string (Session pooler).',
  ].join('\n');
}

export const isIpv6Only = ({ ipv4 = [], ipv6 = [] } = {}) => ipv4.length === 0 && ipv6.length > 0;
