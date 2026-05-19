import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

// Data Processing Agreement — the standard B2B contract that customers'
// legal teams expect when they sign up for a SaaS that handles personal /
// transactional data. Mirrors the structure of GDPR Art. 28 (and the
// California / UK analogues) without trying to be a bespoke negotiated
// contract. Customers who need a signed paper version can request one via
// the contact email below.

const sections = [
  {
    title: '1. Background and Purpose',
    content: `This Data Processing Agreement ("DPA") forms part of the agreement between PIVT, Inc. ("Processor", "PIVT") and the Customer ("Controller") for the provision of the PIVT platform and related services (the "Services"). It governs the processing of personal data carried out by PIVT on behalf of the Customer in connection with the Services.`,
  },
  {
    title: '2. Definitions',
    content: 'Capitalized terms used but not defined in this DPA have the meaning given in the Customer Agreement. The following terms have the meanings set out below:',
    list: [
      { label: '"Personal Data"', text: 'any information relating to an identified or identifiable natural person processed by PIVT on behalf of the Customer in connection with the Services.' },
      { label: '"Data Protection Laws"', text: 'all applicable laws and regulations relating to the processing of Personal Data, including the EU General Data Protection Regulation (GDPR), the UK GDPR, and the California Consumer Privacy Act (CCPA) as amended.' },
      { label: '"Sub-processor"', text: 'a third party engaged by PIVT to process Personal Data on behalf of the Customer in the course of providing the Services.' },
      { label: '"Security Incident"', text: 'a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data.' },
    ],
  },
  {
    title: '3. Roles and Responsibilities',
    content: 'The Customer is the Controller of Personal Data submitted to the Services. PIVT acts as a Processor and processes Personal Data only on documented instructions from the Customer, including with regard to transfers of Personal Data to a third country, unless required to do so by applicable law.',
  },
  {
    title: '4. Scope of Processing',
    content: 'The subject matter, duration, nature, and purpose of the processing, the types of Personal Data, and the categories of data subjects are set out below:',
    list: [
      { label: 'Subject matter', text: 'Provision of the PIVT M&A deal-management and payments-execution platform.' },
      { label: 'Duration', text: 'For the term of the Customer Agreement and any post-termination retention period required to meet legal or audit obligations.' },
      { label: 'Nature and purpose', text: 'Storage, processing, and transmission of deal data, transaction metadata, identity-verification records, and related communications.' },
      { label: 'Types of Personal Data', text: 'Names, contact details, identity documents (KYC/KYB), financial-account references (masked), and audit-trail metadata.' },
      { label: 'Categories of data subjects', text: 'Customer employees and contractors, deal counterparties, beneficial owners, and other transaction participants identified by the Customer.' },
    ],
  },
  {
    title: '5. Customer Instructions',
    content: 'PIVT will process Personal Data only on the documented instructions of the Customer, which include the Customer Agreement, this DPA, and any in-product configuration. PIVT will notify the Customer if, in its opinion, an instruction infringes applicable Data Protection Laws.',
  },
  {
    title: '6. Confidentiality',
    content: 'PIVT will ensure that personnel authorized to process Personal Data are subject to appropriate confidentiality obligations (either contractual or statutory).',
  },
  {
    title: '7. Security Measures',
    content: 'PIVT implements technical and organizational measures appropriate to the risk presented by processing Personal Data, including:',
    bullets: [
      'Encryption of Personal Data in transit (TLS 1.2+) and at rest',
      'Role-based access control with least-privilege principles',
      'Tamper-evident audit logging of access to Personal Data',
      'Regular security testing and dependency monitoring',
      'Documented incident-response procedures',
      'Workforce security training appropriate to the role',
    ],
  },
  {
    title: '8. Sub-processors',
    content: 'The Customer authorizes PIVT to engage Sub-processors to provide the Services, subject to PIVT remaining responsible for their performance. The current list of Sub-processors is maintained at the PIVT trust center and includes (without limitation): Supabase (database and storage), Resend (transactional email), Lovable AI Gateway (AI model access), and standard cloud-infrastructure providers. PIVT will provide the Customer with reasonable prior notice of any intended addition or replacement of Sub-processors, and the Customer may object on reasonable data-protection grounds.',
  },
  {
    title: '9. Data Subject Rights',
    content: 'PIVT will assist the Customer, taking into account the nature of the processing, by appropriate technical and organizational measures, in fulfilling the Customer\'s obligations to respond to requests by data subjects exercising their rights under applicable Data Protection Laws (including rights of access, rectification, erasure, restriction, portability, and objection). Where PIVT receives such a request directly, it will promptly notify the Customer and will not respond directly except as instructed by the Customer or required by law.',
  },
  {
    title: '10. Security Incidents',
    content: 'PIVT will notify the Customer without undue delay (and in any event within 72 hours of becoming aware) of any Security Incident affecting the Customer\'s Personal Data. The notification will include the information reasonably required to allow the Customer to meet its own incident-notification obligations, including the nature of the incident, the categories and approximate number of data subjects and records concerned, the likely consequences, and the measures taken or proposed to address the incident.',
  },
  {
    title: '11. Data Protection Impact Assessments',
    content: 'PIVT will provide reasonable assistance to the Customer in carrying out data-protection impact assessments and prior consultations with supervisory authorities where required by applicable Data Protection Laws.',
  },
  {
    title: '12. International Transfers',
    content: 'Where PIVT transfers Personal Data outside the originating jurisdiction in the course of providing the Services, it will do so on the basis of an appropriate transfer mechanism (including, where applicable, the EU Standard Contractual Clauses, the UK International Data Transfer Addendum, or equivalent measures). The parties agree that the EU SCCs (Module Two: Controller to Processor) are incorporated into this DPA by reference for any in-scope transfer.',
  },
  {
    title: '13. Audits and Information Rights',
    content: 'PIVT will make available to the Customer the information reasonably necessary to demonstrate compliance with this DPA. On reasonable prior written notice (and no more than once per calendar year, unless required by a supervisory authority), PIVT will permit and contribute to audits conducted by the Customer or a mutually agreed independent auditor, subject to reasonable confidentiality and security requirements.',
  },
  {
    title: '14. Return and Deletion of Personal Data',
    content: 'On termination of the Customer Agreement, the Customer may export its Personal Data through the in-product export tooling for a period of 30 days, after which PIVT will, at the Customer\'s choice, return or delete the Personal Data, except where retention is required by applicable law or for legitimate audit purposes (in which case the retained data will continue to be protected in accordance with this DPA).',
  },
  {
    title: '15. Liability',
    content: 'The liability of each party under or in connection with this DPA is subject to the limitations and exclusions of liability set out in the Customer Agreement.',
  },
  {
    title: '16. Order of Precedence',
    content: 'In the event of a conflict between this DPA and the Customer Agreement, this DPA prevails with respect to the processing of Personal Data. Nothing in this DPA reduces a party\'s obligations under applicable Data Protection Laws.',
  },
  {
    title: '17. Contact',
    content: 'Requests under this DPA (including for the current Sub-processor list, a signed counterpart of this DPA, or the EU SCCs) may be sent to:',
    afterNote: 'PIVT, Inc.\nData Protection Officer\nEmail: privacy@pivttech.ai',
  },
];

const DPAPage: React.FC = () => {
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
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Data Processing Agreement</h1>
            <p className="text-sm text-muted-foreground mt-0.5">PIVT, Inc. · Effective: May 18, 2026</p>
          </div>
        </div>

        {/* Trust signal */}
        <div className="mb-10 p-4 rounded-lg border border-border bg-muted/20">
          <p className="text-sm text-muted-foreground leading-relaxed">
            This Data Processing Agreement (DPA) supplements the PIVT Customer Agreement and governs how PIVT processes
            personal data on behalf of customers. It mirrors the structure expected by enterprise procurement teams (GDPR
            Art. 28, UK GDPR, CCPA). Customers who require a signed counterpart can request one at <a href="mailto:privacy@pivttech.ai" className="text-accent hover:underline">privacy@pivttech.ai</a>.
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
        <div className="mt-16 pt-6 border-t border-border flex items-center gap-4 text-xs text-muted-foreground/60 flex-wrap">
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link to="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
          <span>·</span>
          <Link to="/security" className="hover:text-foreground transition-colors">Data Security</Link>
        </div>
      </div>
    </div>
  );
};

export default DPAPage;
