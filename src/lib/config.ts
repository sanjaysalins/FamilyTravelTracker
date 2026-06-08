// Config loader with fail-closed secrets (PRD §17, plan Blocker fix).
// In production, refuse to start if required secrets are missing — never boot insecure.

const isProd = import.meta.env.PROD;

function required(name: string): string {
  const v = process.env[name] ?? '';
  if (!v && isProd) {
    throw new Error(`Missing required env var ${name}. Refusing to start in production.`);
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const config = {
  isProd,
  appBaseUrl: optional('APP_BASE_URL', 'http://localhost:4321'),

  adminPasswordHash: required('ADMIN_PASSWORD_HASH'),
  sessionSecret: required('SESSION_SECRET'),
  sessionIdleTimeoutMin: Number(optional('SESSION_IDLE_TIMEOUT_MIN', '30')),
  loginRateLimitPerMin: Number(optional('LOGIN_RATELIMIT_PER_MIN', '5')),

  resendApiKey: optional('RESEND_API_KEY'),
  emailFrom: optional('EMAIL_FROM', 'Family Travel Coordinator <noreply@example.com>'),
  testEmailRecipient: optional('TEST_EMAIL_RECIPIENT'),

  timezone: optional('DEFAULT_TIMEZONE', 'Asia/Kolkata'),
  phoneRegion: optional('DEFAULT_PHONE_REGION', 'IN'),
  editTokenExpiryDays: Number(optional('EDIT_TOKEN_EXPIRY_DAYS', '30')),

  event: {
    town: optional('EVENT_TOWN', 'Bidar'),
    hub: optional('EVENT_HUB', 'Hyderabad'),
    start: optional('EVENT_START', '2026-10-16'),
    end: optional('EVENT_END', '2026-10-19'),
    birthdayName: optional('BIRTHDAY_NAME', 'Sybil'),
    birthdayAge: Number(optional('BIRTHDAY_AGE', '60')),
    organiserName: optional('ORGANISER_NAME'),
    organiserWhatsapp: optional('ORGANISER_WHATSAPP_E164'),
    eventCode: optional('EVENT_CODE'),
  },
};
