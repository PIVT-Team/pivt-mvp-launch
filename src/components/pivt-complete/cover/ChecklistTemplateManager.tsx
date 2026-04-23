import React, { useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';
import {
  GripVertical, Plus, FileStack, GitCompare, RotateCcw, Sparkles, BarChart3, CheckCircle2, Copy,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TemplateRow = Database['public']['Tables']['checklist_templates']['Row'];
type TemplateItemRow = Database['public']['Tables']['checklist_template_items']['Row'];
type OrgRow = Database['public']['Tables']['organizations']['Row'];

type RuleShape = {
  deal_type?: string;
  deal_size_above?: number;
  deal_size_below?: number;
};

type EditorItem = TemplateItemRow & {
  children: EditorItem[];
};

type AnalyticsRow = Database['public']['Functions']['get_checklist_template_analytics']['Returns'][number];
type DiffRow = Database['public']['Functions']['get_checklist_template_diff']['Returns'][number];

const CONDITION_TYPES = [
  'hsr_clearance', 'board_approval', 'third_party_consent', 'lender_consent', 'tax_clearance', 'employee_rollover', 'other',
];

const DEAL_TYPE_OPTIONS = [
  'Private Company Share Purchase', 'Private Equity Acquisition', 'Asset Acquisition', 'Merger', 'Leveraged Buyout', 'Growth Equity', 'Other',
];

const emptyRules: RuleShape = {};

function parseRules(value: TemplateItemRow['auto_apply_if'] | TemplateItemRow['auto_exclude_if']): RuleShape {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as unknown as RuleShape;
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function templateMinorVersion(version: string) {
  return version || 'Draft';
}

function buildTree(items: TemplateItemRow[]): EditorItem[] {
  const map = new Map<string, EditorItem>();
  const roots: EditorItem[] = [];

  items
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach((item) => map.set(item.id, { ...item, children: [] }));

  map.forEach((item) => {
    if (item.parent_id && map.has(item.parent_id)) map.get(item.parent_id)?.children.push(item);
    else roots.push(item);
  });

  roots.forEach((root) => root.children.sort((a, b) => a.sort_order - b.sort_order));
  return roots;
}

function flattenForSave(items: EditorItem[]) {
  const rows: Array<Pick<TemplateItemRow, 'id' | 'title' | 'description' | 'condition_type' | 'auto_apply_if' | 'auto_exclude_if' | 'parent_id' | 'sort_order' | 'template_id'>> = [];
  items.forEach((section, sectionIndex) => {
    rows.push({
      id: section.id,
      title: section.title,
      description: section.description,
      condition_type: section.condition_type,
      auto_apply_if: section.auto_apply_if,
      auto_exclude_if: section.auto_exclude_if,
      parent_id: null,
      sort_order: sectionIndex,
      template_id: section.template_id,
    });
    section.children.forEach((child, childIndex) => {
      rows.push({
        id: child.id,
        title: child.title,
        description: child.description,
        condition_type: child.condition_type,
        auto_apply_if: child.auto_apply_if,
        auto_exclude_if: child.auto_exclude_if,
        parent_id: section.id,
        sort_order: childIndex,
        template_id: child.template_id,
      });
    });
  });
  return rows;
}

const SortableRow: React.FC<{
  id: string;
  children: React.ReactNode;
}> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded-lg border border-border bg-background/60"
    >
      <div className="flex items-start gap-2 p-3">
        <button className="mt-1 text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
};

export interface ChecklistTemplateManagerProps {
  mode?: 'settings' | 'inline-selector';
  selectedTemplateId?: string | null;
  onSelectTemplate?: (template: TemplateRow | null) => void;
  dealTypeFilter?: string;
  dealValue?: number;
}

export const ChecklistTemplateManager: React.FC<ChecklistTemplateManagerProps> = ({
  mode = 'settings',
  selectedTemplateId,
  onSelectTemplate,
  dealTypeFilter,
  dealValue,
}) => {
  const { user } = useAuth();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRow | null>(null);
  const [items, setItems] = useState<EditorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsRow | null>(null);
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [compareToId, setCompareToId] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState('');

  const orgTemplates = useMemo(() => templates.filter((t) => t.org_id === selectedOrgId), [templates, selectedOrgId]);
  const filteredTemplates = useMemo(() => {
    if (!dealTypeFilter) return orgTemplates;
    return orgTemplates.filter((template) => template.deal_types?.includes(dealTypeFilter));
  }, [dealTypeFilter, orgTemplates]);
  const versionHistory = useMemo(() => {
    if (!selectedTemplate) return [];
    const base = selectedTemplate.base_template_id || selectedTemplate.id;
    return orgTemplates
      .filter((t) => (t.base_template_id || t.id) === base)
      .sort((a, b) => (a.version < b.version ? 1 : -1));
  }, [orgTemplates, selectedTemplate]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [{ data: membershipRows, error: membershipError }, { data: templateRows, error: templateError }] = await Promise.all([
      supabase
        .from('organization_memberships')
        .select('org_id, organizations(*)')
        .eq('user_id', user.id),
      supabase
        .from('checklist_templates')
        .select('*')
        .order('updated_at', { ascending: false }),
    ]);

    if (membershipError || templateError) {
      toast.error('Failed to load checklist templates.');
      setLoading(false);
      return;
    }

    const normalizedOrgs = (membershipRows || [])
      .map((row: any) => row.organizations)
      .filter(Boolean) as OrgRow[];
    setOrgs(normalizedOrgs);
    setTemplates((templateRows || []) as TemplateRow[]);

    const initialOrgId = selectedOrgId || normalizedOrgs[0]?.id || '';
    setSelectedOrgId(initialOrgId);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  useEffect(() => {
    if (!selectedOrgId || !templates.length) return;
    const preferred = templates.find((t) => t.id === selectedTemplateId) || filteredTemplates[0] || null;
    if (preferred) setSelectedTemplate(preferred);
  }, [selectedOrgId, templates, selectedTemplateId, filteredTemplates.length]);

  useEffect(() => {
    const loadTemplatePayload = async () => {
      if (!selectedTemplate) return;
      const { data: itemRows, error: itemsError } = await supabase
        .from('checklist_template_items')
        .select('*')
        .eq('template_id', selectedTemplate.id)
        .order('sort_order', { ascending: true });

      if (itemsError) {
        toast.error('Failed to load template items.');
        return;
      }

      setItems(buildTree((itemRows || []) as TemplateItemRow[]));

      const [{ data: analyticsRows }, diffResp] = await Promise.all([
        supabase.rpc('get_checklist_template_analytics', { _template_id: selectedTemplate.id }),
        compareToId
          ? supabase.rpc('get_checklist_template_diff', { _from_template_id: compareToId, _to_template_id: selectedTemplate.id })
          : Promise.resolve({ data: [] as DiffRow[] }),
      ]);

      setAnalytics((analyticsRows || [])[0] || null);
      setDiffRows((diffResp.data || []) as DiffRow[]);
      onSelectTemplate?.(selectedTemplate);
    };

    loadTemplatePayload();
  }, [selectedTemplate?.id, compareToId]);

  const updateSection = (sectionId: string, updater: (section: EditorItem) => EditorItem) => {
    setItems((current) => current.map((section) => (section.id === sectionId ? updater(section) : section)));
  };

  const addSection = () => {
    if (!selectedTemplate) return;
    setItems((current) => [...current, {
      id: crypto.randomUUID(),
      template_id: selectedTemplate.id,
      parent_id: null,
      title: 'New section',
      description: '',
      condition_type: null,
      auto_apply_if: {},
      auto_exclude_if: {},
      sort_order: current.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      children: [],
    }]);
  };

  const addItemToSection = (sectionId: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      children: [...section.children, {
        id: crypto.randomUUID(),
        template_id: section.template_id,
        parent_id: section.id,
        title: 'New checklist item',
        description: '',
        condition_type: 'other',
        auto_apply_if: {},
        auto_exclude_if: {},
        sort_order: section.children.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        children: [],
      }],
    }));
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    setItems((current) => arrayMove(current, oldIndex, newIndex));
  };

  const handleChildDragEnd = (sectionId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateSection(sectionId, (section) => {
      const oldIndex = section.children.findIndex((item) => item.id === active.id);
      const newIndex = section.children.findIndex((item) => item.id === over.id);
      return { ...section, children: arrayMove(section.children, oldIndex, newIndex) };
    });
  };

  const saveTemplate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    const rows = flattenForSave(items);

    const { error: deleteError } = await supabase.from('checklist_template_items').delete().eq('template_id', selectedTemplate.id);
    if (deleteError) {
      toast.error('Failed to save checklist template.');
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from('checklist_template_items').insert(rows as any);
    if (insertError) {
      toast.error('Failed to save checklist template items.');
      setSaving(false);
      return;
    }

    toast.success('Template saved.');
    setSaving(false);
    await load();
  };

  const publishTemplate = async () => {
    if (!selectedTemplate) return;
    const { error } = await supabase.from('checklist_templates').update({ is_published: true }).eq('id', selectedTemplate.id);
    if (error) return toast.error('Unable to publish template.');
    toast.success('Template published.');
    await load();
  };

  const createMinorVersion = async () => {
    if (!selectedTemplate) return;
    const { data, error } = await supabase.rpc('create_checklist_template_version', { _template_id: selectedTemplate.id });
    if (error || !data) return toast.error('Unable to create version.');
    toast.success('New minor version created.');
    const { data: nextTemplate } = await supabase.from('checklist_templates').select('*').eq('id', data).single();
    await load();
    if (nextTemplate) setSelectedTemplate(nextTemplate as TemplateRow);
  };

  const createTemplate = async () => {
    if (!selectedOrgId || !user?.id || !newTemplateName.trim()) return;
    const { data, error } = await supabase
      .from('checklist_templates')
      .insert({
        org_id: selectedOrgId,
        name: newTemplateName.trim(),
        deal_types: dealTypeFilter ? [dealTypeFilter] : [],
        version: `${new Date().getFullYear()}.1`,
        is_published: false,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (error || !data) return toast.error('Unable to create template.');
    toast.success('Template created.');
    setNewTemplateName('');
    await load();
    setSelectedTemplate(data as TemplateRow);
  };

  const rollbackToVersion = async () => {
    if (!compareToId || !selectedTemplate) return;
    const prior = versionHistory.find((v) => v.id === compareToId);
    if (!prior) return;
    setSelectedTemplate(prior);
    toast.success(`Loaded ${prior.version} for review.`);
  };

  const templateInsights = analytics ? [
    { label: 'Deals using template', value: analytics.deals_using_template },
    { label: 'Completion vs without template', value: `${analytics.avg_completion_rate_with_template}% / ${analytics.avg_completion_rate_without_template}%` },
  ] : [];

  const templateCountText = filteredTemplates.length === 1 ? '1 template' : `${filteredTemplates.length} templates`;

  if (loading) {
    return <div className="pivt-card p-6 text-sm text-muted-foreground">Loading checklist templates…</div>;
  }

  return (
    <div className="space-y-5">
      {mode === 'inline-selector' && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Apply a template?</p>
              <p className="text-xs text-muted-foreground">
                Your firm has {templateCountText}{dealTypeFilter ? ` for ${dealTypeFilter}` : ''}. Rules will auto-apply based on deal type and size.
              </p>
            </div>
            {dealValue ? <Badge variant="outline" className="text-[11px]">Deal size: ${dealValue.toLocaleString()}</Badge> : null}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="pivt-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Firm templates</h3>
                <p className="text-xs text-muted-foreground">Versioned standard checklists by organization.</p>
              </div>
              {mode === 'settings' && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> New</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create template</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                        <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                        <SelectContent>
                          {orgs.map((org) => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Kirkland PE Add-On Template" />
                      <Button onClick={createTemplate} className="w-full">Create template</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger><SelectValue placeholder="Choose firm" /></SelectTrigger>
              <SelectContent>
                {orgs.map((org) => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <ScrollArea className="h-[420px] pr-2">
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${selectedTemplate?.id === template.id ? 'border-accent bg-accent/5' : 'border-border bg-background/40 hover:bg-muted/40'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{template.name}</p>
                      {template.is_published ? <Badge variant="outline" className="text-[10px] text-validated border-validated/40">Published</Badge> : <Badge variant="outline" className="text-[10px]">Draft</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">v{templateMinorVersion(template.version)} · {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(template.deal_types || []).slice(0, 3).map((type) => <Badge key={type} variant="secondary" className="text-[10px]">{type}</Badge>)}
                    </div>
                  </button>
                ))}
                {!filteredTemplates.length && <p className="text-xs text-muted-foreground">No templates match this deal type yet.</p>}
              </div>
            </ScrollArea>
          </div>

          {selectedTemplate && (
            <div className="pivt-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileStack className="h-4 w-4 text-accent" />
                <h4 className="text-sm font-semibold">Version history</h4>
              </div>
              <Select value={compareToId} onValueChange={setCompareToId}>
                <SelectTrigger><SelectValue placeholder="Compare against…" /></SelectTrigger>
                <SelectContent>
                  {versionHistory.filter((version) => version.id !== selectedTemplate.id).map((version) => (
                    <SelectItem key={version.id} value={version.id}>v{version.version}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-2">
                {versionHistory.map((version) => (
                  <div key={version.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
                    <div>
                      <p className="font-medium text-foreground">v{version.version}</p>
                      <p className="text-muted-foreground">{formatDistanceToNow(new Date(version.updated_at), { addSuffix: true })}</p>
                    </div>
                    {selectedTemplate.id === version.id ? <Badge variant="outline">Current</Badge> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {selectedTemplate ? (
            <>
              <div className="pivt-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{selectedTemplate.name}</h3>
                      <Badge variant="outline">v{selectedTemplate.version}</Badge>
                      {selectedTemplate.is_published ? <Badge variant="outline" className="border-validated/40 text-validated">Published</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Author, version, and reuse your firm’s standard closing checklist inside PIVT.</p>
                  </div>
                  {mode === 'settings' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={createMinorVersion}><Copy className="h-3.5 w-3.5" /> New minor version</Button>
                      <Button variant="outline" size="sm" onClick={publishTemplate}><CheckCircle2 className="h-3.5 w-3.5" /> Publish</Button>
                      <Button size="sm" onClick={saveTemplate} disabled={saving}>{saving ? 'Saving…' : 'Save template'}</Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedTemplate(null); onSelectTemplate?.(null); }}>No template</Button>
                      <Button size="sm" onClick={() => onSelectTemplate?.(selectedTemplate)}>Use template</Button>
                    </div>
                  )}
                </div>
              </div>

              {mode === 'inline-selector' ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="pivt-card p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">Selected template summary</p>
                    <div className="flex flex-wrap gap-1">
                      {(selectedTemplate.deal_types || []).map((type) => <Badge key={type} variant="secondary" className="text-[10px]">{type}</Badge>)}
                    </div>
                    <p className="text-sm text-muted-foreground">This template will generate the initial closing checklist and users can modify items after application.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-background/40 p-3">
                        <p className="text-xs text-muted-foreground">Version</p>
                        <p className="mt-1 text-base font-semibold text-foreground">{selectedTemplate.version}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background/40 p-3">
                        <p className="text-xs text-muted-foreground">Deals using template</p>
                        <p className="mt-1 text-base font-semibold text-foreground">{analytics?.deals_using_template ?? 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="pivt-card p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">Why this fits</p>
                    <p className="text-sm text-muted-foreground">Rules are evaluated against the current deal type and size before checklist items are created.</p>
                    <pre className="overflow-auto rounded-lg border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">{stringifyJson({ deal_type: dealTypeFilter, deal_value: dealValue })}</pre>
                  </div>
                </div>
              ) : (
              <Tabs defaultValue="editor" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                  <TabsTrigger value="diff">Diff</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="space-y-4">
                  {mode === 'settings' && (
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={addSection}><Plus className="h-3.5 w-3.5" /> Add section</Button>
                    </div>
                  )}

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                    <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-4">
                        {items.map((section) => (
                          <SortableRow key={section.id} id={section.id}>
                            <div className="space-y-3">
                              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                                <div className="space-y-2">
                                  <Input value={section.title} onChange={(e) => updateSection(section.id, (current) => ({ ...current, title: e.target.value }))} disabled={mode !== 'settings'} />
                                  <Textarea value={section.description || ''} onChange={(e) => updateSection(section.id, (current) => ({ ...current, description: e.target.value }))} placeholder="Section description" disabled={mode !== 'settings'} />
                                </div>
                                <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                                  <p className="font-medium text-foreground">Auto-apply preview</p>
                                  <p className="mt-1">{section.children.length} items in this section.</p>
                                  {dealTypeFilter ? <p className="mt-1">Filtered for {dealTypeFilter}.</p> : null}
                                </div>
                              </div>

                              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => handleChildDragEnd(section.id, event)}>
                                <SortableContext items={section.children.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                                  <div className="space-y-2 pl-2 md:pl-4">
                                    {section.children.map((child) => {
                                      const applyRules = parseRules(child.auto_apply_if);
                                      const excludeRules = parseRules(child.auto_exclude_if);
                                      return (
                                        <SortableRow key={child.id} id={child.id}>
                                          <div className="space-y-3">
                                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                                              <div className="space-y-2">
                                                <Input value={child.title} onChange={(e) => updateSection(section.id, (current) => ({ ...current, children: current.children.map((item) => item.id === child.id ? { ...item, title: e.target.value } : item) }))} disabled={mode !== 'settings'} />
                                                <Textarea value={child.description || ''} onChange={(e) => updateSection(section.id, (current) => ({ ...current, children: current.children.map((item) => item.id === child.id ? { ...item, description: e.target.value } : item) }))} placeholder="Checklist item description" disabled={mode !== 'settings'} />
                                              </div>
                                              <div className="space-y-2">
                                                <Select value={child.condition_type || 'other'} onValueChange={(value) => updateSection(section.id, (current) => ({ ...current, children: current.children.map((item) => item.id === child.id ? { ...item, condition_type: value } : item) }))} disabled={mode !== 'settings'}>
                                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                                  <SelectContent>
                                                    {CONDITION_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                                  </SelectContent>
                                                </Select>
                                                <div className="grid grid-cols-2 gap-2">
                                                  <Select value={applyRules.deal_type || 'any'} onValueChange={(value) => updateSection(section.id, (current) => ({ ...current, children: current.children.map((item) => item.id === child.id ? { ...item, auto_apply_if: value === 'any' ? {} : { ...(parseRules(item.auto_apply_if)), deal_type: value } } : item) }))} disabled={mode !== 'settings'}>
                                                    <SelectTrigger><SelectValue placeholder="Apply deal type" /></SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="any">Any type</SelectItem>
                                                      {DEAL_TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                                    </SelectContent>
                                                  </Select>
                                                  <Input type="number" value={applyRules.deal_size_above || ''} onChange={(e) => updateSection(section.id, (current) => ({ ...current, children: current.children.map((item) => item.id === child.id ? { ...item, auto_apply_if: { ...(parseRules(item.auto_apply_if)), deal_size_above: e.target.value ? Number(e.target.value) : undefined } } : item) }))} placeholder="Size above" disabled={mode !== 'settings'} />
                                                </div>
                                                <Input type="number" value={excludeRules.deal_size_below || ''} onChange={(e) => updateSection(section.id, (current) => ({ ...current, children: current.children.map((item) => item.id === child.id ? { ...item, auto_exclude_if: { ...(parseRules(item.auto_exclude_if)), deal_size_below: e.target.value ? Number(e.target.value) : undefined } } : item) }))} placeholder="Exclude if size below" disabled={mode !== 'settings'} />
                                              </div>
                                            </div>
                                          </div>
                                        </SortableRow>
                                      );
                                    })}
                                  </div>
                                </SortableContext>
                              </DndContext>

                              {mode === 'settings' && (
                                <Button variant="outline" size="sm" onClick={() => addItemToSection(section.id)}><Plus className="h-3.5 w-3.5" /> Add item</Button>
                              )}
                            </div>
                          </SortableRow>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </TabsContent>

                <TabsContent value="diff">
                  <div className="pivt-card p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><GitCompare className="h-4 w-4 text-accent" /><h4 className="text-sm font-semibold">Version diff</h4></div>
                      {compareToId ? <Button variant="outline" size="sm" onClick={rollbackToVersion}><RotateCcw className="h-3.5 w-3.5" /> Load compared version</Button> : null}
                    </div>
                    {diffRows.length ? (
                      <div className="space-y-2">
                        {diffRows.map((row, index) => (
                          <div key={`${row.item_title}-${index}`} className="rounded-lg border border-border bg-background/40 p-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{row.change_type}</Badge>
                              <p className="text-sm font-medium text-foreground">{row.item_title}</p>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{row.previous_description || '—'} → {row.next_description || '—'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Select another version to see added, removed, and changed items.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="analytics">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="pivt-card p-4 space-y-4">
                      <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-accent" /><h4 className="text-sm font-semibold">Template analytics</h4></div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {templateInsights.map((insight) => (
                          <div key={insight.label} className="rounded-lg border border-border bg-background/40 p-3">
                            <p className="text-xs text-muted-foreground">{insight.label}</p>
                            <p className="mt-1 text-lg font-semibold text-foreground">{insight.value}</p>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-foreground">Most commonly added post-application</p>
                          <pre className="mt-2 overflow-auto rounded-lg border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">{stringifyJson(analytics?.most_commonly_added)}</pre>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground">Most commonly deleted</p>
                          <pre className="mt-2 overflow-auto rounded-lg border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">{stringifyJson(analytics?.most_commonly_deleted)}</pre>
                        </div>
                      </div>
                    </div>

                    <div className="pivt-card p-4 space-y-3">
                      <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /><h4 className="text-sm font-semibold">Template guidance</h4></div>
                      <p className="text-sm text-muted-foreground">Use analytics to fold recurring manual edits back into your standard checklist. Version bumps keep a clean audit trail while preserving prior deal provenance.</p>
                      <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                        Applied templates remain editable after generation. PIVT records the exact template version used on each deal for later review and rollback.
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              )}
            </>
          ) : (
            <div className="pivt-card p-6 text-sm text-muted-foreground">Select a template to manage its versions, checklist items, and analytics.</div>
          )}
        </div>
      </div>
    </div>
  );
};