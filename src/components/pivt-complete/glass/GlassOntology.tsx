import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { Search, Zap } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  color: string;
  size: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

const typeColors: Record<string, string> = {
  deal: '#3B82F6',
  stakeholder: '#A855F7',
  document: '#22C55E',
  payment: '#F59E0B',
  escrow: '#06B6D4',
  waterfall: '#EC4899',
};

export const GlassOntology: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders, documents, payments, waterfallTiers } = usePIVTStore();
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const { nodes, edges } = useMemo(() => {
    const ns: GraphNode[] = [];
    const es: GraphEdge[] = [];
    const cx = 400, cy = 300;

    // Deal node (center)
    ns.push({ id: deal.id, label: deal.codeName, type: 'deal', x: cx, y: cy, color: typeColors.deal, size: 40 });

    // Stakeholders (top arc)
    stakeholders.forEach((s, i) => {
      const angle = (-Math.PI / 2) + (i - stakeholders.length / 2) * 0.3;
      ns.push({ id: s.id, label: s.name, type: 'stakeholder', x: cx + Math.cos(angle) * 220, y: cy + Math.sin(angle) * 180, color: typeColors.stakeholder, size: 24 });
      es.push({ from: deal.id, to: s.id, label: 'has_stakeholder' });
    });

    // Documents (right arc)
    documents.slice(0, 6).forEach((d, i) => {
      const angle = 0 + (i - 3) * 0.35;
      ns.push({ id: d.id, label: d.name.slice(0, 20), type: 'document', x: cx + Math.cos(angle) * 260, y: cy + Math.sin(angle) * 200, color: typeColors.document, size: 20 });
      es.push({ from: deal.id, to: d.id, label: 'references' });
    });

    // Payments (bottom arc)
    payments.forEach((p, i) => {
      const angle = (Math.PI / 2) + (i - payments.length / 2) * 0.35;
      ns.push({ id: p.id, label: p.recipientName.split(' ')[0], type: 'payment', x: cx + Math.cos(angle) * 230, y: cy + Math.sin(angle) * 190, color: typeColors.payment, size: 22 });
      es.push({ from: deal.id, to: p.id, label: 'pays' });
    });

    // Waterfall (left arc)
    waterfallTiers.forEach((t, i) => {
      const angle = Math.PI + (i - waterfallTiers.length / 2) * 0.35;
      ns.push({ id: t.id, label: t.name.slice(0, 15), type: 'waterfall', x: cx + Math.cos(angle) * 240, y: cy + Math.sin(angle) * 180, color: typeColors.waterfall, size: 20 });
      es.push({ from: deal.id, to: t.id, label: 'distributes' });
    });

    return { nodes: ns, edges: es };
  }, [deal, stakeholders, documents, payments, waterfallTiers]);

  const filtered = search
    ? nodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase()))
    : nodes;
  const filteredIds = new Set(filtered.map(n => n.id));

  return (
    <div className="h-full flex flex-col" style={{ background: '#0B0B0B', color: '#fff' }}>
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-white/10">
        <Zap className="w-5 h-5 text-cyan-400" />
        <h2 className="text-lg font-semibold">Deal Ontology — {deal.codeName}</h2>
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 w-64"
          />
        </div>
        <div className="flex items-center gap-3 text-xs">
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-white/50 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph SVG */}
      <div className="flex-1 relative overflow-hidden">
        <svg width="100%" height="100%" viewBox="0 0 800 600" className="absolute inset-0">
          {/* Edges */}
          {edges.map((e, i) => {
            const from = nodes.find(n => n.id === e.from);
            const to = nodes.find(n => n.id === e.to);
            if (!from || !to) return null;
            const visible = filteredIds.has(from.id) && filteredIds.has(to.id);
            return (
              <line
                key={i}
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke={visible ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)'}
                strokeWidth={1}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const visible = filteredIds.has(node.id);
            return (
              <g
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className="cursor-pointer"
                opacity={visible ? 1 : 0.15}
              >
                <circle cx={node.x} cy={node.y} r={node.size / 2} fill={node.color} opacity={0.2} />
                <circle cx={node.x} cy={node.y} r={node.size / 3} fill={node.color} />
                {node.size > 22 && (
                  <text
                    x={node.x}
                    y={node.y + node.size / 2 + 14}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.6)"
                    fontSize={10}
                    fontFamily="Inter"
                  >
                    {node.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Selected node panel */}
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-4 right-4 w-72 rounded-xl border border-white/10 p-4"
            style={{ background: 'rgba(17,17,17,0.95)', backdropFilter: 'blur(20px)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ background: selectedNode.color }} />
              <span className="text-xs uppercase text-white/50">{selectedNode.type}</span>
              <button onClick={() => setSelectedNode(null)} className="ml-auto text-white/40 hover:text-white text-xs">✕</button>
            </div>
            <p className="font-semibold text-white">{selectedNode.label}</p>
            <p className="text-xs text-white/40 mt-1">ID: {selectedNode.id}</p>
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-white/50">
                Connected to {edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).length} entities
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
