import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export type KycStatus = 'not_started' | 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected';

export interface UserKyc {
  id: string;
  user_id: string;
  full_legal_name: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  residential_address: string | null;
  role_at_org: string | null;
  status: KycStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  // Banking / Wire details (from GitHub repo pattern)
  bank_name: string | null;
  bank_address: string | null;
  account_holder_name: string | null;
  account_number_last4: string | null;
  routing_number: string | null;
  swift_bic: string | null;
  iban: string | null;
  bank_country: string | null;
  wire_currency: string | null;
  intermediary_bank: string | null;
  bank_verified: boolean;
}

export interface OrgKyb {
  id: string;
  user_id: string;
  legal_entity_name: string | null;
  country_jurisdiction: string | null;
  registration_number: string | null;
  registered_address: string | null;
  status: KycStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
}

export interface KycUpload {
  id: string;
  owner_type: 'user' | 'org';
  owner_id: string;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  uploaded_at: string;
}

interface KycStore {
  userKyc: UserKyc | null;
  orgKyb: OrgKyb | null;
  uploads: KycUpload[];
  loading: boolean;

  fetchKycData: () => Promise<void>;
  upsertKyc: (data: Partial<UserKyc>) => Promise<void>;
  upsertKyb: (data: Partial<OrgKyb>) => Promise<void>;
  submitKyc: () => Promise<void>;
  submitKyb: () => Promise<void>;
  uploadDocument: (file: File, docType: string, ownerType: 'user' | 'org') => Promise<void>;
  demoApproveAll: () => Promise<void>;

  // Admin
  adminQueue: { kyc: UserKyc[]; kyb: OrgKyb[] };
  fetchAdminQueue: () => Promise<void>;
  adminApproveKyc: (id: string, notes?: string) => Promise<void>;
  adminRejectKyc: (id: string, notes?: string) => Promise<void>;
  adminApproveKyb: (id: string, notes?: string) => Promise<void>;
  adminRejectKyb: (id: string, notes?: string) => Promise<void>;
}

export const useKycStore = create<KycStore>((set, get) => ({
  userKyc: null,
  orgKyb: null,
  uploads: [],
  loading: false,
  adminQueue: { kyc: [], kyb: [] },

  fetchKycData: async () => {
    set({ loading: true });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false }); return; }

    const [kycRes, kybRes, uploadsRes] = await Promise.all([
      supabase.from('user_kyc').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('org_kyb').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('kyc_uploads').select('*'),
    ]);

    set({
      userKyc: kycRes.data as UserKyc | null,
      orgKyb: kybRes.data as OrgKyb | null,
      uploads: (uploadsRes.data || []) as KycUpload[],
      loading: false,
    });
  },

  upsertKyc: async (data) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existing = get().userKyc;
    const status = data.status || existing?.status || 'draft';

    if (existing) {
      await supabase.from('user_kyc').update({ ...data, status }).eq('id', existing.id);
    } else {
      await supabase.from('user_kyc').insert({ ...data, user_id: user.id, status } as any);
    }
    await get().fetchKycData();
  },

  upsertKyb: async (data) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existing = get().orgKyb;
    const status = data.status || existing?.status || 'draft';

    if (existing) {
      await supabase.from('org_kyb').update({ ...data, status }).eq('id', existing.id);
    } else {
      await supabase.from('org_kyb').insert({ ...data, user_id: user.id, status } as any);
    }
    await get().fetchKycData();
  },

  submitKyc: async () => {
    const kyc = get().userKyc;
    if (!kyc) return;
    await supabase.from('user_kyc').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', kyc.id);
    // Audit
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('audit_log').insert({ action: 'KYC submitted', user_id: user.id, details: { kyc_id: kyc.id } });
    }
    await get().fetchKycData();
  },

  submitKyb: async () => {
    const kyb = get().orgKyb;
    if (!kyb) return;
    await supabase.from('org_kyb').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', kyb.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('audit_log').insert({ action: 'KYB submitted', user_id: user.id, details: { kyb_id: kyb.id } });
    }
    await get().fetchKycData();
  },

  uploadDocument: async (file, docType, ownerType) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('kyc-documents').upload(filePath, file);
    if (uploadError) { console.error(uploadError); return; }

    const { data: urlData } = supabase.storage.from('kyc-documents').getPublicUrl(filePath);
    const ownerId = ownerType === 'user' ? get().userKyc?.id : get().orgKyb?.id;
    if (!ownerId) return;

    await supabase.from('kyc_uploads').insert({
      owner_type: ownerType,
      owner_id: ownerId,
      doc_type: docType,
      file_url: urlData.publicUrl,
      file_name: file.name,
    });
    await get().fetchKycData();
  },

  demoApproveAll: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Ensure records exist
    const kyc = get().userKyc;
    const kyb = get().orgKyb;

    if (!kyc) {
      await supabase.from('user_kyc').insert({ user_id: user.id, status: 'approved', full_legal_name: 'Demo User', reviewed_at: new Date().toISOString(), admin_notes: 'Approved (demo)' } as any);
    } else {
      await supabase.from('user_kyc').update({ status: 'approved', reviewed_at: new Date().toISOString(), admin_notes: 'Approved (demo)' }).eq('id', kyc.id);
    }

    if (!kyb) {
      await supabase.from('org_kyb').insert({ user_id: user.id, status: 'approved', legal_entity_name: 'Demo Organization', reviewed_at: new Date().toISOString(), admin_notes: 'Approved (demo)' } as any);
    } else {
      await supabase.from('org_kyb').update({ status: 'approved', reviewed_at: new Date().toISOString(), admin_notes: 'Approved (demo)' }).eq('id', kyb.id);
    }

    await supabase.from('audit_log').insert({ action: 'KYC/KYB approved (demo)', user_id: user.id, details: { method: 'demo_toggle' } });
    await get().fetchKycData();
  },

  fetchAdminQueue: async () => {
    const [kycRes, kybRes] = await Promise.all([
      supabase.from('user_kyc').select('*').in('status', ['submitted', 'in_review']),
      supabase.from('org_kyb').select('*').in('status', ['submitted', 'in_review']),
    ]);
    set({
      adminQueue: {
        kyc: (kycRes.data || []) as UserKyc[],
        kyb: (kybRes.data || []) as OrgKyb[],
      },
    });
  },

  adminApproveKyc: async (id, notes) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('user_kyc').update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, admin_notes: notes || null }).eq('id', id);
    if (user) await supabase.from('audit_log').insert({ action: 'KYC approved (admin)', user_id: user.id, details: { kyc_id: id } });
    await get().fetchAdminQueue();
  },

  adminRejectKyc: async (id, notes) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('user_kyc').update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, admin_notes: notes || null }).eq('id', id);
    if (user) await supabase.from('audit_log').insert({ action: 'KYC rejected (admin)', user_id: user.id, details: { kyc_id: id } });
    await get().fetchAdminQueue();
  },

  adminApproveKyb: async (id, notes) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('org_kyb').update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, admin_notes: notes || null }).eq('id', id);
    if (user) await supabase.from('audit_log').insert({ action: 'KYB approved (admin)', user_id: user.id, details: { kyb_id: id } });
    await get().fetchAdminQueue();
  },

  adminRejectKyb: async (id, notes) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('org_kyb').update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, admin_notes: notes || null }).eq('id', id);
    if (user) await supabase.from('audit_log').insert({ action: 'KYB rejected (admin)', user_id: user.id, details: { kyb_id: id } });
    await get().fetchAdminQueue();
  },
}));
