import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp, springConfig } from '@/lib/animations';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, Loader2,
  Zap, ArrowRight, Eye, X,
} from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  status: 'uploading' | 'parsing' | 'extracted' | 'error';
  entities?: number;
  relationships?: number;
}

interface ExtractedEntity {
  name: string;
  type: string;
  confidence: number;
  source: string;
}

const MOCK_ENTITIES: ExtractedEntity[] = [
  { name: 'Sarah Chen', type: 'Person', confidence: 0.99, source: 'Cap Table' },
  { name: 'DataStream Technologies', type: 'Company', confidence: 0.98, source: 'Merger Agreement' },
  { name: 'Apex Capital Partners', type: 'Company', confidence: 0.97, source: 'Merger Agreement' },
  { name: '$2,800,000,000', type: 'Amount', confidence: 0.99, source: 'Merger Agreement' },
  { name: 'Sequoia Capital Fund XIV', type: 'Fund', confidence: 0.96, source: 'Cap Table' },
  { name: '30% Ownership', type: 'Percentage', confidence: 0.95, source: 'Cap Table' },
  { name: 'March 15, 2026', type: 'Date', confidence: 0.98, source: 'Closing Schedule' },
  { name: '$280,000,000 Escrow', type: 'Amount', confidence: 0.97, source: 'Escrow Agreement' },
];

export const DocumentIngestionCover: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [showExtracted, setShowExtracted] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const simulateUpload = useCallback((fileName: string) => {
    const id = Math.random().toString(36).slice(2, 8);
    const file: UploadedFile = {
      id,
      name: fileName,
      size: `${(Math.random() * 5 + 0.5).toFixed(1)} MB`,
      status: 'uploading',
    };
    setFiles(prev => [...prev, file]);

    // Simulate processing pipeline
    setTimeout(() => {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'parsing' } : f));
    }, 800);
    setTimeout(() => {
      setFiles(prev => prev.map(f => f.id === id ? {
        ...f,
        status: 'extracted',
        entities: Math.floor(Math.random() * 30) + 10,
        relationships: Math.floor(Math.random() * 20) + 5,
      } : f));
    }, 2200);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    droppedFiles.forEach(f => simulateUpload(f.name));
  }, [simulateUpload]);

  const handleDemoUpload = () => {
    ['Merger_Agreement_v4.pdf', 'CapTable_Final.xlsx', 'Waterfall_Schedule.xlsx', 'Wire_Instructions.pdf'].forEach((name, i) => {
      setTimeout(() => simulateUpload(name), i * 400);
    });
  };

  const statusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading': return <Loader2 className="w-4 h-4 text-accent animate-spin" />;
      case 'parsing': return <Zap className="w-4 h-4 text-accent animate-pulse" />;
      case 'extracted': return <CheckCircle2 className="w-4 h-4 text-validated" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-blocking" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Document Ingestion</h2>
        <button
          onClick={handleDemoUpload}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Zap className="w-4 h-4" /> Run Demo Upload
        </button>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`pivt-card border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border'
        }`}
      >
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <p className="font-medium">Drop deal documents here</p>
        <p className="text-sm text-muted-foreground mt-1">
          PDF, XLSX, DOCX — Merger agreements, cap tables, wire instructions
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <span className="text-sm font-medium">{files.length} files</span>
            <span className="text-xs text-muted-foreground">
              {files.filter(f => f.status === 'extracted').length} extracted
            </span>
          </div>
          {files.map(file => (
            <motion.div key={file.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 flex items-center gap-4">
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{file.size}</p>
              </div>
              {file.entities && (
                <span className="text-xs text-muted-foreground">{file.entities} entities</span>
              )}
              {statusIcon(file.status)}
            </motion.div>
          ))}
        </div>
      )}

      {/* View extracted entities */}
      {files.some(f => f.status === 'extracted') && (
        <div className="pivt-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Extracted Entities</h3>
            <button
              onClick={() => setShowExtracted(!showExtracted)}
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <Eye className="w-3 h-3" /> {showExtracted ? 'Hide' : 'Show'} details
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'People', count: MOCK_ENTITIES.filter(e => e.type === 'Person').length },
              { label: 'Companies', count: MOCK_ENTITIES.filter(e => e.type === 'Company' || e.type === 'Fund').length },
              { label: 'Amounts', count: MOCK_ENTITIES.filter(e => e.type === 'Amount').length },
              { label: 'Other', count: MOCK_ENTITIES.filter(e => !['Person', 'Company', 'Fund', 'Amount'].includes(e.type)).length },
            ].map(cat => (
              <div key={cat.label} className="text-center p-3 rounded-lg bg-muted/50">
                <p className="font-mono text-lg font-semibold">{cat.count}</p>
                <p className="text-xs text-muted-foreground">{cat.label}</p>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {showExtracted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-3 border-t border-border">
                  {MOCK_ENTITIES.map((entity, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-muted/30">
                      <span className="w-16 text-xs text-accent font-medium uppercase">{entity.type}</span>
                      <span className="flex-1 font-medium">{entity.name}</span>
                      <span className="text-xs text-muted-foreground">{entity.source}</span>
                      <span className="font-mono text-xs text-validated">{(entity.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
