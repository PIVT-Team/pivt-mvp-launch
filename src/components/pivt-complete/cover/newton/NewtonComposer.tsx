/**
 * Newton Composer — Chat-first input with suggested actions and file upload trigger.
 * Primary actions visible, rest under "More actions" dropdown.
 */
import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Send, Sparkles, Upload, Users, FileText, DollarSign, Landmark,
  Receipt, CheckSquare, Shield, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const PRIMARY_ACTIONS = [
  { icon: Upload, label: 'Import stakeholder spreadsheet', category: 'intake' },
  { icon: Users, label: 'Generate KYC/KYB requests', category: 'verification' },
  { icon: DollarSign, label: 'Parse funds flow', category: 'funds_flow' },
  { icon: CheckSquare, label: 'Prepare approval package', category: 'approvals' },
] as const;

const MORE_ACTIONS = [
  { icon: FileText, label: 'Review deal documents', category: 'documents' },
  { icon: Landmark, label: 'Match wire instructions', category: 'wire' },
  { icon: Receipt, label: 'Review tax forms', category: 'tax' },
  { icon: CheckSquare, label: 'Send approvals via DocuSign', category: 'approvals' },
  { icon: Shield, label: 'Check closing readiness', category: 'execution' },
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
  const [showMore, setShowMore] = useState(false);
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
    setShowMore(false);
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
      <div className="p-4">
        <div className="flex items-start gap-3">
          {onUploadClick && (
            <button
              onClick={onUploadClick}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors mt-0.5"
              title="Upload files"
            >
              <Upload className="w-4 h-4" />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => !value && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Newton to work on this deal…"
            disabled={disabled}
            rows={1}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40 resize-none min-h-[36px] max-h-[120px] py-2 leading-relaxed"
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
            className="h-9 w-9 p-0 shrink-0 rounded-xl"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Suggested Actions — cleaner chips */}
      {showSuggestions && !value && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {PRIMARY_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(action.label)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:border-accent/20 hover:bg-accent/3 transition-all text-left group"
              >
                <action.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent shrink-0" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground whitespace-nowrap">{action.label}</span>
              </button>
            ))}

            {/* More actions toggle */}
            <button
              onClick={() => setShowMore(!showMore)}
              className={cn(
                'flex items-center gap-1 px-3 py-2 rounded-xl border transition-all text-left',
                showMore ? 'border-accent/20 bg-accent/5 text-foreground' : 'border-border text-muted-foreground hover:border-accent/20 hover:text-foreground'
              )}
            >
              <span className="text-xs whitespace-nowrap">More</span>
              <ChevronDown className={cn('w-3 h-3 transition-transform', showMore && 'rotate-180')} />
            </button>
          </div>

          {/* Expanded more actions */}
          {showMore && (
            <div className="flex flex-wrap gap-2 mt-2.5 pt-2.5 border-t border-border/50">
              {MORE_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(action.label)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 hover:border-accent/20 hover:bg-accent/3 transition-all text-left group"
                >
                  <action.icon className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-accent shrink-0" />
                  <span className="text-xs text-muted-foreground/70 group-hover:text-foreground whitespace-nowrap">{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
