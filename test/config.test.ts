// Integration tests for the fail-closed config loader (src/lib/config.ts).
// config.ts binds `isProd` and the `config` object at module load, so each scenario
// resets modules and re-imports with the env it needs.

import { afterEach, describe, expect, it, vi } from 'vitest';

const REQUIRED = {
  ADMIN_PASSWORD_HASH: '$2a$10$testhashtesthashtesthashtesthashtesthashtesthashtesth',
  SESSION_SECRET: 'test-session-secret',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadConfig() {
  vi.resetModules();
  return (await import('../src/lib/config')).config;
}

describe('production (fail-closed)', () => {
  it('throws when a required secret is missing', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('ADMIN_PASSWORD_HASH', '');
    vi.stubEnv('SESSION_SECRET', '');
    await expect(loadConfig()).rejects.toThrow(/Missing required env var/);
  });

  it('boots when all required secrets are present', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('ADMIN_PASSWORD_HASH', REQUIRED.ADMIN_PASSWORD_HASH);
    vi.stubEnv('SESSION_SECRET', REQUIRED.SESSION_SECRET);
    const config = await loadConfig();
    expect(config.adminPasswordHash).toBe(REQUIRED.ADMIN_PASSWORD_HASH);
    expect(config.sessionSecret).toBe(REQUIRED.SESSION_SECRET);
    expect(config.isProd).toBe(true);
  });
});

describe('development (lenient)', () => {
  it('does not throw on missing secrets outside production', async () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('ADMIN_PASSWORD_HASH', '');
    vi.stubEnv('SESSION_SECRET', '');
    const config = await loadConfig();
    expect(config.adminPasswordHash).toBe('');
    expect(config.isProd).toBe(false);
  });
});

describe('defaults and overrides', () => {
  it('applies event + locale defaults when unset', async () => {
    vi.stubEnv('PROD', false);
    const config = await loadConfig();
    expect(config.timezone).toBe('Asia/Kolkata');
    expect(config.phoneRegion).toBe('IN');
    expect(config.event.town).toBe('Bidar');
    expect(config.event.hub).toBe('Hyderabad');
    expect(config.event.birthdayName).toBe('Sybil');
    expect(config.event.birthdayAge).toBe(60);
    expect(config.appBaseUrl).toBe('http://localhost:4321');
    expect(config.sessionIdleTimeoutMin).toBe(30);
  });

  it('reads overrides from the environment', async () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('APP_BASE_URL', 'https://bidarplan.netlify.app');
    vi.stubEnv('SESSION_IDLE_TIMEOUT_MIN', '15');
    vi.stubEnv('EVENT_TOWN', 'Gulbarga');
    const config = await loadConfig();
    expect(config.appBaseUrl).toBe('https://bidarplan.netlify.app');
    expect(config.sessionIdleTimeoutMin).toBe(15);
    expect(config.event.town).toBe('Gulbarga');
  });
});
