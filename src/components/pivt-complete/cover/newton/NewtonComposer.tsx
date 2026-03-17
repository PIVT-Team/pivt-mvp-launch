/**
 * Newton Composer — Chat-first input with suggested actions and file upload trigger.
 * This is the primary interaction point for Newton.
 */
import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Send, Sparkles, Upload, Users, FileText, DollarSign, Landmark,
  Receipt, CheckSquare, Shield, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUGGESTED_ACTIONS = [
  { icon: Upload, label: 'Import stakeholder spreadsheet', category: 'intake' },
  { icon: DollarSign, label: 'Parse funds flow', category: 'funds_flow' },
  { icon: FileText, label: 'Review deal documents', category: 'documents' },
  { icon: Users, label: 'Generate KYC/KYB requests', category: 'verification' },
  { icon: CheckSquare, label: 'Prepare approval package', category: 'approvals' },
  { icon: Shield, label: 'Check closing readiness', category: 'execution' },
  { icon: Landmark, label: 'Match wire instructions', category: 'wire' },
  { icon: Receipt, label: 'Review tax forms', category: 'tax' },
  { icon: CheckSquare, label: 'Send approvals via DocuSign', category: 'approvals' },
  { icon: Sparkles, label: 'Prepare deal for closing', category: 'execution' },
] as const;

interface Props {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  onUploadClick?: () => void;
}

export const NewtonComposer: React.FC<Props> = ({ onSubmit, disabled, onUploadClick }) => {
  const [value, setValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (label: string) => {
    onSubmit(label);
    setValue('');
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="pivt-card border border-border overflow-hidden">
      {/* Input area */}
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-1 pt-1.5 shrink-0">
            {onUploadClick && (
              <button
                onClick={onUploadClick}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Upload files"
              >
                <Upload className="w-4 h-4" />
              </button>
            )}
          </div>
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => !value && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Tell Newton what to do…"
            disabled={disabled}
            rows={1}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 resize-none min-h-[36px] max-h-[120px] py-2 leading-snug"
            style={{ height: 'auto', overflow: 'hidden' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className="h-8 w-8 p-0 shrink-0 mt-0.5"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Suggested Actions */}
      {showSuggestions && !value && (
        <div className="border-t border-border p-3 pt-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Suggested Actions</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(action.label)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border hover:border-accent/30 hover:bg-accent/5 transition-all text-left group"
              >
                <action.icon className="w-3 h-3 text-muted-foreground group-hover:text-accent shrink-0" />
                <span className="text-[11px] text-muted-foreground group-hover:text-foreground whitespace-nowrap">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
