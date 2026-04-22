import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PayloadSchema = z.object({
  action: z.enum(["dealContext", "graphExplorer"]),
  dealId: z.string().uuid(),
  search: z.string().trim().max(120).optional(),
});

const GRAPH_MIN_GROUP_SIZE = 5;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function anonymizeCount(value: number | null | undefined, minimum = GRAPH_MIN_GROUP_SIZE) {
  if (!value || value < minimum) return null;
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const jwt = await requireJwt(req, corsHeaders);
    const parsed = PayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten() }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action, dealId, search } = parsed.data;

    const [{ data: canAccessDeal }, { data: isDealAccessible }] = await Promise.all([
      admin.rpc("can_access_deal", { _user_id: jwt.userId, _deal_id: dealId }),
      admin.rpc("is_deal_accessible", { _user_id: jwt.userId, _deal_id: dealId }),
    ]);

    if (!canAccessDeal && !isDealAccessible) {
      return json({ error: "Access denied" }, 403);
    }

    if (action === "dealContext") {
      const [dealRes, partiesRes, participantsRes, profilesRes, entitiesRes, relationshipsRes, approvalsRes] = await Promise.all([
        admin.from("deals").select("id, deal_name, deal_type, signing_date, status").eq("id", dealId).single(),
        admin.from("deal_parties").select("organization_id, party_type").eq("deal_id", dealId),
        admin.from("deal_participants").select("user_id").eq("deal_id", dealId),
        admin.from("profiles").select("user_id, full_name"),
        admin.from("entities").select("id, canonical_id, canonical_name, entity_type, metadata, source_deal_id").eq("source_deal_id", dealId),
        admin.from("relationships").select("id, entity_from_id, entity_to_id, relationship_type").eq("deal_id", dealId),
        admin.from("deal_approvals").select("approver_email, sent_at, completed_at, approver_name").eq("deal_id", dealId),
      ]);

      if (dealRes.error) throw dealRes.error;

      const deal = dealRes.data;
      const participantNameMap = new Map((profilesRes.data ?? []).map((profile) => [profile.user_id, profile.full_name]));
      const participantOptions = (participantsRes.data ?? []).map((row) => ({
        user_id: row.user_id,
        display_name: participantNameMap.get(row.user_id) ?? "Deal participant",
      }));

      const entityRows = entitiesRes.data ?? [];
      const relationshipRows = relationshipsRes.data ?? [];
      const entityIds = new Set<string>();
      entityRows.forEach((entity) => {
        entityIds.add(entity.id);
        if (entity.canonical_id) entityIds.add(entity.canonical_id);
      });
      relationshipRows.forEach((relationship) => {
        if (relationship.entity_from_id) entityIds.add(relationship.entity_from_id);
        if (relationship.entity_to_id) entityIds.add(relationship.entity_to_id);
      });

      const relatedEntityIds = Array.from(entityIds);
      const { data: relatedEntities, error: relatedEntitiesError } = relatedEntityIds.length
        ? await admin
            .from("entities")
            .select("id, canonical_id, canonical_name, entity_type, metadata, source_deal_id")
            .in("id", relatedEntityIds)
        : { data: [], error: null };

      if (relatedEntitiesError) throw relatedEntitiesError;

      const dedupedEntities = Array.from(
        new Map([...(entityRows ?? []), ...((relatedEntities as typeof entityRows) ?? [])].map((entity) => [entity.id, entity])).values(),
      );

      const counterpartyIntelligence = await Promise.all(
        dedupedEntities.slice(0, 12).map(async (entity) => {
          const canonicalKey = entity.canonical_id ?? entity.id;
          const related = dedupedEntities.filter((row) => row.id === canonicalKey || row.canonical_id === canonicalKey || row.id === entity.id);
          const dealIds = new Set<string>();
          related.forEach((row) => {
            if (row.source_deal_id) dealIds.add(row.source_deal_id);
          });

          const entityMatches = await admin
            .from("entities")
            .select("id, source_deal_id")
            .or(`id.eq.${canonicalKey},canonical_id.eq.${canonicalKey}`);

          (entityMatches.data ?? []).forEach((row) => {
            if (row.source_deal_id) dealIds.add(row.source_deal_id);
          });

          const averageResponseHours = (() => {
            const approvalDurations = (approvalsRes.data ?? [])
              .filter((approval) => {
                const email = approval.approver_email?.toLowerCase();
                const names = [approval.approver_name?.toLowerCase(), entity.canonical_name.toLowerCase()].filter(Boolean);
                const metadataText = JSON.stringify(entity.metadata ?? {}).toLowerCase();
                return names.some((name) => name && metadataText.includes(name)) || (email && metadataText.includes(email));
              })
              .map((approval) => {
                if (!approval.sent_at || !approval.completed_at) return null;
                const sent = new Date(approval.sent_at).getTime();
                const completed = new Date(approval.completed_at).getTime();
                if (!Number.isFinite(sent) || !Number.isFinite(completed) || completed <= sent) return null;
                return (completed - sent) / 3_600_000;
              })
              .filter((value): value is number => value !== null);

            if (approvalDurations.length === 0) return null;
            return Number((approvalDurations.reduce((sum, value) => sum + value, 0) / approvalDurations.length).toFixed(1));
          })();

          const rawDealsParticipated = dealIds.size;
          const totalDealsParticipated = anonymizeCount(rawDealsParticipated);

          return {
            entity_id: entity.id,
            canonical_name: entity.canonical_name,
            firm_name: (entity.metadata?.firm_name as string | null) ?? entity.canonical_name,
            deals_participated: totalDealsParticipated,
            has_minimum_group: rawDealsParticipated >= GRAPH_MIN_GROUP_SIZE,
            average_signature_response_hours: totalDealsParticipated ? averageResponseHours : null,
            relationship_count: relationshipRows.filter(
              (relationship) => relationship.entity_from_id === entity.id || relationship.entity_to_id === entity.id,
            ).length,
          };
        }),
      );

      return json({
        mode: "deal-context",
        deal,
        participantOptions,
        counterpartyIntelligence,
        entityCount: dedupedEntities.length,
        relationshipCount: relationshipRows.length,
        dealPartyCount: (partiesRes.data ?? []).length,
      });
    }

    const { data: canAccessIntelligence, error: accessError } = await admin.rpc("can_access_intelligence", { _user_id: jwt.userId });
    if (accessError) throw accessError;
    if (!canAccessIntelligence) {
      return json({ error: "Raw entity intelligence requires elevated access." }, 403);
    }

    const [currentDealEntitiesRes, relationshipRes] = await Promise.all([
      admin.from("entities").select("id, canonical_id, canonical_name, entity_type, metadata, source_deal_id").eq("source_deal_id", dealId),
      admin.from("relationships").select("id, entity_from_id, entity_to_id, relationship_type, confidence, deal_id").eq("deal_id", dealId),
    ]);

    if (currentDealEntitiesRes.error) throw currentDealEntitiesRes.error;
    if (relationshipRes.error) throw relationshipRes.error;

    const currentEntities = currentDealEntitiesRes.data ?? [];
    const baseCanonicalIds = new Set(currentEntities.map((entity) => entity.canonical_id ?? entity.id));

    const searchTerm = search?.trim().toLowerCase();
    let searchableEntities = currentEntities;
    if (searchTerm) {
      const { data: searchedEntities, error: searchedEntitiesError } = await admin
        .from("entities")
        .select("id, canonical_id, canonical_name, entity_type, metadata, source_deal_id")
        .ilike("canonical_name", `%${searchTerm}%`)
        .limit(25);
      if (searchedEntitiesError) throw searchedEntitiesError;
      searchableEntities = searchedEntities ?? [];
      searchableEntities.forEach((entity) => baseCanonicalIds.add(entity.canonical_id ?? entity.id));
    }

    const resolvedCanonicalIds = Array.from(baseCanonicalIds);
    const { data: graphEntities, error: graphEntitiesError } = resolvedCanonicalIds.length
      ? await admin
          .from("entities")
          .select("id, canonical_id, canonical_name, entity_type, metadata, source_deal_id")
          .or(resolvedCanonicalIds.map((id) => `id.eq.${id},canonical_id.eq.${id}`).join(","))
      : { data: [], error: null };

    if (graphEntitiesError) throw graphEntitiesError;

    const entityIds = Array.from(new Set((graphEntities ?? []).map((entity) => entity.id)));
    const { data: graphRelationships, error: graphRelationshipsError } = entityIds.length
      ? await admin
          .from("relationships")
          .select("id, deal_id, entity_from_id, entity_to_id, relationship_type, confidence")
          .or(`entity_from_id.in.(${entityIds.join(",")}),entity_to_id.in.(${entityIds.join(",")})`)
      : { data: [], error: null };

    if (graphRelationshipsError) throw graphRelationshipsError;

    const entityMap = new Map((graphEntities ?? []).map((entity) => [entity.id, entity]));
    const nodes = (graphEntities ?? []).map((entity) => {
      const matchingEntities = (graphEntities ?? []).filter(
        (row) => (row.canonical_id ?? row.id) === (entity.canonical_id ?? entity.id),
      );
      const dealIds = new Set(matchingEntities.map((row) => row.source_deal_id).filter(Boolean));
      const allRelationships = (graphRelationships ?? []).filter(
        (relationship) => relationship.entity_from_id === entity.id || relationship.entity_to_id === entity.id,
      );
      return {
        id: entity.id,
        label: entity.canonical_name,
        entity_type: entity.entity_type,
        relationship_count: allRelationships.length,
        deals_appeared_in: Array.from(dealIds),
        deals_count: dealIds.size,
        canonical_name: entity.canonical_name,
        known_relationships: allRelationships.map((relationship) => ({
          id: relationship.id,
          relationship_type: relationship.relationship_type,
          other_entity_name:
            entityMap.get(relationship.entity_from_id === entity.id ? relationship.entity_to_id : relationship.entity_from_id)?.canonical_name ?? "Unknown entity",
        })),
      };
    });

    const links = (graphRelationships ?? []).filter(
      (relationship) => entityMap.has(relationship.entity_from_id) && entityMap.has(relationship.entity_to_id),
    ).map((relationship) => ({
      id: relationship.id,
      source: relationship.entity_from_id,
      target: relationship.entity_to_id,
      relationship_type: relationship.relationship_type,
      confidence: relationship.confidence,
    }));

    return json({
      mode: "graph-explorer",
      minimum_group_size: GRAPH_MIN_GROUP_SIZE,
      search_entities: searchableEntities.map((entity) => ({
        id: entity.id,
        canonical_name: entity.canonical_name,
        entity_type: entity.entity_type,
      })),
      graph: { nodes, links },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 400);
  }
});