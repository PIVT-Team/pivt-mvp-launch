import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileUp, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * The counterparty's view. No PIVT account, no login, no navigation.
 *
 * Deliberately one screen with one action. The people who land here — a CFO's
 * assistant, a lender's back office, an insurance broker — are doing a favour
 * for someone else's deal. Anything beyond "here's what we need, attach it,
 * done" costs responses.
 */

type RequestInfo = {
  title: string;
  description: string | null;
  due_date: string | null;
  deal_name: string;
  recipient_name: string | null;
  already_submitted: boolean;
};

const PortalShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="flex items-center gap-2 mb-5 justify-center">
        <ShieldCheck className="w-5 h-5 text-accent" />
        <span className="font-semibold tracking-tight">PIVT</span>
      </div>
      {children}
      <p className="text-[10px] text-muted-foreground text-center mt-5">
        This is a secure single-use link. Please don't forward it.
      </p>
    </div>
  </div>
);

const RequirementPortalPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [info, setInfo] = useState<RequestInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: fnErr } = await supabase.functions.invoke('requirement-portal', { body });
    if (fnErr) throw new Error('We could not reach PIVT. Please try again in a moment.');
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  useEffect(() => {
    if (!token) { setError('This link is incomplete. Please use the full link from your email.'); setLoading(false); return; }
    (async () => {
      try {
        const d = await call({ token, action: 'peek' });
        setInfo(d.request);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, call]);

  const onFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { setError('Files must be 20MB or smaller.'); return; }
    setUploading(true); setError(null);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error('That file could not be read.'));
        fr.readAsDataURL(file);
      });
      await call({ token, action: 'submit', filename: file.name, content_base64: b64 });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <PortalShell><div className="pivt-card p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div></PortalShell>;
  }

  if (done) {
    return (
      <PortalShell>
        <div className="pivt-card p-8 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-validated mx-auto" />
          <h1 className="text-base font-semibold">Received — thank you</h1>
          <p className="text-xs text-muted-foreground">
            We'll review it and come back to you only if something else is needed.
            You can close this page.
          </p>
        </div>
      </PortalShell>
    );
  }

  if (error && !info) {
    return (
      <PortalShell>
        <div className="pivt-card p-8 text-center space-y-3">
          <AlertTriangle className="w-9 h-9 text-discrepancy mx-auto" />
          <h1 className="text-base font-semibold">This link isn't working</h1>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </PortalShell>
    );
  }

  const overdue = info?.due_date && new Date(info.due_date) < new Date();

  return (
    <PortalShell>
      <div className="pivt-card p-6 space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Requested for {info?.deal_name}
          </p>
          <h1 className="text-base font-semibold mt-1">{info?.title}</h1>
          {info?.description && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{info.description}</p>
          )}
          {info?.due_date && (
            <p className={`text-[11px] mt-2 ${overdue ? 'text-blocking' : 'text-muted-foreground'}`}>
              {overdue ? 'Was due ' : 'Needed by '}{info.due_date}
            </p>
          )}
        </div>

        {info?.already_submitted && (
          <div className="text-[11px] rounded-lg border border-border/60 bg-muted/40 p-3">
            Something has already been submitted for this item and is being reviewed.
            You can upload a replacement below if you need to.
          </div>
        )}

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-border/70 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-accent/[0.03] transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Uploading…</span></>
          ) : (
            <><FileUp className="w-6 h-6 text-muted-foreground" />
              <span className="text-xs font-medium">Choose a file</span>
              <span className="text-[10px] text-muted-foreground">PDF, Word or image · up to 20MB</span></>
          )}
        </button>
        <input
          ref={fileRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        />

        {error && <p className="text-[11px] text-blocking text-center">{error}</p>}
      </div>
    </PortalShell>
  );
};

export default RequirementPortalPage;
