/**
 * Newton Input Bar — Bottom-sticky chat input with rotating placeholder.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLACEHOLDERS = [
  'Create a new deal…',
  'What\'s missing before close?',
  'Upload stakeholders…',
  'Show all deals…',
  'Generate KYC requests…',
  'Check closing readiness…',
];

interface Props {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  onUploadClick?: () => void;
  operationMode: 'global' | 'deal';
}

export const NewtonInputBar: React.FC<Props> = ({ onSubmit, disabled, onUploadClick, operationMode }) => {
  const [value, setValue] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Rotate placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.FormEvent) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
  };

  return (
    <div className="shrink-0 border-t border-border px-4 py-3 bg-card">
      <div className="flex items-end gap-2">
        {onUploadClick && (
          <button
            onClick={onUploadClick}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mb-0.5"
            title="Upload files"
          >
            <Upload className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            disabled={disabled}
            rows={1}
            className="w-full text-[13px] bg-muted/40 rounded-xl border border-border px-3.5 py-2.5 outline-none resize-none min-h-[40px] max-h-[120px] leading-snug placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-accent/30 focus:border-accent/30 transition-all"
            style={{ height: 'auto', overflow: 'hidden' }}
          />
        </div>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="h-9 w-9 p-0 shrink-0 rounded-xl bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--pivt-blue))] text-white border-0 hover:opacity-90 transition-opacity mb-0.5"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
