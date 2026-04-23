import {
  Edit, Shield, Key, Globe, Lock, Database, FileText, Search,
  BarChart3, BookOpen, FolderLock, Briefcase, Server,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type IntegrationStatus = 'connected' | 'available' | 'pending' | 'coming-soon';

export interface Integration {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  icon: LucideIcon;
  category: string;
}

export const INTEGRATIONS: Integration[] = [
  // Active Connections
  { id: 'docusign', name: 'DocuSign', description: 'Secure document execution for closing agreements', status: 'connected', icon: Edit, category: 'Legal' },
  { id: 'datasite', name: 'Datasite', description: 'Virtual data room sync for diligence binders and disclosures', status: 'connected', icon: FolderLock, category: 'VDR' },
  { id: 'plaid', name: 'Plaid', description: 'Bank verification and payment rails validation', status: 'connected', icon: Shield, category: 'Banking' },
  { id: 'aws', name: 'AWS S3', description: 'Document storage for deal artifacts and compliance archives', status: 'connected', icon: Lock, category: 'Storage' },

  // Pending Setup
  { id: 'imanage', name: 'iManage', description: 'Legal document management — contracts and matter sync', status: 'pending', icon: FileText, category: 'Legal DMS' },
  { id: 'complyadvantage', name: 'ComplyAdvantage', description: 'AML screening, sanctions checks, and fraud signals', status: 'pending', icon: Search, category: 'Compliance' },

  // Available to Connect
  { id: 'intralinks', name: 'Intralinks', description: 'Virtual data room and secure deal collaboration', status: 'available', icon: Server, category: 'VDR' },
  { id: 'dealcloud', name: 'DealCloud', description: 'Deal pipeline, relationships, and origination CRM', status: 'available', icon: Briefcase, category: 'CRM' },
  { id: 'stripe', name: 'Stripe', description: 'Escrow rails and payment orchestration', status: 'available', icon: Key, category: 'Payments' },
  { id: 'bloomberg', name: 'Bloomberg Terminal', description: 'Deal intelligence and financial reference data', status: 'available', icon: Globe, category: 'Data' },
  { id: 'salesforce', name: 'Salesforce', description: 'Law firm and PE deal pipeline tracking', status: 'available', icon: BarChart3, category: 'CRM' },
  { id: 'databricks', name: 'Databricks', description: 'Data infrastructure for analytics and AI', status: 'available', icon: Database, category: 'Data' },

  // Coming Soon
  { id: 'carta', name: 'Carta', description: 'Cap table management and equity sync', status: 'coming-soon', icon: Globe, category: 'Cap Table' },
  { id: 'netdocuments', name: 'NetDocuments', description: 'Cloud-based document management for law firms', status: 'coming-soon', icon: BookOpen, category: 'Legal DMS' },
];

export const STATUS_CONFIG: Record<IntegrationStatus, { label: string; className: string }> = {
  'connected': { label: 'Connected', className: 'border-validated/50 text-validated' },
  'available': { label: 'Available', className: 'border-accent/50 text-accent' },
  'pending': { label: 'Pending Setup', className: 'border-amber-400/50 text-amber-400' },
  'coming-soon': { label: 'Coming Soon', className: 'border-muted-foreground/50 text-muted-foreground' },
};
