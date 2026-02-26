export const ISSUE_CATEGORIES = [
  { value: 'bug', label: 'Bug / Something Not Working' },
  { value: 'data_discrepancy', label: 'Data Discrepancy' },
  { value: 'ai_scan', label: 'AI Scan Question' },
  { value: 'reporting', label: 'Reporting Issue' },
  { value: 'permission', label: 'Permission / Access Issue' },
  { value: 'performance', label: 'Performance Issue' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
] as const;

export const AFFECTED_AREAS = [
  { value: 'deals', label: 'Deals' },
  { value: 'intelligence_map', label: 'Intelligence Map' },
  { value: 'ai_scan', label: 'AI Scan' },
  { value: 'reports', label: 'Reports' },
  { value: 'audit_log', label: 'Audit Log' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'other', label: 'Other' },
] as const;

export const IMPACT_LEVELS = [
  { value: 'low', label: 'Low', description: 'Minor inconvenience' },
  { value: 'medium', label: 'Medium', description: 'Blocking workflow' },
  { value: 'high', label: 'High', description: 'Critical / time sensitive' },
] as const;

export interface HelpArticle {
  id: string;
  question: string;
  answer: string;
}

export interface HelpCategory {
  id: string;
  label: string;
  icon: string;
  articles: HelpArticle[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'account',
    label: 'Account & Access',
    icon: '🔑',
    articles: [
      { id: 'a1', question: 'How do I reset my password?', answer: 'Navigate to Settings → Security and click "Change Password". You will receive a verification email to confirm the change.' },
      { id: 'a2', question: 'How do I invite team members?', answer: 'Go to Settings → Team Management and click "Invite Member". Enter their email and assign a role. They will receive an invitation to join your workspace.' },
      { id: 'a3', question: 'What roles and permissions exist?', answer: 'PIVT supports Admin (full access), PE Associate, Buyer Counsel, Seller Counsel, and Operating Partner roles. Each role has tailored access to deal data and intelligence features.' },
    ],
  },
  {
    id: 'deals',
    label: 'Deal Management',
    icon: '📋',
    articles: [
      { id: 'd1', question: 'How do I create a new deal?', answer: 'Click "New Deal" from the Deals section. The Deal Wizard will guide you through account setup, KYC verification, deal basics, parties, documentation, validation, and approvals.' },
      { id: 'd2', question: 'What do deal statuses mean?', answer: 'Draft: initial setup. Active: in progress. Closing: approaching execution. Closed: deal completed. At Risk: issues detected that may delay closing.' },
      { id: 'd3', question: 'How do I track deal progress?', answer: 'Use the Deal Workspace to see workflow completion, readiness percentage, and section-by-section status. The Timeline view shows chronological activity.' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence Map',
    icon: '🧠',
    articles: [
      { id: 'i1', question: 'What is the Intelligence Map?', answer: 'The Intelligence Map visualizes relationships between deal entities — stakeholders, documents, payments, and compliance items — as an interactive network graph.' },
      { id: 'i2', question: 'How does the What-If simulator work?', answer: 'The What-If tool lets you simulate structural changes (e.g., removing a stakeholder, changing allocation) and see how they affect payouts and compliance in real-time.' },
      { id: 'i3', question: 'What do risk flags mean?', answer: 'Risk flags highlight potential issues: missing KYC, unverified wire instructions, allocation discrepancies, or overdue approvals. Click any flag for details.' },
    ],
  },
  {
    id: 'ai_scan',
    label: 'AI Scan',
    icon: '⚡',
    articles: [
      { id: 'ai1', question: 'What does AI Deal Scan do?', answer: 'AI Deal Scan analyzes your deal data to detect risks, missing items, bottlenecks, and compliance gaps. It provides prioritized action items with severity ratings.' },
      { id: 'ai2', question: 'Can I scan a single deal?', answer: 'Yes. Use the Scope dropdown at the top of AI Deal Scan to select a specific deal instead of running a portfolio-wide scan.' },
      { id: 'ai3', question: 'How often should I run scans?', answer: 'We recommend running scans before key milestones: pre-signing, pre-closing, and after significant data changes. Scans use current data and reflect real-time state.' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & Exports',
    icon: '📊',
    articles: [
      { id: 'r1', question: 'What reports can I generate?', answer: 'PIVT supports Deal Summary, Closing Readiness, Cap Table, Waterfall, Compliance, and Audit reports. Reports can be exported as PDF.' },
      { id: 'r2', question: 'How do I share reports?', answer: 'Generate a report, then use the Share button to send a secure link to stakeholders. Recipients must have appropriate access permissions.' },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance & KYC',
    icon: '🛡️',
    articles: [
      { id: 'c1', question: 'What KYC documents are required?', answer: 'Individual KYC requires government ID, proof of address, and bank verification. Entity KYB requires registration documents, ownership structure, and authorized signatory details.' },
      { id: 'c2', question: 'How long does KYC review take?', answer: 'Standard review takes 1–3 business days. Expedited review is available for time-sensitive deals. Status updates are shown in your Verification section.' },
    ],
  },
  {
    id: 'technical',
    label: 'Technical Issues',
    icon: '🔧',
    articles: [
      { id: 't1', question: 'The page is loading slowly', answer: 'Try clearing your browser cache, disabling extensions, or switching to a supported browser (Chrome, Edge, Safari). If the issue persists, escalate to our technical team.' },
      { id: 't2', question: 'I see an error message', answer: 'Take a screenshot of the error and note what action triggered it. Use the Escalate to Support option to submit a detailed ticket with auto-captured diagnostics.' },
    ],
  },
];
