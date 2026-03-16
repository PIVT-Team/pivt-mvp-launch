/**
 * Newton Composer — Action-oriented prompt input with suggested commands.
 */
import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Send, Sparkles, Users, FileText, DollarSign, Landmark,
  Receipt, CheckSquare, Shield, AlertTriangle, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUGGESTED_ACTIONS = [
  { icon: Users, label: 'Import stakeholder data from spreadsheet', category: 'intake' },
  { icon: Users, label: 'Send KYC/KYB requests to unverified stakeholders', category: 'verification' },
  { icon: FileText, label: 'Review agreements and extract payment obligations', category: 'documents' },
  { icon: DollarSign, label: 'Parse funds flow and flag discrepancies', category: 'funds_flow' },
  { icon: Landmark, label: 'Match wire instructions to payees', category: 'wire' },
  { icon: Receipt, label: 'Check whether all tax forms are complete', category: 'tax' },
  { icon: CheckSquare, label: 'Prepare approval requests', category: 'approvals' },
  { icon: CheckSquare, label: 'Send approval requests via DocuSign', category: 'approvals' },
  { icon: Shield, label: 'Is this deal ready for execution?', category: 'execution' },
  { icon: AlertTriangle, label: 'What are the blockers for closing?', category: 'analysis' },
] as const;

interface Props {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

export const NewtonComposer: React.FC<Props> = ({ onSubmit, disabled }) => {
  const [value, setValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="pivt-card border border-border overflow-hidden">
      {/* Suggestions */}
      {showSuggestions && (
        <div className="border-b border-border p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Suggested Actions</p>
          <div className="grid grid-cols-1 gap-1 max-h-[240px] overflow-y-auto">
            {SUGGESTED_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(action.label)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
              >
                <action.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent shrink-0" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className={cn(
            'p-2 rounded-lg transition-colors',
            showSuggestions ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-muted'
          )}
          title="Show suggested actions"
        >
          <Sparkles className="w-4 h-4" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => !value && setShowSuggestions(true)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Tell Newton what to do…"
          disabled={disabled}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="h-8 w-8 p-0"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
