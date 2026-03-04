/**
 * TaxFormsCover — Tax form compliance tracking for deal recipients
 * Tracks W-9 / W-8BEN / W-8BEN-E requirements and blocks execution when missing
 */
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  Shield, ShieldCheck, ShieldAlert, AlertTriangle, Upload,
  CheckCircle2, Clock, FileText, Info, X, Eye
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';

// ── Types ──
interface TaxRecipient {
  id: string;
  name: string;
  recipientType: 'individual' | 'entity';
  taxResidency: 'us' | 'non_us';
  email: string | null;
}

interface TaxForm {
  id: string;
  recipientId: string;
  formType: 'W9' | 'W8BEN' | 'W8BENE';
  status: 'required' | 'received' | 'verified' | 'expired';
  tinLast4: string | null;
  signedDate: string | null;
  expiresOn: string | null;
  notes: string | null;
}

// ── Helpers ──
function requiredForm(taxResidency: string, recipientType: string): 'W9' | 'W8BEN' | 'W8BENE' {
  if (taxResidency === 'us') return 'W9';
  return recipientType === 'individual' ? 'W8BEN' : 'W8BENE';
}

function formDisplayName(ft: string): string {
  if (ft === 'W8BEN') return 'W-8BEN';
  if (ft === 'W8BENE') return 'W-8BEN-E';
  return 'W-9';
}

function isSatisfied(form: TaxForm | undefined): boolean {
  if (!form) return false;
  if (!['received', 'verified'].includes(form.status)) return false;
  if (form.expiresOn && form.expiresOn < new Date().toISOString().slice(0, 10)) return false;
  return true;
}

// ── Mock Demo Data ──
const DEMO_RECIPIENTS: TaxRecipient[] = [
  { id: 'tr-001', name: 'David Patel', recipientType: 'individual', taxResidency: 'us', email: 'david.patel@example.com' },
  { id: 'tr-002', name: 'Emily Chen', recipientType: 'individual', taxResidency: 'us', email: 'emily.chen@example.com' },
  { id: 'tr-003', name: 'Seed Fund I LP', recipientType: 'entity', taxResidency: 'us', email: 'ops@seedfund.com' },
  { id: 'tr-004', name: 'Angel Investors', recipientType: 'entity', taxResidency: 'us', email: null },
  { id: 'tr-005', name: 'Employee Option Pool', recipientType: 'entity', taxResidency: 'us', email: null },
  { id: 'tr-006', name: 'Cooley LLP', recipientType: 'entity', taxResidency: 'us', email: 'closing@cooley.com' },
  { id: 'tr-007', name: 'WSGR', recipientType: 'entity', taxResidency: 'us', email: 'closings@wsgr.com' },
];

const DEMO_FORMS: TaxForm[] = [
  // Emily, Angel Investors, Employee Option Pool, Cooley, WSGR all have verified W-9s
  { id: 'tf-002', recipientId: 'tr-002', formType: 'W9', status: 'verified', tinLast4: '4821', signedDate: '2026-01-10', expiresOn: null, notes: null },
  { id: 'tf-004', recipientId: 'tr-004', formType: 'W9', status: 'verified', tinLast4: '7733', signedDate: '2026-01-12', expiresOn: null, notes: null },
  { id: 'tf-005', recipientId: 'tr-005', formType: 'W9', status: 'verified', tinLast4: '9102', signedDate: '2026-01-08', expiresOn: null, notes: null },
  { id: 'tf-006', recipientId: 'tr-006', formType: 'W9', status: 'verified', tinLast4: '3456', signedDate: '2026-01-15', expiresOn: null, notes: null },
  { id: 'tf-007', recipientId: 'tr-007', formType: 'W9', status: 'verified', tinLast4: '2198', signedDate: '2026-01-14', expiresOn: null, notes: null },
  // David Patel and Seed Fund I LP are MISSING — blockers
];

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  required: { color: 'text-destructive', icon: <AlertTriangle className="w-3 h-3" />, label: 'Missing' },
  received: { color: 'text-accent', icon: <Clock className="w-3 h-3" />, label: 'Received' },
  verified: { color: 'text-validated', icon: <ShieldCheck className="w-3 h-3" />, label: 'Verified' },
  expired: { color: 'text-discrepancy', icon: <ShieldAlert className="w-3 h-3" />, label: 'Expired' },
};

