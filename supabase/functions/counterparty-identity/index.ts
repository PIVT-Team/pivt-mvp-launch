import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RoleTypeSchema = z.enum([
  "counsel",
  "escrow_agent",
  "paying_agent",
  "financial_advisor",
  "management_rep",
]);

const LookupSchema = z.object({
  action: z.literal("lookupByEmail"),
  email: z.string().email(),
  dealId: z.string().uuid(),
});

const CreateInvitationSchema = z.object({
  action: z.literal("createInvitation"),
  dealId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().trim().max(120).nullable().optional(),
  firmName: z.string().trim().max(160).nullable().optional(),
  roleType: RoleTypeSchema,
  message: z.string().trim().max(1000).nullable().optional(),
});

const GetInvitationSchema = z.object({
  action: z.literal("getInvitation"),
  inviteToken: z.string().min(8).max(255),
});

const GetPassportSchema = z.object({
  action: z.literal("getPassport"),
});

const CompleteOnboardingSchema = z.object({
  action: z.literal("completeOnboarding"),
  inviteToken: z.string().min(8).max(255),
  profile: z.object({
    displayName: z.string().trim().min(1).max(120),
    firmName: z.string().trim().min(1).max(160),
    roleType: RoleTypeSchema,
  }),
  bankInstruction: z.object({
    label: z.string().trim().min(1).max(120),
    bankName: z.string().trim().max(160).nullable().optional(),
    routingNumber: z.string().trim().max(64).nullable().optional(),
    swiftCode: z.string().trim().max(64).nullable().optional(),
    accountNumber: z.string().trim().min(4).max(128),
  }).nullable().optional(),
  kycDocuments: z.array(z.object({
    document_type: z.string().trim().min(1).max(80),
    file_path: z.string().trim().min(1).max(500),
  })).optional().default([]),
  note: z.string().trim().max(1000).optional().default(""),
  finalize: z.boolean().optional().default(false),
});

type AnyPayload =
  | z.infer<typeof LookupSchema>
  | z.infer<typeof CreateInvitationSchema>
  | z.infer<typeof GetInvitationSchema>
  | z.infer<typeof GetPassportSchema>
  | z.infer<typeof CompleteOnboardingSchema>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskAccount(value: string) {
  return `••••${value.slice(-4)}`;
}

async function getUserEmail(authClient: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await authClient.auth.admin.getUserById(userId);
  if (error || !data.user?.email) {
    throw new Error("Unable to resolve authenticated user email.");
  }
  return data.user.email.toLowerCase();
}

async function ensureCanWriteDeal(admin: ReturnType<typeof createClient>, userId: string, dealId: string) {
  const { data, error } = await admin.rpc("can_write_deal", { _user_id: userId, _deal_id: dealId });
  if (error || !data) throw new Error("You do not have permission to invite counterparties to this deal.");
}

