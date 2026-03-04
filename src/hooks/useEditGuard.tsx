/**
 * Centralized Edit Guard for protected (demo / unowned) deals.
 *
 * Usage:
 *   const { isProtected, guardEdit } = useEditGuard();
 *   guardEdit('ADD_STAKEHOLDER', null, () => { openModal(); });
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { usePIVTStore } from '@/stores/pivtStore';
import { useAuth } from '@/contexts/AuthContext';
import { useDealOperations, RealDeal } from '@/hooks/useDealOperations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── Pure helpers (no hooks) ──

export function isProtectedDeal(
  deal: { is_demo?: boolean; visibility?: string; owner_id?: string | null } | null,
  userId: string | undefined,
  isDemoDealFromStore: boolean,
): boolean {
  // Demo deals from the Zustand store (atlas/beacon/cipher) are always protected
  if (isDemoDealFromStore) return true;
  if (!deal) return false;
  if (deal.is_demo) return true;
  if (deal.visibility === 'global_demo') return true;
  if (deal.owner_id && userId && deal.owner_id !== userId) return true;
  return false;
}

export function isEditingAllowed(
  deal: { is_demo?: boolean; visibility?: string; owner_id?: string | null } | null,
  userId: string | undefined,
  isDemoDealFromStore: boolean,
): boolean {
  return !isProtectedDeal(deal, userId, isDemoDealFromStore);
}

// ── Pending action replay ──

export type PendingAction = { type: string; payload?: any } | null;

const PENDING_ACTION_KEY = 'pivt_pending_action';

export function storePendingAction(action: PendingAction) {
  if (action) {
    sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
  }
}

export function consumePendingAction(): PendingAction {
  const raw = sessionStorage.getItem(PENDING_ACTION_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PENDING_ACTION_KEY);
  try { return JSON.parse(raw); } catch { return null; }
}

// ── Context ──

interface EditGuardContextValue {
  /** Whether the currently-viewed deal is protected from edits */
  isProtected: boolean;
  /** The loaded RealDeal for the current workspace (null for pure-demo) */
  realDeal: RealDeal | null;
  /** Guard a mutation. If protected, shows modal. Otherwise calls onProceed. */
  guardEdit: (actionType: string, payload: any, onProceed: () => void) => void;
}

const EditGuardContext = createContext<EditGuardContextValue>({
  isProtected: false,
  realDeal: null,
  guardEdit: (_a, _p, proceed) => proceed(),
});

export const useEditGuard = () => useContext(EditGuardContext);

// ── Provider (wrap around DealWorkspaceCover) ──

export const EditGuardProvider: React.FC<{
  realDeal: RealDeal | null;
  isDemoDeal: boolean;
  children: React.ReactNode;
}> = ({ realDeal, isDemoDeal, children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { duplicateDeal } = useDealOperations();
  const { setSelectedDealId, setActiveSection } = usePIVTStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const pendingRef = useRef<{ actionType: string; payload: any; onProceed: () => void } | null>(null);

  const _isProtected = isProtectedDeal(realDeal, user?.id, isDemoDeal);

  const guardEdit = useCallback((actionType: string, payload: any, onProceed: () => void) => {
    if (!_isProtected) {
      onProceed();
      return;
    }
    // Store pending action and show modal
    pendingRef.current = { actionType, payload, onProceed };
    setModalOpen(true);
  }, [_isProtected]);

  const handleDuplicate = async () => {
    // For pure-demo deals from the store we need the real DB deal id.
    // If realDeal is available use that, otherwise the demo deals don't have a real DB id
    // so duplication isn't possible for pure Zustand demo data.
    const dealId = realDeal?.id;
    if (!dealId) {
      toast({ title: 'Cannot duplicate', description: 'This demo deal has no database record to duplicate.', variant: 'destructive' });
      setModalOpen(false);
      return;
    }

    setDuplicating(true);
    const newDeal = await duplicateDeal(dealId);
    setDuplicating(false);

    if (newDeal) {
      // Store pending action for replay after redirect
      if (pendingRef.current) {
        storePendingAction({ type: pendingRef.current.actionType, payload: pendingRef.current.payload });
      }
      toast({ title: 'Deal duplicated', description: `"${newDeal.deal_name}" created — you can edit your copy now.` });
      setModalOpen(false);
      setSelectedDealId(newDeal.id);
      setActiveSection('workspace');
    }
  };

  return (
    <EditGuardContext.Provider value={{ isProtected: _isProtected, realDeal, guardEdit }}>
      {children}

      {/* Duplicate-to-edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-accent" />
              </div>
              <DialogTitle className="text-lg">This is a shared demo deal</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              To make changes, duplicate it into your workspace. Other users won't see your edits.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="flex-1 gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Copy className="w-4 h-4" />
              {duplicating ? 'Duplicating…' : 'Duplicate to edit'}
            </Button>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={duplicating}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </EditGuardContext.Provider>
  );
};
