import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, Eye, Server, Layers, KeyRound } from 'lucide-react';

const highlights = [
  { icon: Lock, label: 'Encryption', desc: 'In transit (TLS) and at rest for all stored data' },
  { icon: KeyRound, label: 'Access Controls', desc: 'Role-based with least-privilege principles' },
  { icon: Server, label: 'Secure Infrastructure', desc: 'Modern cloud architecture with high availability' },
  { icon: Eye, label: 'Continuous Monitoring', desc: 'Real-time logging, auditing & incident response' },
  { icon: Layers, label: 'Data Isolation', desc: 'Logical isolation per deal and organization' },
];

const sections = [
  { title: '1. Overview', content: 'PIVT, Inc. ("PIVT", "we", "our") is committed to maintaining the highest standards of data security and protection. Given the sensitive nature of financial transactions, legal documentation, and stakeholder information processed on the platform, we implement robust technical and organizational safeguards.' },
  { title: '2. Security Architecture', content: 'PIVT is built on secure, modern cloud infrastructure designed for high availability, resilience, and protection of sensitive data. Our architecture emphasizes isolation, encryption, and controlled access at every layer.' },
  { title: '3. Encryption', content: 'We implement strong encryption practices, including:', bullets: ['Encryption in transit using HTTPS/TLS', 'Encryption at rest for stored data', 'Secure key management practices'] },
  { title: '4. Access Controls', content: 'We enforce strict access control measures:', bullets: ['Role-based access controls (RBAC)', 'Least-privilege access principles', 'Authentication and session management safeguards'] },
  { title: '5. Data Isolation', content: 'Customer data is logically isolated to ensure that access is restricted to authorized users within each deal or organization context.' },
  { title: '6. Monitoring & Logging', content: 'We maintain continuous monitoring and logging systems to:', bullets: ['Detect unauthorized access attempts', 'Track system activity', 'Support auditing and incident response'] },
  { title: '7. Incident Response', content: 'PIVT maintains incident response procedures to address potential security events, including investigation, containment, and remediation. Users will be notified of material incidents where required by law.' },
  { title: '8. Third-Party Security', content: 'We work with reputable third-party providers for infrastructure and services. These providers are evaluated for their security standards and compliance practices.' },
  { title: '9. Data Retention & Deletion', content: 'We retain data only as necessary for operational, legal, and compliance purposes. Secure deletion processes are applied when data is no longer required.' },
  { title: '10. Compliance & Best Practices', content: 'PIVT aligns with industry best practices for data protection and continuously evaluates its security posture. We aim to meet enterprise-grade expectations for handling sensitive financial and transactional data.' },
  { title: '11. User Responsibilities', content: 'Users are responsible for:', bullets: ['Maintaining secure account credentials', 'Ensuring proper authorization of actions within their organization', 'Verifying transaction details independently'] },
  { title: '12. Contact', content: 'For security-related inquiries or to report vulnerabilities:', afterNote: 'PIVT, Inc.\nEmail: security@pivttech.ai' },
];

const DataSecurityPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to PIVT
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--pivt-gradient-primary)' }}>
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Security & Data Protection</h1>
            <p className="text-sm text-muted-foreground mt-0.5">PIVT, Inc. · Last updated: March 19, 2026</p>
          </div>
        </div>

        <div className="mb-10 p-4 rounded-lg border border-border bg-muted/20">
          <p className="text-sm text-muted-foreground leading-relaxed">
            PIVT is designed to protect sensitive transaction data with enterprise-grade security architecture.
          </p>
        </div>

        {/* Security highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-14">
          {highlights.map((h) => (
            <div key={h.label} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-accent/10">
                <h.icon className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{h.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Full document sections */}
        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.content}</p>
              {s.bullets && (
                <ul className="mt-2 space-y-1 list-disc pl-5 text-sm text-muted-foreground">
                  {s.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
              {s.afterNote && (
                <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{s.afterNote}</p>
              )}
            </section>
          ))}
        </div>

        <div className="mt-16 pt-6 border-t border-border flex items-center gap-4 text-xs text-muted-foreground/60">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link to="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
        </div>
      </div>
    </div>
  );
};

export default DataSecurityPage;