async function getOrCreateProfile(admin: ReturnType<typeof createClient>, userId: string, profile: { displayName: string; firmName: string; roleType: string; }) {
  const { data: existing } = await admin
    .from("counterparty_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await admin
      .from("counterparty_profiles")
      .update({
        display_name: profile.displayName,
        firm_name: profile.firmName,
        role_type: profile.roleType,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return updated;
  }

  const { data: inserted, error } = await admin
    .from("counterparty_profiles")
    .insert({
      user_id: userId,
      display_name: profile.displayName,
      firm_name: profile.firmName,
      role_type: profile.roleType,
    })
    .select("*")
    .single();
  if (error) throw error;
  return inserted;
}

async function buildPassport(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: profile, error: profileError } = await admin
    .from("counterparty_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return { profile: null, bankInstructions: [] };

  const { data: bankInstructions, error: bankError } = await admin
    .from("saved_bank_instructions")
    .select("*")
    .eq("counterparty_profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (bankError) throw bankError;

  return {
    profile,
    bankInstructions: (bankInstructions ?? []).map((item) => ({
      ...item,
      account_number_encrypted: maskAccount(item.account_number_encrypted),
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const jwt = await requireJwt(req, corsHeaders);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const payload = await req.json() as AnyPayload;

    if (payload.action === "lookupByEmail") {
      const parsed = LookupSchema.safeParse(payload);
      if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

      await ensureCanWriteDeal(admin, jwt.userId, parsed.data.dealId);

      const email = parsed.data.email.toLowerCase();
      const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();
      if (authError) throw authError;

      const matchedUser = authUsers.users.find((item) => item.email?.toLowerCase() === email);
      if (!matchedUser) return json({ found: false });

      const { data: profile } = await admin
        .from("counterparty_profiles")
        .select("*")
        .eq("user_id", matchedUser.id)
        .maybeSingle();

      if (!profile) return json({ found: false });

      return json({
        found: true,
        display_name: profile.display_name,
        firm_name: profile.firm_name,
        role_type: profile.role_type,
        kyc_status: profile.kyc_status,
        deals_participated: profile.deals_participated,
        preverified: profile.deals_participated >= 3,
      });
    }

    if (payload.action === "createInvitation") {
      const parsed = CreateInvitationSchema.safeParse(payload);
      if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

      await ensureCanWriteDeal(admin, jwt.userId, parsed.data.dealId);

      const email = parsed.data.email.toLowerCase();
      const { data: authUsers } = await admin.auth.admin.listUsers();
      const matchedUser = authUsers.users.find((item) => item.email?.toLowerCase() === email);

      let counterpartyProfileId: string | null = null;
      let firmNameSnapshot = parsed.data.firmName ?? null;
      let roleType = parsed.data.roleType;

      if (matchedUser) {
        const { data: profile } = await admin
          .from("counterparty_profiles")
          .select("id, firm_name, role_type")
          .eq("user_id", matchedUser.id)
          .maybeSingle();

        if (profile) {
          counterpartyProfileId = profile.id;
          firmNameSnapshot = profile.firm_name ?? firmNameSnapshot;
          roleType = (profile.role_type as z.infer<typeof RoleTypeSchema> | null) ?? roleType;
        }
      }

      const inviteToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

      const { data: invitation, error } = await admin
        .from("counterparty_invitations")
        .insert({
          deal_id: parsed.data.dealId,
          email,
          invite_token: inviteToken,
          invited_by: jwt.userId,
          counterparty_profile_id: counterpartyProfileId,
          role_type: roleType,
          firm_name_snapshot: firmNameSnapshot,
          status: "pending",
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (error) throw error;

      return json({
        invitationId: invitation.id,
        inviteUrl: `${new URL(req.url).origin.replace('/functions/v1/counterparty-identity', '')}/join/${inviteToken}`,
      });
    }

    if (payload.action === "getInvitation") {
      const parsed = GetInvitationSchema.safeParse(payload);
      if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

      const userEmail = await getUserEmail(admin, jwt.userId);

      const { data: invitation, error } = await admin
        .from("counterparty_invitations")
        .select("*")
        .eq("invite_token", parsed.data.inviteToken)
        .maybeSingle();

      if (error || !invitation) return json({ error: "Invitation not found." }, 404);
      if (invitation.email.toLowerCase() !== userEmail) return json({ error: "This invitation was issued to a different email address." }, 403);

      const { data: deal } = await admin.from("deals").select("deal_name").eq("id", invitation.deal_id).maybeSingle();
      const { data: profile } = invitation.counterparty_profile_id
        ? await admin.from("counterparty_profiles").select("*").eq("id", invitation.counterparty_profile_id).maybeSingle()
        : { data: null };

      return json({
        invitation_id: invitation.id,
        deal_id: invitation.deal_id,
        deal_name: deal?.deal_name ?? "Deal",
        email: invitation.email,
        status: invitation.status,
        role_type: invitation.role_type,
        firm_name_snapshot: invitation.firm_name_snapshot,
        counterparty_profile_id: invitation.counterparty_profile_id,
        profile,
      });
    }

    if (payload.action === "getPassport") {
      const parsed = GetPassportSchema.safeParse(payload);
      if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
      return json(await buildPassport(admin, jwt.userId));
    }

    if (payload.action === "completeOnboarding") {
      const parsed = CompleteOnboardingSchema.safeParse(payload);
      if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

      const userEmail = await getUserEmail(admin, jwt.userId);
      const { data: invitation, error: invitationError } = await admin
        .from("counterparty_invitations")
        .select("*")
        .eq("invite_token", parsed.data.inviteToken)
        .maybeSingle();
      if (invitationError || !invitation) return json({ error: "Invitation not found." }, 404);
      if (invitation.email.toLowerCase() !== userEmail) return json({ error: "This invitation was issued to a different email address." }, 403);

      const profile = await getOrCreateProfile(admin, jwt.userId, parsed.data.profile);

      if (parsed.data.bankInstruction) {
        const { error } = await admin.from("saved_bank_instructions").insert({
          counterparty_profile_id: profile.id,
          label: parsed.data.bankInstruction.label,
          bank_name: parsed.data.bankInstruction.bankName ?? null,
          routing_number: parsed.data.bankInstruction.routingNumber ?? null,
          swift_code: parsed.data.bankInstruction.swiftCode ?? null,
          account_number_encrypted: parsed.data.bankInstruction.accountNumber,
        });
        if (error) throw error;
      }

      for (const doc of parsed.data.kycDocuments) {
        const { data: existing } = await admin
          .from("counterparty_kyc_documents")
          .select("id")
          .eq("counterparty_profile_id", profile.id)
          .eq("file_path", doc.file_path)
          .maybeSingle();

        if (!existing) {
          const { error } = await admin.from("counterparty_kyc_documents").insert({
            counterparty_profile_id: profile.id,
            deal_id: invitation.deal_id,
            document_type: doc.document_type,
            file_path: doc.file_path,
            review_status: "pending",
          });
          if (error) throw error;
        }
      }

      if (parsed.data.kycDocuments.length > 0) {
        await admin
          .from("counterparty_profiles")
          .update({ kyc_status: parsed.data.finalize ? "submitted" : profile.kyc_status })
          .eq("id", profile.id);
      }

      if (parsed.data.finalize) {
        const { data: acceptedInvites } = await admin
          .from("counterparty_invitations")
          .select("deal_id")
          .eq("email", userEmail)
          .in("status", ["accepted", "pending"]);

        const uniqueDeals = new Set((acceptedInvites ?? []).map((row) => row.deal_id));
        uniqueDeals.add(invitation.deal_id);

        await admin.from("counterparty_invitations").update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          counterparty_profile_id: profile.id,
        }).eq("id", invitation.id);

        await admin.from("counterparty_profiles").update({
          deals_participated: uniqueDeals.size,
        }).eq("id", profile.id);

        await admin.from("audit_log").insert({
          deal_id: invitation.deal_id,
          user_id: jwt.userId,
          action: "Counterparty onboarding completed",
          details: {
            role_type: parsed.data.profile.roleType,
            firm_name: parsed.data.profile.firmName,
            note: parsed.data.note,
          },
        });
      }

      return json({ passport: await buildPassport(admin, jwt.userId) });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return json({ error: message }, 500);
  }
});