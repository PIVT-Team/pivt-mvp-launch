import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminSupport } from "@/hooks/useAdminMetrics";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Inbox, Search, Clock, User, Mail, MessageSquare, Tag } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  resolved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "outline",
  normal: "secondary",
  high: "destructive",
  urgent: "destructive",
};

const CATEGORIES = [
  "other", "technical_bug", "onboarding_help", "newton_issue",
  "discrepancy_issue", "kyc_kyb_issue", "approval_issue",
  "payment_execution_issue", "billing",
];

export default function AdminSupport() {
  const { data: tickets, isLoading } = useAdminSupport();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [noteInput, setNoteInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filtered = (tickets ?? []).filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || t.message.toLowerCase().includes(q);
    }
    return true;
  });

  const selected = filtered.find(t => t.id === selectedId) ?? null;

  const updateTicket = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase
      .from("contact_submissions")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  };

  const addNote = async () => {
    if (!selected || !noteInput.trim()) return;
    const existing = selected.internal_notes ?? "";
    const timestamp = format(new Date(), "MMM d, yyyy h:mm a");
    const newNotes = `${existing}${existing ? "\n\n" : ""}[${timestamp}] ${noteInput.trim()}`;
    await updateTicket(selected.id, { internal_notes: newNotes });
    setNoteInput("");
  };

  return (
    <div className="flex h-screen">
      {/* Left Panel - Ticket List */}
      <div className="w-[400px] border-r border-border flex flex-col bg-background">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Support Inbox</h2>
            <Badge variant="secondary" className="ml-auto text-xs">{filtered.length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No tickets found</div>
          ) : (
            filtered.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => setSelectedId(ticket.id)}
                className={`w-full text-left p-4 border-b border-border/50 hover:bg-muted/50 transition-colors ${
                  selectedId === ticket.id ? "bg-muted/80" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground truncate">{ticket.name}</span>
                  <Badge variant={PRIORITY_COLORS[ticket.priority] as any ?? "outline"} className="text-[10px] ml-auto">
                    {ticket.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{ticket.email}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ticket.message}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`text-[10px] ${STATUS_COLORS[ticket.status]}`}>
                    {ticket.status.replace("_", " ")}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {format(new Date(ticket.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Ticket Detail */}
      <div className="flex-1 overflow-y-auto bg-muted/20">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select a ticket to view details</p>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{selected.email}</p>
              </div>
              <div className="flex gap-2">
                <Select
                  value={selected.status}
                  onValueChange={v => updateTicket(selected.id, {
                    status: v,
                    ...(v === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
                  })}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selected.priority}
                  onValueChange={v => updateTicket(selected.id, { priority: v })}
                >
                  <SelectTrigger className="h-8 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Clock, label: "Created", value: format(new Date(selected.created_at), "MMM d, yyyy h:mm a") },
                { icon: Tag, label: "Category", value: selected.category.replace(/_/g, " ") },
                { icon: User, label: "Assignee", value: selected.assignee ?? "Unassigned" },
                { icon: Mail, label: "Source", value: selected.source.replace(/_/g, " ") },
              ].map(m => (
                <Card key={m.label} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <m.icon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{m.label}</span>
                    </div>
                    <p className="text-xs font-medium text-foreground capitalize">{m.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Category */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Category</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selected.category}
                  onValueChange={v => updateTicket(selected.id, { category: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Message */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Message</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.message}</p>
              </CardContent>
            </Card>

            {/* Assignee */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Assign To</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Enter assignee name..."
                  defaultValue={selected.assignee ?? ""}
                  onBlur={e => {
                    if (e.target.value !== (selected.assignee ?? "")) {
                      updateTicket(selected.id, { assignee: e.target.value || null });
                    }
                  }}
                  className="h-8 text-sm"
                />
              </CardContent>
            </Card>

            {/* Internal Notes */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selected.internal_notes && (
                  <div className="bg-muted/50 rounded-md p-3 text-xs text-foreground whitespace-pre-wrap font-mono">
                    {selected.internal_notes}
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a note..."
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    className="text-sm min-h-[60px]"
                  />
                </div>
                <Button size="sm" onClick={addNote} disabled={!noteInput.trim()}>
                  Add Note
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
