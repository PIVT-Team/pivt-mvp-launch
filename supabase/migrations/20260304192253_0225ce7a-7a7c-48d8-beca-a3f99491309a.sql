
-- Node type enum
CREATE TYPE public.graph_node_type AS ENUM (
  'deal', 'stakeholder', 'document', 'obligation', 'compliance_check',
  'approval', 'payment_intent', 'settlement', 'waterfall', 'discrepancy'
);

-- Node status enum
CREATE TYPE public.graph_node_status AS ENUM (
  'not_started', 'in_progress', 'complete', 'blocked', 'failed'
);

-- Edge type enum
CREATE TYPE public.graph_edge_type AS ENUM (
  'HAS_PARTY', 'HAS_DOCUMENT', 'REQUIRES', 'SATISFIES',
  'BLOCKS', 'PAYS', 'DERIVED_FROM', 'RESULTS_IN'
);

-- Graph nodes table
CREATE TABLE public.graph_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  node_type public.graph_node_type NOT NULL,
  label text NOT NULL,
  status public.graph_node_status NOT NULL DEFAULT 'not_started',
  metadata jsonb DEFAULT '{}'::jsonb,
  source_entity_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_graph_nodes_deal_id ON public.graph_nodes(deal_id);
CREATE INDEX idx_graph_nodes_source ON public.graph_nodes(deal_id, source_entity_id);

-- Graph edges table
CREATE TABLE public.graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES public.graph_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES public.graph_nodes(id) ON DELETE CASCADE,
  edge_type public.graph_edge_type NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_graph_edges_deal_id ON public.graph_edges(deal_id);
CREATE INDEX idx_graph_edges_from ON public.graph_edges(from_node_id);
CREATE INDEX idx_graph_edges_to ON public.graph_edges(to_node_id);

-- RLS
ALTER TABLE public.graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "graph_nodes_select" ON public.graph_nodes FOR SELECT USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "graph_nodes_insert" ON public.graph_nodes FOR INSERT WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "graph_nodes_update" ON public.graph_nodes FOR UPDATE USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "graph_nodes_delete" ON public.graph_nodes FOR DELETE USING (can_write_deal(auth.uid(), deal_id));

CREATE POLICY "graph_edges_select" ON public.graph_edges FOR SELECT USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "graph_edges_insert" ON public.graph_edges FOR INSERT WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "graph_edges_update" ON public.graph_edges FOR UPDATE USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "graph_edges_delete" ON public.graph_edges FOR DELETE USING (can_write_deal(auth.uid(), deal_id));
