import React from 'react';
import { motion } from 'framer-motion';
import { X, ArrowRight, FileUp, Shield, CheckCircle2, CreditCard, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface GraphNodeData {
  id: string;
  node_type: string;
  label: string;
  status: string;
  metadata: Record<string, unknown>;
  source_entity_id: string | null;
}

interface GraphEdgeData {
  id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: string;
}

const statusColors: Record<string, string> = {
  not_started: 'text-muted-foreground',
  in_progress: 'text-blue-400',
  complete: 'text-validated',
  blocked: 'text-blocking',
  failed: 'text-blocking',
};

const ctaByType: Record<string, { label: string; icon: React.ElementType }> = {
  document: { label: 'Upload Document', icon: FileUp },
  compliance_check: { label: 'Request KYC/Compliance', icon: Shield },
  approval: { label: 'Request Approval', icon: CheckCircle2 },
  payment_intent: { label: 'Generate Disbursement', icon: CreditCard },
  discrepancy: { label: 'Resolve Discrepancy', icon: AlertTriangle },
};

export const NodeDrawer: React.FC<{
  node: GraphNodeData;
  edges: GraphEdgeData[];
  allNodes: GraphNodeData[];
  onClose: () => void;
  onSelectNode: (id: string) => void;
}> = ({ node, edges, allNodes, onClose, onSelectNode }) => {
  const connectedEdges = edges.filter(e => e.from_node_id === node.id || e.to_node_id === node.id);
  const connectedNodes = connectedEdges.map(e => {
    const otherId = e.from_node_id === node.id ? e.to_node_id : e.from_node_id;
    return { edge: e, node: allNodes.find(n => n.id === otherId) };
  }).filter(x => x.node);

  const inbound = connectedEdges.filter(e => e.to_node_id === node.id);
  const outbound = connectedEdges.filter(e => e.from_node_id === node.id);

  const cta = ctaByType[node.node_type];
  const isBlocked = node.status === 'blocked' || node.status === 'failed';
  const blockers = connectedNodes.filter(x => x.edge.edge_type === 'BLOCKS' && x.edge.to_node_id === node.id);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-4 right-4 w-80 rounded-xl border border-border/50 overflow-hidden bg-background/95 backdrop-blur-xl shadow-xl z-20 max-h-[80vh] overflow-y-auto"
    >
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] capitalize">{node.node_type.replace('_', ' ')}</Badge>
              <Badge className={`text-[9px] capitalize ${
                node.status === 'complete' ? 'bg-validated/10 text-validated' :
                node.status === 'blocked' || node.status === 'failed' ? 'bg-blocking/10 text-blocking' :
                node.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                'bg-muted text-muted-foreground'
              }`}>
                {node.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="font-semibold text-sm break-words">{node.label}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Why blocked */}
        {isBlocked && blockers.length > 0 && (
          <div className="p-2.5 rounded-lg bg-blocking/5 border border-blocking/20 space-y-1">
            <p className="text-[10px] font-semibold text-blocking uppercase tracking-wider">Why Blocked</p>
            {blockers.map((b, i) => (
              <button
                key={i}
                onClick={() => b.node && onSelectNode(b.node.id)}
                className="flex items-center gap-2 text-xs text-blocking/80 hover:text-blocking w-full"
              >
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="truncate">{b.node?.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Metadata */}
        {node.metadata && Object.keys(node.metadata).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Details</p>
            {Object.entries(node.metadata).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-medium truncate max-w-[140px]">{String(val)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Dependencies */}
        <div className="space-y-2">
          {inbound.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Inbound ({inbound.length})</p>
              {inbound.slice(0, 5).map((e, i) => {
                const other = allNodes.find(n => n.id === e.from_node_id);
                if (!other) return null;
                return (
                  <button key={i} onClick={() => onSelectNode(other.id)}
                    className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-0.5"
                  >
                    <span className="text-[9px] text-muted-foreground/50 w-20 text-left truncate">{e.edge_type}</span>
                    <span className="truncate flex-1 text-left">{other.label}</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          {outbound.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Outbound ({outbound.length})</p>
              {outbound.slice(0, 5).map((e, i) => {
                const other = allNodes.find(n => n.id === e.to_node_id);
                if (!other) return null;
                return (
                  <button key={i} onClick={() => onSelectNode(other.id)}
                    className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-0.5"
                  >
                    <span className="text-[9px] text-muted-foreground/50 w-20 text-left truncate">{e.edge_type}</span>
                    <span className="truncate flex-1 text-left">{other.label}</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA */}
        {cta && node.status !== 'complete' && (
          <Button size="sm" className="w-full text-xs gap-2">
            <cta.icon className="w-3.5 h-3.5" />
            {cta.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
};
