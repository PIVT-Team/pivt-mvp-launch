import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PersistentDealGraph {
  success: true;
  deal_id: string;
  deal_state: string;
  entity_count: number;
  relationship_count: number;
  entities: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
}

async function fetchDealState(supabase: any, dealId: string) {
  const { data: deal, error } = await supabase
    .from("deals")
    .select("id, deal_state, status")
    .eq("id", dealId)
    .single();

  if (error) throw error;
  if (!deal) throw new Error("Deal not found");

  return (deal.deal_state || deal.status || "draft") as string;
}

export async function getPersistentDealGraph(
  supabase: any,
  dealId: string,
): Promise<PersistentDealGraph> {
  const dealState = await fetchDealState(supabase, dealId);

  const { data: relationships, error: relationshipsError } = await supabase
    .from("relationships")
    .select("id, deal_id, entity_from_id, entity_to_id, relationship_type, provenance, confidence, effective_date, created_at")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });

  if (relationshipsError) throw relationshipsError;

  const entityIdSet = new Set<string>();
  for (const relationship of relationships || []) {
    if (relationship.entity_from_id) entityIdSet.add(relationship.entity_from_id);
    if (relationship.entity_to_id) entityIdSet.add(relationship.entity_to_id);
  }

  const { data: dealScopedEntities, error: dealEntitiesError } = await supabase
    .from("entities")
    .select("id, canonical_id, entity_type, canonical_name, name_variants, source_deal_id, confidence, metadata, created_by_source, created_at")
    .eq("source_deal_id", dealId)
    .order("created_at", { ascending: true });

  if (dealEntitiesError) throw dealEntitiesError;
  for (const entity of dealScopedEntities || []) {
    if (entity.id) entityIdSet.add(entity.id);
    if (entity.canonical_id) entityIdSet.add(entity.canonical_id);
  }

  let relatedEntities: Array<Record<string, unknown>> = [];
  const relatedEntityIds = Array.from(entityIdSet);
  if (relatedEntityIds.length > 0) {
    const { data, error } = await supabase
      .from("entities")
      .select("id, canonical_id, entity_type, canonical_name, name_variants, source_deal_id, confidence, metadata, created_by_source, created_at")
      .in("id", relatedEntityIds)
      .order("created_at", { ascending: true });
    if (error) throw error;
    relatedEntities = data || [];
  }

  const mergedEntities = [...(dealScopedEntities || []), ...relatedEntities];
  const dedupedEntities = Array.from(new Map(mergedEntities.map((entity: any) => [entity.id, entity])).values());

  return {
    success: true,
    deal_id: dealId,
    deal_state: dealState,
    entity_count: dedupedEntities.length,
    relationship_count: (relationships || []).length,
    entities: dedupedEntities,
    relationships: relationships || [],
  };
}

export async function buildDealGraphJob(
  supabase: any,
  dealId: string,
): Promise<PersistentDealGraph> {
  return await getPersistentDealGraph(supabase, dealId);
}
