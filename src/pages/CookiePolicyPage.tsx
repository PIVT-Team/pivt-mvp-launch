import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CookiePolicyPage: React.FC = () => {
  const openPrefs = () => window.dispatchEvent(new CustomEvent('pivt:open-cookie-prefs'));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to PIVT
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--pivt-gradient-primary)' }}>
            <Cookie className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Cookie Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: March 19, 2026</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-foreground">What Are Cookies</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Cookies are small text files stored on your device when you visit our platform. They help us provide essential functionality, remember your preferences, and understand how you use PIVT so we can improve your experience.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Cookies We Use</h2>

            <div className="mt-4 space-y-4">
              <div className="p-4 rounded-lg border border-border bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground">Essential Cookies</h3>
                <p className="text-xs text-muted-foreground mt-1">Always active — cannot be disabled</p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Required for authentication, session management, security protections (CSRF tokens), and core platform functionality. Without these cookies, PIVT cannot operate securely.
                </p>
                <div className="mt-2 text-xs text-muted-foreground/70">
                  Examples: session tokens, authentication state, CSRF protection, consent preferences
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground">Analytics Cookies</h3>
                <p className="text-xs text-muted-foreground mt-1">Optional — requires consent</p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Help us understand how users interact with PIVT, which features are most used, and where we can improve the experience. Data is aggregated and anonymized.
                </p>
                <div className="mt-2 text-xs text-muted-foreground/70">
                  Examples: page views, feature usage, session duration
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground">Functional Cookies</h3>
                <p className="text-xs text-muted-foreground mt-1">Optional — requires consent</p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Enable enhanced features and third-party integrations such as KYC/KYB verification providers (e.g., Persona), document processing services, and communication tools.
                </p>
                <div className="mt-2 text-xs text-muted-foreground/70">
                  Examples: Persona identity verification, third-party API integrations
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Managing Your Preferences</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You can change your cookie preferences at any time by clicking the button below or using the "Cookie Preferences" link in the platform footer.
            </p>
            <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={openPrefs}>
              Manage Cookie Preferences
            </Button>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Your Rights</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Under GDPR (EU) and CCPA (California), you have the right to:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc pl-5">
              <li>Know what data is collected and how it is used</li>
              <li>Opt out of non-essential cookies at any time</li>
              <li>Request deletion of your personal data</li>
              <li>Withdraw consent previously given</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Contact</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For questions about this policy or your data, contact us at{' '}
              <a href="mailto:privacy@pivt.com" className="text-accent hover:underline">privacy@pivt.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicyPage;
