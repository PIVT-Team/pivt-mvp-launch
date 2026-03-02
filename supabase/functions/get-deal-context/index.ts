import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deal_id } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [deal, parties, members, conditions, approvals, documents, payments] =
      await Promise.all([
        supabase.from("deals").select("*").eq("id", deal_id).single(),
        supabase
          .from("deal_parties")
          .select("*, organizations(name)")
          .eq("deal_id", deal_id),
        supabase.from("deal_members").select("*").eq("deal_id", deal_id),
        supabase.from("conditions").select("*").eq("deal_id", deal_id),
        supabase
          .from("ontology_approvals")
          .select("*")
          .eq("deal_id", deal_id),
        supabase
          .from("ontology_documents")
          .select("*")
          .eq("deal_id", deal_id),
        supabase
          .from("payment_instructions")
          .select("*")
          .eq("deal_id", deal_id),
      ]);

    if (deal.error) {
      return new Response(JSON.stringify({ error: deal.error.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextPack = {
      deal: {
        deal_number: deal.data.deal_number,
        name: deal.data.deal_name,
        value: deal.data.deal_value,
        status: deal.data.status,
        closing_date: deal.data.closing_date,
        escrow_amount: deal.data.escrow_amount,
      },
      parties: parties.data || [],
      members: members.data || [],
      conditions: conditions.data || [],
      approvals: approvals.data || [],
      documents: documents.data || [],
      payment_instructions: payments.data || [],
    };

    return new Response(JSON.stringify(contextPack), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