export const TaxFormsTab: React.FC = () => {
  const [recipients, setRecipients] = useState(DEMO_RECIPIENTS);
  const [forms, setForms] = useState(DEMO_FORMS);
  const [uploadModal, setUploadModal] = useState<{ recipientId: string; formType: string } | null>(null);
  const [tinInput, setTinInput] = useState('');

  const totalRecipients = recipients.length;
  const satisfiedCount = recipients.filter(r => {
    const rf = requiredForm(r.taxResidency, r.recipientType);
    const form = forms.find(f => f.recipientId === r.id && f.formType === rf);
    return isSatisfied(form);
  }).length;
  const missingCount = totalRecipients - satisfiedCount;
  const allClear = missingCount === 0;

  const handleUpload = useCallback((recipientId: string, formType: string) => {
    setUploadModal({ recipientId, formType });
    setTinInput('');
  }, []);

  const handleSubmitForm = useCallback(() => {
    if (!uploadModal) return;
    const newForm: TaxForm = {
      id: `tf-${Date.now()}`,
      recipientId: uploadModal.recipientId,
      formType: uploadModal.formType as TaxForm['formType'],
      status: 'received',
      tinLast4: tinInput || null,
      signedDate: new Date().toISOString().slice(0, 10),
      expiresOn: null,
      notes: null,
    };
    setForms(prev => [...prev, newForm]);
    setUploadModal(null);
    const recipient = recipients.find(r => r.id === uploadModal.recipientId);
    toast.success(`${formDisplayName(uploadModal.formType)} uploaded for ${recipient?.name}`);
  }, [uploadModal, tinInput, recipients]);

  const handleVerify = useCallback((formId: string) => {
    setForms(prev => prev.map(f => f.id === formId ? { ...f, status: 'verified' as const } : f));
    toast.success('Tax form verified');
  }, []);

  const handleRecipientChange = useCallback((id: string, field: 'recipientType' | 'taxResidency', value: string) => {
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tax Form Compliance</h3>
          <p className="text-sm text-muted-foreground mt-0.5">W-9 / W-8BEN / W-8BEN-E tracking for disbursement recipients</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-xs gap-1.5 cursor-help">
                <Info className="w-3 h-3" /> Privacy Notice
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Only the last 4 digits of TIN/SSN are stored. Do not enter full SSN into free text fields — use the signed PDF upload.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Status Banner */}
      <motion.div {...fadeInUp}>
        {allClear ? (
          <Card className="border-validated/30 bg-validated/5">
            <CardContent className="py-4 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-validated" />
              <div>
                <p className="text-sm font-medium text-validated">All tax forms collected</p>
                <p className="text-xs text-muted-foreground">{satisfiedCount} of {totalRecipients} recipients have valid forms on file</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-4 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Execution blocked: {missingCount} missing tax form{missingCount > 1 ? 's' : ''}</p>
                <p className="text-xs text-muted-foreground">Required tax documentation must be collected before funds can be released.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-normal">Total Recipients</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold tabular-nums">{totalRecipients}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-normal">Forms Verified</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold tabular-nums text-validated">{forms.filter(f => f.status === 'verified').length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-normal">Forms Received</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold tabular-nums text-accent">{forms.filter(f => f.status === 'received').length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-normal">Missing / Expired</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold tabular-nums text-destructive">{missingCount}</p></CardContent>
        </Card>
      </div>

      {/* Recipients Table */}
      <div className="pivt-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/30">
              <TableHead>Recipient</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tax Residency</TableHead>
              <TableHead>Required Form</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>TIN (Last 4)</TableHead>
              <TableHead>Signed Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.map((r) => {
              const rf = requiredForm(r.taxResidency, r.recipientType);
              const form = forms.find(f => f.recipientId === r.id && f.formType === rf);
              const satisfied = isSatisfied(form);
              const sc = form ? statusConfig[form.status] : statusConfig.required;

              return (
                <TableRow key={r.id} className={!satisfied ? 'bg-destructive/[0.02]' : ''}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Select value={r.recipientType} onValueChange={(v) => handleRecipientChange(r.id, 'recipientType', v)}>
                      <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="entity">Entity</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={r.taxResidency} onValueChange={(v) => handleRecipientChange(r.id, 'taxResidency', v)}>
                      <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us">US</SelectItem>
                        <SelectItem value="non_us">Non-US</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-mono">{formDisplayName(rf)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs gap-1 ${sc.color}`}>
                      {sc.icon} {sc.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {form?.tinLast4 ? `••••${form.tinLast4}` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {form?.signedDate || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      {!form && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleUpload(r.id, rf)}>
                          <Upload className="w-3 h-3" /> Upload
                        </Button>
                      )}
                      {form?.status === 'received' && (
                        <Button size="sm" className="h-7 text-xs gap-1 bg-validated text-white hover:bg-validated/90" onClick={() => handleVerify(form.id)}>
                          <CheckCircle2 className="w-3 h-3" /> Verify
                        </Button>
                      )}
                      {form?.status === 'verified' && (
                        <Badge variant="outline" className="text-xs text-validated border-validated/30 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Complete
                        </Badge>
                      )}
                      {form?.status === 'expired' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive/30 text-destructive" onClick={() => handleUpload(r.id, rf)}>
                          <Upload className="w-3 h-3" /> Re-upload
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Upload Modal */}
      <Dialog open={!!uploadModal} onOpenChange={(open) => !open && setUploadModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Tax Form</DialogTitle>
            <DialogDescription>
              Upload a signed {uploadModal ? formDisplayName(uploadModal.formType) : ''} for{' '}
              {uploadModal ? recipients.find(r => r.id === uploadModal.recipientId)?.name : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center cursor-pointer hover:border-accent/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Click or drag to upload signed PDF</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG up to 10MB</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">TIN Last 4 Digits (optional)</label>
              <Input
                placeholder="e.g. 1234"
                maxLength={4}
                value={tinInput}
                onChange={(e) => setTinInput(e.target.value.replace(/\D/g, ''))}
                className="font-mono"
              />
              <div className="flex items-start gap-2 p-2 rounded bg-discrepancy/10 border border-discrepancy/20">
                <AlertTriangle className="w-3.5 h-3.5 text-discrepancy shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground">Do not enter a full SSN or TIN in any free text field. Only the last 4 digits are stored. Use the signed PDF upload for the complete form.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadModal(null)}>Cancel</Button>
            <Button onClick={handleSubmitForm}>
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
