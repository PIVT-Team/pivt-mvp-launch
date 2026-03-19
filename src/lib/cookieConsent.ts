const CONSENT_KEY = 'pivt-cookie-consent';

export type CookieCategory = 'essential' | 'analytics' | 'functional';

export interface CookieConsent {
  essential: boolean; // always true
  analytics: boolean;
  functional: boolean;
  timestamp: string;
}

const DEFAULT_CONSENT: CookieConsent = {
  essential: true,
  analytics: false,
  functional: false,
  timestamp: '',
};

export function getConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

export function saveConsent(consent: Omit<CookieConsent, 'essential' | 'timestamp'>): CookieConsent {
  const full: CookieConsent = {
    ...consent,
    essential: true,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(full));
  window.dispatchEvent(new CustomEvent('pivt:consent-updated', { detail: full }));
  return full;
}

export function acceptAll(): CookieConsent {
  return saveConsent({ analytics: true, functional: true });
}

export function rejectNonEssential(): CookieConsent {
  return saveConsent({ analytics: false, functional: false });
}

export function hasConsented(): boolean {
  return getConsent() !== null;
}

export function isAllowed(category: CookieCategory): boolean {
  if (category === 'essential') return true;
  const consent = getConsent();
  if (!consent) return false;
  return consent[category] ?? false;
}
