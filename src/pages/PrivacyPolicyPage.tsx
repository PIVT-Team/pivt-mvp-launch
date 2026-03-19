import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const sections = [
  {
    title: '1. Introduction',
    content: `PIVT, Inc. ("PIVT", "we", "our", or "us") is committed to protecting your privacy. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you use our platform, products, and services (collectively, the "Services"). By using the Services, you agree to the terms of this Privacy Policy.`,
  },
  {
    title: '2. Scope',
    content: `This Privacy Policy applies to information collected through the PIVT platform, including interactions with Newton AI, and any related services, communications, or integrations.`,
  },
  {
    title: '3. Information We Collect',
    content: 'We may collect the following categories of information:',
    list: [
      { label: 'Personal Information', text: 'Name, email address, job title, company name, and contact details.' },
      { label: 'Transaction & Deal Data', text: 'Deal documents, transaction metadata, agreements, stakeholder details, and communications.' },
      { label: 'Financial Information', text: 'Wire instructions, account-related data, and funds flow details.' },
      { label: 'Verification Data', text: 'KYC/KYB documentation, identity verification information, and compliance-related materials.' },
      { label: 'Usage Data', text: 'System logs, device information, IP address, browser type, and interactions with the platform and Newton AI.' },
      { label: 'Cookies and Tracking Technologies', text: 'We may use cookies and similar technologies to enhance user experience and analyze usage.' },
    ],
  },
  {
    title: '4. How We Use Information',
    content: 'We use collected information to:',
    bullets: [
      'Provide, operate, and maintain the Services',
      'Facilitate transaction workflows and deal execution',
      'Detect discrepancies in financial instructions',
      'Provide AI-assisted insights and automation via Newton',
      'Improve performance, security, and user experience',
      'Comply with legal and regulatory obligations',
    ],
  },
  {
    title: '5. Legal Basis for Processing',
    content: 'We process personal data based on:',
    bullets: [
      'Performance of a contract',
      'Legitimate business interests',
      'Compliance with legal obligations',
      'User consent where required',
    ],
  },
  {
    title: '6. Data Sharing and Disclosure',
    content: 'We may share information with:',
    bullets: [
      'Financial institutions and payment partners',
      'Identity verification and compliance providers',
      'Cloud infrastructure providers',
      'Professional advisors (legal, financial)',
      'Law enforcement or regulatory authorities when required',
    ],
    afterNote: 'We do not sell personal data.',
  },
  {
    title: '7. Data Security',
    content: 'We implement industry-standard security measures, including:',
    bullets: [
      'Encryption in transit and at rest',
      'Role-based access controls',
      'Secure infrastructure and monitoring',
      'Logging and audit trails',
    ],
  },
  {
    title: '8. Data Retention',
    content: 'We retain personal data only as long as necessary to fulfill the purposes for which it was collected, or as required by law.',
  },
  {
    title: '9. International Data Transfers',
    content: 'Your information may be transferred to and processed in jurisdictions outside your country of residence. We take appropriate safeguards to ensure data protection in accordance with applicable laws.',
  },
  {
    title: '10. Your Rights',
    content: 'Depending on your location, you may have rights to:',
    bullets: [
      'Access your personal data',
      'Correct inaccurate data',
      'Request deletion of your data',
      'Restrict or object to processing',
      'Request data portability',
    ],
    afterNote: 'To exercise these rights, contact us at privacy@pivttech.ai.',
  },
  {
    title: '11. Third-Party Services',
    content: 'Our Services may integrate with third-party providers. We are not responsible for the privacy practices of third parties, and you should review their policies separately.',
  },
  {
    title: '12. Children\'s Privacy',
    content: 'The Services are not intended for individuals under the age of 18. We do not knowingly collect personal data from children.',
  },
  {
    title: '13. Changes to This Policy',
    content: 'We may update this Privacy Policy from time to time. We will notify users of material changes by updating the "Last Updated" date or through other communications.',
  },
  {
    title: '14. Contact Information',
    content: 'If you have any questions about this Privacy Policy, please contact:',
    afterNote: 'PIVT, Inc.\nEmail: privacy@pivttech.ai',
  },
];

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to PIVT
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--pivt-gradient-primary)' }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mt-0.5">PIVT, Inc. · Last updated: March 19, 2026</p>
          </div>
        </div>

        {/* Trust signal */}
        <div className="mb-10 p-4 rounded-lg border border-border bg-muted/20">
          <p className="text-sm text-muted-foreground leading-relaxed">
            PIVT is committed to protecting your data with enterprise-grade security and privacy standards.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{section.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{section.content}</p>

              {section.list && (
                <div className="mt-3 space-y-2">
                  {section.list.map((item) => (
                    <div key={item.label} className="text-sm text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground/80">{item.label}:</span> {item.text}
                    </div>
                  ))}
                </div>
              )}

              {section.bullets && (
                <ul className="mt-2 space-y-1 list-disc pl-5 text-sm text-muted-foreground">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}

              {section.afterNote && (
                <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{section.afterNote}</p>
              )}
            </section>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-16 pt-6 border-t border-border flex items-center gap-4 text-xs text-muted-foreground/60">
          <Link to="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
          <span>·</span>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('pivt:open-cookie-prefs'))}
            className="hover:text-foreground transition-colors"
          >
            Cookie Preferences
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
