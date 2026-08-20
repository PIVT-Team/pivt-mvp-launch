export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          company: string
          contact_email: string
          created_at: string
          full_name: string
          id: string
          message: string | null
          position: string
          source: string
          status: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          company: string
          contact_email: string
          created_at?: string
          full_name: string
          id?: string
          message?: string | null
          position: string
          source?: string
          status?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          company?: string
          contact_email?: string
          created_at?: string
          full_name?: string
          id?: string
          message?: string | null
          position?: string
          source?: string
          status?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_allowlist: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          role: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          role?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          role?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          email: string | null
          id: string
          ip_info: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          email?: string | null
          id?: string
          ip_info?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          email?: string | null
          id?: string
          ip_info?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_insights: {
        Row: {
          body: string
          category: string
          confidence: number | null
          created_at: string
          evidence: string | null
          generated_at: string
          id: string
          insight_type: string
          is_read: boolean
          priority_rank: number | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          suggested_action: string | null
          target_org: string | null
          target_user_id: string | null
          title: string
        }
        Insert: {
          body: string
          category?: string
          confidence?: number | null
          created_at?: string
          evidence?: string | null
          generated_at?: string
          id?: string
          insight_type?: string
          is_read?: boolean
          priority_rank?: number | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          suggested_action?: string | null
          target_org?: string | null
          target_user_id?: string | null
          title: string
        }
        Update: {
          body?: string
          category?: string
          confidence?: number | null
          created_at?: string
          evidence?: string | null
          generated_at?: string
          id?: string
          insight_type?: string
          is_read?: boolean
          priority_rank?: number | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          suggested_action?: string | null
          target_org?: string | null
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_type: string
          agent_version: string
          completed_at: string | null
          created_at: string
          critical_count: number
          deal_id: string
          duration_ms: number | null
          error_message: string | null
          finding_count: number
          findings: Json | null
          id: string
          input_snapshot: Json | null
          started_at: string | null
          status: string
          summary_text: string | null
          triggered_by: string | null
        }
        Insert: {
          agent_type?: string
          agent_version?: string
          completed_at?: string | null
          created_at?: string
          critical_count?: number
          deal_id: string
          duration_ms?: number | null
          error_message?: string | null
          finding_count?: number
          findings?: Json | null
          id?: string
          input_snapshot?: Json | null
          started_at?: string | null
          status?: string
          summary_text?: string | null
          triggered_by?: string | null
        }
        Update: {
          agent_type?: string
          agent_version?: string
          completed_at?: string | null
          created_at?: string
          critical_count?: number
          deal_id?: string
          duration_ms?: number | null
          error_message?: string | null
          finding_count?: number
          findings?: Json | null
          id?: string
          input_snapshot?: Json | null
          started_at?: string | null
          status?: string
          summary_text?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          deal_id: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          deal_id?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          deal_id?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          deal_id: string | null
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          deal_id?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          deal_id?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_events: {
        Row: {
          approximate_location: string | null
          browser: string | null
          created_at: string
          device_type: string | null
          email: string | null
          event_type: string
          id: string
          ip_hash: string | null
          login_method: string | null
          metadata: Json | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          approximate_location?: string | null
          browser?: string | null
          created_at?: string
          device_type?: string | null
          email?: string | null
          event_type: string
          id?: string
          ip_hash?: string | null
          login_method?: string | null
          metadata?: Json | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          approximate_location?: string | null
          browser?: string | null
          created_at?: string
          device_type?: string | null
          email?: string | null
          event_type?: string
          id?: string
          ip_hash?: string | null
          login_method?: string | null
          metadata?: Json | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cap_table_entries: {
        Row: {
          confidence_status: string
          created_at: string
          created_by_source: string
          created_by_user_id: string | null
          deal_id: string
          email: string | null
          escrow_holdback: number | null
          fees: number | null
          id: string
          last_updated_by_source: string
          last_updated_by_user_id: string | null
          locked: boolean
          locked_reason: string | null
          needs_review: boolean
          net_payout: number | null
          ownership_pct: number
          payout_amount: number
          role: string
          shareholder_name: string
          stakeholder_type: string
          verification_completed_at: string | null
          verification_last_sent_at: string | null
          verification_provider: string | null
          verification_reference_id: string | null
          verification_rejection_reason: string | null
          verification_requested_at: string | null
          verification_status: string
        }
        Insert: {
          confidence_status?: string
          created_at?: string
          created_by_source?: string
          created_by_user_id?: string | null
          deal_id: string
          email?: string | null
          escrow_holdback?: number | null
          fees?: number | null
          id?: string
          last_updated_by_source?: string
          last_updated_by_user_id?: string | null
          locked?: boolean
          locked_reason?: string | null
          needs_review?: boolean
          net_payout?: number | null
          ownership_pct?: number
          payout_amount?: number
          role?: string
          shareholder_name: string
          stakeholder_type?: string
          verification_completed_at?: string | null
          verification_last_sent_at?: string | null
          verification_provider?: string | null
          verification_reference_id?: string | null
          verification_rejection_reason?: string | null
          verification_requested_at?: string | null
          verification_status?: string
        }
        Update: {
          confidence_status?: string
          created_at?: string
          created_by_source?: string
          created_by_user_id?: string | null
          deal_id?: string
          email?: string | null
          escrow_holdback?: number | null
          fees?: number | null
          id?: string
          last_updated_by_source?: string
          last_updated_by_user_id?: string | null
          locked?: boolean
          locked_reason?: string | null
          needs_review?: boolean
          net_payout?: number | null
          ownership_pct?: number
          payout_amount?: number
          role?: string
          shareholder_name?: string
          stakeholder_type?: string
          verification_completed_at?: string | null
          verification_last_sent_at?: string | null
          verification_provider?: string | null
          verification_reference_id?: string | null
          verification_rejection_reason?: string | null
          verification_requested_at?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cap_table_entries_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          auto_apply_if: Json
          auto_exclude_if: Json
          condition_type: string | null
          created_at: string
          description: string | null
          id: string
          parent_id: string | null
          sort_order: number
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          auto_apply_if?: Json
          auto_exclude_if?: Json
          condition_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          parent_id?: string | null
          sort_order?: number
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          auto_apply_if?: Json
          auto_exclude_if?: Json
          condition_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          parent_id?: string | null
          sort_order?: number
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          base_template_id: string | null
          created_at: string
          created_by: string
          deal_types: string[]
          id: string
          is_published: boolean
          name: string
          org_id: string
          previous_version_id: string | null
          updated_at: string
          version: string
        }
        Insert: {
          base_template_id?: string | null
          created_at?: string
          created_by: string
          deal_types?: string[]
          id?: string
          is_published?: boolean
          name: string
          org_id: string
          previous_version_id?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          base_template_id?: string | null
          created_at?: string
          created_by?: string
          deal_types?: string[]
          id?: string
          is_published?: boolean
          name?: string
          org_id?: string
          previous_version_id?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_base_template_id_fkey"
            columns: ["base_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      closing_checklist_items: {
        Row: {
          category: string
          created_at: string
          deal_id: string
          deleted_from_template: boolean
          description: string | null
          due_date: string | null
          entity_id: string | null
          id: string
          parent_id: string | null
          regulatory_condition_id: string | null
          responsible_party_id: string | null
          satisfied_at: string | null
          satisfied_by: string | null
          sort_order: number
          source: string
          status: string
          supporting_document_id: string | null
          template_item_id: string | null
          template_version: string | null
          title: string
          updated_at: string
          waiver_justification: string | null
          was_added_post_template: boolean
        }
        Insert: {
          category?: string
          created_at?: string
          deal_id: string
          deleted_from_template?: boolean
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          parent_id?: string | null
          regulatory_condition_id?: string | null
          responsible_party_id?: string | null
          satisfied_at?: string | null
          satisfied_by?: string | null
          sort_order?: number
          source?: string
          status?: string
          supporting_document_id?: string | null
          template_item_id?: string | null
          template_version?: string | null
          title: string
          updated_at?: string
          waiver_justification?: string | null
          was_added_post_template?: boolean
        }
        Update: {
          category?: string
          created_at?: string
          deal_id?: string
          deleted_from_template?: boolean
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          parent_id?: string | null
          regulatory_condition_id?: string | null
          responsible_party_id?: string | null
          satisfied_at?: string | null
          satisfied_by?: string | null
          sort_order?: number
          source?: string
          status?: string
          supporting_document_id?: string | null
          template_item_id?: string | null
          template_version?: string | null
          title?: string
          updated_at?: string
          waiver_justification?: string | null
          was_added_post_template?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "closing_checklist_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_checklist_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_from_id"]
          },
          {
            foreignKeyName: "closing_checklist_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_to_id"]
          },
          {
            foreignKeyName: "closing_checklist_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_checklist_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "closing_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_checklist_items_regulatory_condition_id_fkey"
            columns: ["regulatory_condition_id"]
            isOneToOne: true
            referencedRelation: "regulatory_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_checklist_items_responsible_party_id_fkey"
            columns: ["responsible_party_id"]
            isOneToOne: false
            referencedRelation: "deal_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_checklist_items_supporting_document_id_fkey"
            columns: ["supporting_document_id"]
            isOneToOne: false
            referencedRelation: "deal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_checklist_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          mentioned_user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          mentioned_user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          mentioned_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "deal_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_checks: {
        Row: {
          check_type: Database["public"]["Enums"]["compliance_check_type"]
          created_at: string
          deal_id: string
          document_id: string | null
          id: string
          notes: string | null
          party_id: string
          review_timestamp: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["compliance_check_status"]
          updated_at: string
        }
        Insert: {
          check_type: Database["public"]["Enums"]["compliance_check_type"]
          created_at?: string
          deal_id: string
          document_id?: string | null
          id?: string
          notes?: string | null
          party_id: string
          review_timestamp?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["compliance_check_status"]
          updated_at?: string
        }
        Update: {
          check_type?: Database["public"]["Enums"]["compliance_check_type"]
          created_at?: string
          deal_id?: string
          document_id?: string | null
          id?: string
          notes?: string | null
          party_id?: string
          review_timestamp?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["compliance_check_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_checks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_checks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      conditions: {
        Row: {
          at_risk: boolean
          at_risk_reason: string | null
          created_at: string
          deal_id: string
          description: string | null
          due_date: string | null
          evidence_document_id: string | null
          evidence_note: string | null
          id: string
          owner_id: string | null
          owner_name: string | null
          satisfied_at: string | null
          satisfied_by: string | null
          status: Database["public"]["Enums"]["condition_status"]
          title: string
          updated_at: string
          waiver_justification: string | null
        }
        Insert: {
          at_risk?: boolean
          at_risk_reason?: string | null
          created_at?: string
          deal_id: string
          description?: string | null
          due_date?: string | null
          evidence_document_id?: string | null
          evidence_note?: string | null
          id?: string
          owner_id?: string | null
          owner_name?: string | null
          satisfied_at?: string | null
          satisfied_by?: string | null
          status?: Database["public"]["Enums"]["condition_status"]
          title: string
          updated_at?: string
          waiver_justification?: string | null
        }
        Update: {
          at_risk?: boolean
          at_risk_reason?: string | null
          created_at?: string
          deal_id?: string
          description?: string | null
          due_date?: string | null
          evidence_document_id?: string | null
          evidence_note?: string | null
          id?: string
          owner_id?: string | null
          owner_name?: string | null
          satisfied_at?: string | null
          satisfied_by?: string | null
          status?: Database["public"]["Enums"]["condition_status"]
          title?: string
          updated_at?: string
          waiver_justification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conditions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conditions_evidence_document_id_fkey"
            columns: ["evidence_document_id"]
            isOneToOne: false
            referencedRelation: "deal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      consideration_records: {
        Row: {
          created_at: string
          deal_id: string
          evidence_ref: string | null
          id: string
          recipient_id: string
          status: Database["public"]["Enums"]["consideration_status"]
          terms: Json
          type: Database["public"]["Enums"]["consideration_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          evidence_ref?: string | null
          id?: string
          recipient_id: string
          status?: Database["public"]["Enums"]["consideration_status"]
          terms?: Json
          type: Database["public"]["Enums"]["consideration_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          evidence_ref?: string | null
          id?: string
          recipient_id?: string
          status?: Database["public"]["Enums"]["consideration_status"]
          terms?: Json
          type?: Database["public"]["Enums"]["consideration_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consideration_records_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          assignee: string | null
          category: string
          created_at: string
          email: string
          id: string
          internal_notes: string | null
          message: string
          name: string
          priority: string
          related_deal_id: string | null
          related_user_id: string | null
          resolved_at: string | null
          source: string
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          category?: string
          created_at?: string
          email: string
          id?: string
          internal_notes?: string | null
          message: string
          name: string
          priority?: string
          related_deal_id?: string | null
          related_user_id?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          category?: string
          created_at?: string
          email?: string
          id?: string
          internal_notes?: string | null
          message?: string
          name?: string
          priority?: string
          related_deal_id?: string | null
          related_user_id?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      contract_documents: {
        Row: {
          created_at: string
          deal_id: string
          doc_type: Database["public"]["Enums"]["contract_doc_type"]
          document_role: string | null
          extracted_fields: Json | null
          extraction_confidence: number | null
          file_url: string | null
          filename: string
          id: string
          is_current: boolean
          is_required: boolean | null
          requirement_group: string | null
          status: Database["public"]["Enums"]["contract_doc_status"]
          supersedes_id: string | null
          text_content: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          deal_id: string
          doc_type?: Database["public"]["Enums"]["contract_doc_type"]
          document_role?: string | null
          extracted_fields?: Json | null
          extraction_confidence?: number | null
          file_url?: string | null
          filename: string
          id?: string
          is_current?: boolean
          is_required?: boolean | null
          requirement_group?: string | null
          status?: Database["public"]["Enums"]["contract_doc_status"]
          supersedes_id?: string | null
          text_content?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          deal_id?: string
          doc_type?: Database["public"]["Enums"]["contract_doc_type"]
          document_role?: string | null
          extracted_fields?: Json | null
          extraction_confidence?: number | null
          file_url?: string | null
          filename?: string
          id?: string
          is_current?: boolean
          is_required?: boolean | null
          requirement_group?: string | null
          status?: Database["public"]["Enums"]["contract_doc_status"]
          supersedes_id?: string | null
          text_content?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      counterparty_invitations: {
        Row: {
          accepted_at: string | null
          counterparty_profile_id: string | null
          created_at: string
          deal_id: string
          email: string
          expires_at: string | null
          firm_name_snapshot: string | null
          id: string
          invite_token: string
          invited_by: string
          role_type: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          counterparty_profile_id?: string | null
          created_at?: string
          deal_id: string
          email: string
          expires_at?: string | null
          firm_name_snapshot?: string | null
          id?: string
          invite_token: string
          invited_by: string
          role_type?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          counterparty_profile_id?: string | null
          created_at?: string
          deal_id?: string
          email?: string
          expires_at?: string | null
          firm_name_snapshot?: string | null
          id?: string
          invite_token?: string
          invited_by?: string
          role_type?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "counterparty_invitations_counterparty_profile_id_fkey"
            columns: ["counterparty_profile_id"]
            isOneToOne: false
            referencedRelation: "counterparty_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counterparty_invitations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      counterparty_kyc_documents: {
        Row: {
          counterparty_profile_id: string
          created_at: string
          deal_id: string | null
          document_type: string
          file_path: string
          id: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          counterparty_profile_id: string
          created_at?: string
          deal_id?: string | null
          document_type: string
          file_path: string
          id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          counterparty_profile_id?: string
          created_at?: string
          deal_id?: string | null
          document_type?: string
          file_path?: string
          id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counterparty_kyc_documents_counterparty_profile_id_fkey"
            columns: ["counterparty_profile_id"]
            isOneToOne: false
            referencedRelation: "counterparty_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counterparty_kyc_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      counterparty_profiles: {
        Row: {
          created_at: string
          deals_participated: number
          display_name: string | null
          firm_name: string | null
          id: string
          kyc_status: string
          kyc_verified_at: string | null
          role_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deals_participated?: number
          display_name?: string | null
          firm_name?: string | null
          id?: string
          kyc_status?: string
          kyc_verified_at?: string | null
          role_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deals_participated?: number
          display_name?: string | null
          firm_name?: string | null
          id?: string
          kyc_status?: string
          kyc_verified_at?: string | null
          role_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      deal_approvals: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean
          approval_side: string
          approval_type: string | null
          approved_doc_version: number | null
          approved_snapshot_hash: string | null
          approver_email: string | null
          approver_name: string | null
          approver_role: string | null
          blocker_reason: string | null
          comment: string | null
          completed_at: string | null
          created_at: string
          deal_id: string
          declined_at: string | null
          delivery_method: string | null
          envelope_id: string | null
          expired_at: string | null
          id: string
          invalidated_at: string | null
          invalidated_by_document_id: string | null
          invalidated_reason: string | null
          last_reminder_at: string | null
          linked_checklist_item_id: string | null
          linked_condition_id: string | null
          packet_name: string | null
          packet_type: string | null
          recipient_id_ds: string | null
          related_document_id: string | null
          reminder_count: number | null
          required: boolean | null
          sent_at: string | null
          signed_document_url: string | null
          source_document_id: string | null
          status: string
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean
          approval_side: string
          approval_type?: string | null
          approved_doc_version?: number | null
          approved_snapshot_hash?: string | null
          approver_email?: string | null
          approver_name?: string | null
          approver_role?: string | null
          blocker_reason?: string | null
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          deal_id: string
          declined_at?: string | null
          delivery_method?: string | null
          envelope_id?: string | null
          expired_at?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_by_document_id?: string | null
          invalidated_reason?: string | null
          last_reminder_at?: string | null
          linked_checklist_item_id?: string | null
          linked_condition_id?: string | null
          packet_name?: string | null
          packet_type?: string | null
          recipient_id_ds?: string | null
          related_document_id?: string | null
          reminder_count?: number | null
          required?: boolean | null
          sent_at?: string | null
          signed_document_url?: string | null
          source_document_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean
          approval_side?: string
          approval_type?: string | null
          approved_doc_version?: number | null
          approved_snapshot_hash?: string | null
          approver_email?: string | null
          approver_name?: string | null
          approver_role?: string | null
          blocker_reason?: string | null
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          deal_id?: string
          declined_at?: string | null
          delivery_method?: string | null
          envelope_id?: string | null
          expired_at?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_by_document_id?: string | null
          invalidated_reason?: string | null
          last_reminder_at?: string | null
          linked_checklist_item_id?: string | null
          linked_condition_id?: string | null
          packet_name?: string | null
          packet_type?: string | null
          recipient_id_ds?: string | null
          related_document_id?: string | null
          reminder_count?: number | null
          required?: boolean | null
          sent_at?: string | null
          signed_document_url?: string | null
          source_document_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_approvals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_approvals_invalidated_by_document_id_fkey"
            columns: ["invalidated_by_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_approvals_linked_checklist_item_id_fkey"
            columns: ["linked_checklist_item_id"]
            isOneToOne: false
            referencedRelation: "closing_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_approvals_linked_condition_id_fkey"
            columns: ["linked_condition_id"]
            isOneToOne: false
            referencedRelation: "conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_approvals_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_change_events: {
        Row: {
          blocks_closing: boolean
          change_type: string
          created_at: string
          deal_id: string
          details: Json
          from_version: number | null
          id: string
          object_id: string | null
          object_type: string | null
          recommended_action: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source_document_id: string | null
          source_label: string | null
          status: string
          title: string
          to_version: number | null
          what_changed: string
          why_it_matters: string | null
        }
        Insert: {
          blocks_closing?: boolean
          change_type: string
          created_at?: string
          deal_id: string
          details?: Json
          from_version?: number | null
          id?: string
          object_id?: string | null
          object_type?: string | null
          recommended_action?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_document_id?: string | null
          source_label?: string | null
          status?: string
          title: string
          to_version?: number | null
          what_changed: string
          why_it_matters?: string | null
        }
        Update: {
          blocks_closing?: boolean
          change_type?: string
          created_at?: string
          deal_id?: string
          details?: Json
          from_version?: number | null
          id?: string
          object_id?: string | null
          object_type?: string | null
          recommended_action?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_document_id?: string | null
          source_label?: string | null
          status?: string
          title?: string
          to_version?: number | null
          what_changed?: string
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_change_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_change_events_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_comments: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          deal_id: string
          id: string
          parent_id: string | null
          section_context: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          deal_id: string
          id?: string
          parent_id?: string | null
          section_context?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          deal_id?: string
          id?: string
          parent_id?: string | null
          section_context?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "deal_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_documents: {
        Row: {
          created_at: string
          deal_id: string
          doc_type: string | null
          doc_type_confidence: number | null
          extracted_fields: Json | null
          extracted_text: string | null
          file_name: string
          file_path: string | null
          file_size: number
          id: string
          mime_type: string | null
          page_count: number | null
          status: string
          updated_at: string
          uploaded_by: string | null
          validation_flags: Json | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          doc_type?: string | null
          doc_type_confidence?: number | null
          extracted_fields?: Json | null
          extracted_text?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number
          id?: string
          mime_type?: string | null
          page_count?: number | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          validation_flags?: Json | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          doc_type?: string | null
          doc_type_confidence?: number | null
          extracted_fields?: Json | null
          extracted_text?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number
          id?: string
          mime_type?: string | null
          page_count?: number | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          validation_flags?: Json | null
        }
        Relationships: []
      }
      deal_events: {
        Row: {
          actor_id: string | null
          chain_sequence: number | null
          created_at: string
          deal_id: string
          event_hash: string | null
          event_type: string
          id: string
          new_state: string | null
          payload: Json
          prev_hash: string | null
          previous_state: string | null
        }
        Insert: {
          actor_id?: string | null
          chain_sequence?: number | null
          created_at?: string
          deal_id: string
          event_hash?: string | null
          event_type: string
          id?: string
          new_state?: string | null
          payload?: Json
          prev_hash?: string | null
          previous_state?: string | null
        }
        Update: {
          actor_id?: string | null
          chain_sequence?: number | null
          created_at?: string
          deal_id?: string
          event_hash?: string | null
          event_type?: string
          id?: string
          new_state?: string | null
          payload?: Json
          prev_hash?: string | null
          previous_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_members: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          role: Database["public"]["Enums"]["deal_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          role: Database["public"]["Enums"]["deal_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          role?: Database["public"]["Enums"]["deal_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_members_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_participants: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          party_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          party_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          party_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_participants_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_parties: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          organization_id: string
          party_type: Database["public"]["Enums"]["party_type"]
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          organization_id: string
          party_type: Database["public"]["Enums"]["party_type"]
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          organization_id?: string
          party_type?: Database["public"]["Enums"]["party_type"]
        }
        Relationships: [
          {
            foreignKeyName: "deal_parties_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_parties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_requirements: {
        Row: {
          ai_ambiguity: string | null
          ai_confidence: number | null
          blocks_closing: boolean
          category: string
          counterparty_email: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          entity_id: string | null
          evidence_doc_id: string | null
          id: string
          internal_owner_id: string | null
          priority: string
          requirement_kind: string
          requirement_type: string | null
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          satisfied_at: string | null
          satisfied_by: string | null
          signatory_capacity: string | null
          signatory_name: string | null
          signature_pages: Json
          signing_party: string | null
          sort_order: number
          source: string
          source_ref: Json
          status: string
          title: string
          trigger_event: string | null
          updated_at: string
        }
        Insert: {
          ai_ambiguity?: string | null
          ai_confidence?: number | null
          blocks_closing?: boolean
          category?: string
          counterparty_email?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          evidence_doc_id?: string | null
          id?: string
          internal_owner_id?: string | null
          priority?: string
          requirement_kind: string
          requirement_type?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          satisfied_at?: string | null
          satisfied_by?: string | null
          signatory_capacity?: string | null
          signatory_name?: string | null
          signature_pages?: Json
          signing_party?: string | null
          sort_order?: number
          source?: string
          source_ref?: Json
          status?: string
          title: string
          trigger_event?: string | null
          updated_at?: string
        }
        Update: {
          ai_ambiguity?: string | null
          ai_confidence?: number | null
          blocks_closing?: boolean
          category?: string
          counterparty_email?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          evidence_doc_id?: string | null
          id?: string
          internal_owner_id?: string | null
          priority?: string
          requirement_kind?: string
          requirement_type?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          satisfied_at?: string | null
          satisfied_by?: string | null
          signatory_capacity?: string | null
          signatory_name?: string | null
          signature_pages?: Json
          signing_party?: string | null
          sort_order?: number
          source?: string
          source_ref?: Json
          status?: string
          title?: string
          trigger_event?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_requirements_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_requirements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_from_id"]
          },
          {
            foreignKeyName: "deal_requirements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_to_id"]
          },
          {
            foreignKeyName: "deal_requirements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_requirements_evidence_doc_id_fkey"
            columns: ["evidence_doc_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_settings: {
        Row: {
          created_at: string
          deal_id: string
          enforce_separation_of_duties: boolean
          id: string
          require_dual_execution: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          enforce_separation_of_duties?: boolean
          id?: string
          require_dual_execution?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          enforce_separation_of_duties?: boolean
          id?: string
          require_dual_execution?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_settings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          role: Database["public"]["Enums"]["deal_execution_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          role: Database["public"]["Enums"]["deal_execution_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          role?: Database["public"]["Enums"]["deal_execution_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_user_roles_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          blocked_reason: string | null
          buyer: string | null
          closing_date: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          deal_kind: Database["public"]["Enums"]["deal_kind"]
          deal_name: string
          deal_number: string
          deal_state: Database["public"]["Enums"]["deal_state"]
          deal_type: string | null
          deal_value: number
          deleted_at: string | null
          deleted_by: string | null
          escrow_amount: number | null
          id: string
          is_demo: boolean
          jurisdiction: string | null
          org_id: string | null
          owner_id: string | null
          sector: string | null
          seed_key: string | null
          seller: string | null
          signing_date: string | null
          state_updated_at: string
          status: string
          target_company: string | null
          template_blueprint: Json | null
          template_id: string | null
          template_version: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          blocked_reason?: string | null
          buyer?: string | null
          closing_date?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deal_kind?: Database["public"]["Enums"]["deal_kind"]
          deal_name: string
          deal_number: string
          deal_state?: Database["public"]["Enums"]["deal_state"]
          deal_type?: string | null
          deal_value?: number
          deleted_at?: string | null
          deleted_by?: string | null
          escrow_amount?: number | null
          id?: string
          is_demo?: boolean
          jurisdiction?: string | null
          org_id?: string | null
          owner_id?: string | null
          sector?: string | null
          seed_key?: string | null
          seller?: string | null
          signing_date?: string | null
          state_updated_at?: string
          status?: string
          target_company?: string | null
          template_blueprint?: Json | null
          template_id?: string | null
          template_version?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          blocked_reason?: string | null
          buyer?: string | null
          closing_date?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deal_kind?: Database["public"]["Enums"]["deal_kind"]
          deal_name?: string
          deal_number?: string
          deal_state?: Database["public"]["Enums"]["deal_state"]
          deal_type?: string | null
          deal_value?: number
          deleted_at?: string | null
          deleted_by?: string | null
          escrow_amount?: number | null
          id?: string
          is_demo?: boolean
          jurisdiction?: string | null
          org_id?: string | null
          owner_id?: string | null
          sector?: string | null
          seed_key?: string | null
          seller?: string | null
          signing_date?: string | null
          state_updated_at?: string
          status?: string
          target_company?: string | null
          template_blueprint?: Json | null
          template_id?: string | null
          template_version?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      disbursement_intents: {
        Row: {
          amount_original: number
          bank_account_ref: string | null
          consideration_type: Database["public"]["Enums"]["consideration_type"]
          created_at: string
          currency_original: string
          deal_id: string
          execution_provider: string
          fx_quote_id: string | null
          id: string
          provider_ref: string | null
          rail: string
          recipient_id: string
          required_approvals: Json
          required_conditions: Json
          settlement_currency: string
          status: Database["public"]["Enums"]["disbursement_status"]
          updated_at: string
          waterfall_allocation_id: string | null
        }
        Insert: {
          amount_original?: number
          bank_account_ref?: string | null
          consideration_type?: Database["public"]["Enums"]["consideration_type"]
          created_at?: string
          currency_original?: string
          deal_id: string
          execution_provider?: string
          fx_quote_id?: string | null
          id?: string
          provider_ref?: string | null
          rail?: string
          recipient_id: string
          required_approvals?: Json
          required_conditions?: Json
          settlement_currency?: string
          status?: Database["public"]["Enums"]["disbursement_status"]
          updated_at?: string
          waterfall_allocation_id?: string | null
        }
        Update: {
          amount_original?: number
          bank_account_ref?: string | null
          consideration_type?: Database["public"]["Enums"]["consideration_type"]
          created_at?: string
          currency_original?: string
          deal_id?: string
          execution_provider?: string
          fx_quote_id?: string | null
          id?: string
          provider_ref?: string | null
          rail?: string
          recipient_id?: string
          required_approvals?: Json
          required_conditions?: Json
          settlement_currency?: string
          status?: Database["public"]["Enums"]["disbursement_status"]
          updated_at?: string
          waterfall_allocation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disbursement_intents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursement_intents_fx_quote_id_fkey"
            columns: ["fx_quote_id"]
            isOneToOne: false
            referencedRelation: "fx_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursement_intents_waterfall_allocation_id_fkey"
            columns: ["waterfall_allocation_id"]
            isOneToOne: false
            referencedRelation: "waterfall_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      discrepancies: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          confidence_status: string
          created_at: string
          created_by_source: string
          created_by_user_id: string | null
          deal_id: string
          details: Json
          id: string
          last_updated_by_source: string
          last_updated_by_user_id: string | null
          locked: boolean
          locked_reason: string | null
          message: string
          needs_review: boolean
          object_id: string
          object_type: string
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_key: string
          severity: Database["public"]["Enums"]["discrepancy_severity"]
          status: Database["public"]["Enums"]["discrepancy_status"]
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          confidence_status?: string
          created_at?: string
          created_by_source?: string
          created_by_user_id?: string | null
          deal_id: string
          details?: Json
          id?: string
          last_updated_by_source?: string
          last_updated_by_user_id?: string | null
          locked?: boolean
          locked_reason?: string | null
          message: string
          needs_review?: boolean
          object_id: string
          object_type: string
          resolution_note?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_key: string
          severity: Database["public"]["Enums"]["discrepancy_severity"]
          status?: Database["public"]["Enums"]["discrepancy_status"]
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          confidence_status?: string
          created_at?: string
          created_by_source?: string
          created_by_user_id?: string | null
          deal_id?: string
          details?: Json
          id?: string
          last_updated_by_source?: string
          last_updated_by_user_id?: string | null
          locked?: boolean
          locked_reason?: string | null
          message?: string
          needs_review?: boolean
          object_id?: string
          object_type?: string
          resolution_note?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_key?: string
          severity?: Database["public"]["Enums"]["discrepancy_severity"]
          status?: Database["public"]["Enums"]["discrepancy_status"]
        }
        Relationships: [
          {
            foreignKeyName: "discrepancies_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      discrepancy_rules: {
        Row: {
          config: Json
          created_at: string
          description: string
          enabled: boolean
          id: string
          name: string
          rule_key: string
          scope: Database["public"]["Enums"]["discrepancy_scope"]
          severity: Database["public"]["Enums"]["discrepancy_severity"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description: string
          enabled?: boolean
          id?: string
          name: string
          rule_key: string
          scope?: Database["public"]["Enums"]["discrepancy_scope"]
          severity?: Database["public"]["Enums"]["discrepancy_severity"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          name?: string
          rule_key?: string
          scope?: Database["public"]["Enums"]["discrepancy_scope"]
          severity?: Database["public"]["Enums"]["discrepancy_severity"]
          updated_at?: string
        }
        Relationships: []
      }
      docusign_connections: {
        Row: {
          access_token: string | null
          account_id: string | null
          account_name: string | null
          base_uri: string | null
          created_at: string
          deal_id: string | null
          email: string | null
          id: string
          refresh_token: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          base_uri?: string | null
          created_at?: string
          deal_id?: string | null
          email?: string | null
          id?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          base_uri?: string | null
          created_at?: string
          deal_id?: string | null
          email?: string | null
          id?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "docusign_connections_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      entities: {
        Row: {
          canonical_id: string | null
          canonical_name: string
          confidence: number | null
          created_at: string
          created_by_source: string | null
          entity_type: string
          id: string
          metadata: Json | null
          name_variants: string[] | null
          source_deal_id: string | null
        }
        Insert: {
          canonical_id?: string | null
          canonical_name: string
          confidence?: number | null
          created_at?: string
          created_by_source?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          name_variants?: string[] | null
          source_deal_id?: string | null
        }
        Update: {
          canonical_id?: string | null
          canonical_name?: string
          confidence?: number | null
          created_at?: string
          created_by_source?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          name_variants?: string[] | null
          source_deal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_canonical_id_fkey"
            columns: ["canonical_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_from_id"]
          },
          {
            foreignKeyName: "entities_canonical_id_fkey"
            columns: ["canonical_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_to_id"]
          },
          {
            foreignKeyName: "entities_canonical_id_fkey"
            columns: ["canonical_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_source_deal_id_fkey"
            columns: ["source_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_resolution: {
        Row: {
          canonical_entity_id: string
          confidence: number | null
          id: string
          resolution_method: string | null
          resolved_at: string
          resolved_by: string | null
          variant_entity_id: string
        }
        Insert: {
          canonical_entity_id: string
          confidence?: number | null
          id?: string
          resolution_method?: string | null
          resolved_at?: string
          resolved_by?: string | null
          variant_entity_id: string
        }
        Update: {
          canonical_entity_id?: string
          confidence?: number | null
          id?: string
          resolution_method?: string | null
          resolved_at?: string
          resolved_by?: string | null
          variant_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_resolution_canonical_entity_id_fkey"
            columns: ["canonical_entity_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_from_id"]
          },
          {
            foreignKeyName: "entity_resolution_canonical_entity_id_fkey"
            columns: ["canonical_entity_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_to_id"]
          },
          {
            foreignKeyName: "entity_resolution_canonical_entity_id_fkey"
            columns: ["canonical_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_resolution_variant_entity_id_fkey"
            columns: ["variant_entity_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_from_id"]
          },
          {
            foreignKeyName: "entity_resolution_variant_entity_id_fkey"
            columns: ["variant_entity_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_to_id"]
          },
          {
            foreignKeyName: "entity_resolution_variant_entity_id_fkey"
            columns: ["variant_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_accounts: {
        Row: {
          account_type: string
          created_at: string
          deal_id: string
          id: string
          institution_name: string
          interest_rate: number
          interest_split_client_percent: number
          interest_split_platform_percent: number
          masked_account_number: string | null
          opened_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          deal_id: string
          id?: string
          institution_name?: string
          interest_rate?: number
          interest_split_client_percent?: number
          interest_split_platform_percent?: number
          masked_account_number?: string | null
          opened_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          deal_id?: string
          id?: string
          institution_name?: string
          interest_rate?: number
          interest_split_client_percent?: number
          interest_split_platform_percent?: number
          masked_account_number?: string | null
          opened_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_accounts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          amount: number
          created_at: string
          deal_id: string
          description: string
          executed_at: string | null
          executed_by: string | null
          id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          deal_id: string
          description: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deal_id?: string
          description?: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_events: {
        Row: {
          action_type: string
          created_at: string
          deal_id: string
          id: string
          intent_id: string
          metadata: Json | null
          new_status: string | null
          performed_by_user_id: string
          previous_status: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          deal_id: string
          id?: string
          intent_id: string
          metadata?: Json | null
          new_status?: string | null
          performed_by_user_id: string
          previous_status?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          deal_id?: string
          id?: string
          intent_id?: string
          metadata?: Json | null
          new_status?: string | null
          performed_by_user_id?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_events_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "disbursement_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      field_corrections: {
        Row: {
          ai_confidence: number | null
          ai_output: string | null
          created_at: string
          deal_id: string
          deal_type: string | null
          document_span: Json | null
          field_name: string
          human_correction: string | null
          id: string
          record_id: string
          resolution_type: string | null
          table_name: string
          user_id: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_output?: string | null
          created_at?: string
          deal_id: string
          deal_type?: string | null
          document_span?: Json | null
          field_name: string
          human_correction?: string | null
          id?: string
          record_id: string
          resolution_type?: string | null
          table_name: string
          user_id: string
        }
        Update: {
          ai_confidence?: number | null
          ai_output?: string | null
          created_at?: string
          deal_id?: string
          deal_type?: string | null
          document_span?: Json | null
          field_name?: string
          human_correction?: string | null
          id?: string
          record_id?: string
          resolution_type?: string | null
          table_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_corrections_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_quotes: {
        Row: {
          base_currency: string
          created_at: string
          deal_id: string
          expires_at: string | null
          hedge_provider: string | null
          hedge_reference_id: string | null
          hedge_type: string | null
          id: string
          locked: boolean
          locked_at: string | null
          quote_currency: string
          quoted_at: string
          rate: number
          risk_bearer: Database["public"]["Enums"]["fx_risk_bearer"] | null
          source: string
          spread_bps: number | null
          updated_at: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          deal_id: string
          expires_at?: string | null
          hedge_provider?: string | null
          hedge_reference_id?: string | null
          hedge_type?: string | null
          id?: string
          locked?: boolean
          locked_at?: string | null
          quote_currency: string
          quoted_at?: string
          rate: number
          risk_bearer?: Database["public"]["Enums"]["fx_risk_bearer"] | null
          source?: string
          spread_bps?: number | null
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          deal_id?: string
          expires_at?: string | null
          hedge_provider?: string | null
          hedge_reference_id?: string | null
          hedge_type?: string | null
          id?: string
          locked?: boolean
          locked_at?: string | null
          quote_currency?: string
          quoted_at?: string
          rate?: number
          risk_bearer?: Database["public"]["Enums"]["fx_risk_bearer"] | null
          source?: string
          spread_bps?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_edges: {
        Row: {
          created_at: string
          deal_id: string
          edge_type: Database["public"]["Enums"]["graph_edge_type"]
          from_node_id: string
          id: string
          metadata: Json | null
          to_node_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          edge_type: Database["public"]["Enums"]["graph_edge_type"]
          from_node_id: string
          id?: string
          metadata?: Json | null
          to_node_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          edge_type?: Database["public"]["Enums"]["graph_edge_type"]
          from_node_id?: string
          id?: string
          metadata?: Json | null
          to_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "graph_edges_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graph_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "graph_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graph_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "graph_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_nodes: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          label: string
          metadata: Json | null
          node_type: Database["public"]["Enums"]["graph_node_type"]
          source_entity_id: string | null
          status: Database["public"]["Enums"]["graph_node_status"]
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          label: string
          metadata?: Json | null
          node_type: Database["public"]["Enums"]["graph_node_type"]
          source_entity_id?: string | null
          status?: Database["public"]["Enums"]["graph_node_status"]
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          label?: string
          metadata?: Json | null
          node_type?: Database["public"]["Enums"]["graph_node_type"]
          source_entity_id?: string | null
          status?: Database["public"]["Enums"]["graph_node_status"]
        }
        Relationships: [
          {
            foreignKeyName: "graph_nodes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status: {
        Row: {
          attempts: number
          completed_at: string | null
          deal_id: string | null
          error: string | null
          id: string
          job_type: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          queue_name: string
          queued_at: string
          result: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          deal_id?: string | null
          error?: string | null
          id?: string
          job_type: string
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          queue_name: string
          queued_at?: string
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          deal_id?: string | null
          error?: string | null
          id?: string
          job_type?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          queue_name?: string
          queued_at?: string
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_status_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_uploads: {
        Row: {
          doc_type: string
          file_name: string | null
          file_url: string
          id: string
          owner_id: string
          owner_type: string
          uploaded_at: string
        }
        Insert: {
          doc_type: string
          file_name?: string | null
          file_url: string
          id?: string
          owner_id: string
          owner_type: string
          uploaded_at?: string
        }
        Update: {
          doc_type?: string
          file_name?: string | null
          file_url?: string
          id?: string
          owner_id?: string
          owner_type?: string
          uploaded_at?: string
        }
        Relationships: []
      }
      newton_extractions: {
        Row: {
          confidence_score: number | null
          created_at: string
          deal_id: string
          extracted_data: Json
          extraction_type: string
          field_summary: Json | null
          id: string
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          upload_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          deal_id: string
          extracted_data?: Json
          extraction_type: string
          field_summary?: Json | null
          id?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          upload_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          deal_id?: string
          extracted_data?: Json
          extraction_type?: string
          field_summary?: Json | null
          id?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newton_extractions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newton_extractions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "newton_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      newton_proposed_actions: {
        Row: {
          action_label: string
          action_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          deal_id: string
          description: string | null
          error_message: string | null
          execution_result: Json | null
          extraction_id: string | null
          id: string
          impact_level: string
          preview_data: Json | null
          rejected_at: string | null
          rejected_by: string | null
          status: string
          updated_at: string
          upload_id: string
        }
        Insert: {
          action_label: string
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deal_id: string
          description?: string | null
          error_message?: string | null
          execution_result?: Json | null
          extraction_id?: string | null
          id?: string
          impact_level?: string
          preview_data?: Json | null
          rejected_at?: string | null
          rejected_by?: string | null
          status?: string
          updated_at?: string
          upload_id: string
        }
        Update: {
          action_label?: string
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deal_id?: string
          description?: string | null
          error_message?: string | null
          execution_result?: Json | null
          extraction_id?: string | null
          id?: string
          impact_level?: string
          preview_data?: Json | null
          rejected_at?: string | null
          rejected_by?: string | null
          status?: string
          updated_at?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newton_proposed_actions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newton_proposed_actions_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "newton_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newton_proposed_actions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "newton_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      newton_uploads: {
        Row: {
          created_at: string
          deal_id: string
          detected_type: string | null
          error_message: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          status: string
          updated_at: string
          uploaded_by: string
          user_override_type: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          detected_type?: string | null
          error_message?: string | null
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string | null
          status?: string
          updated_at?: string
          uploaded_by: string
          user_override_type?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          detected_type?: string | null
          error_message?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string
          user_override_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newton_uploads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_intent_map: {
        Row: {
          allocation_value_minor: number | null
          created_at: string
          id: string
          intent_id: string
          obligation_id: string
        }
        Insert: {
          allocation_value_minor?: number | null
          created_at?: string
          id?: string
          intent_id: string
          obligation_id: string
        }
        Update: {
          allocation_value_minor?: number | null
          created_at?: string
          id?: string
          intent_id?: string
          obligation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligation_intent_map_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "disbursement_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_intent_map_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          amount_currency: string | null
          amount_type: Database["public"]["Enums"]["obligation_amount_type"]
          amount_value_minor: number | null
          confidence_score: number | null
          confirmed_at: string | null
          confirmed_by_user_id: string | null
          created_at: string
          deal_id: string
          extracted_by: string | null
          formula_text: string | null
          id: string
          instructions_confirmed: boolean | null
          mapped_intent_ids: Json | null
          mapping_notes: string | null
          mapping_status: Database["public"]["Enums"]["obligation_mapping_status"]
          obligation_type: Database["public"]["Enums"]["obligation_type"]
          payee_label: string | null
          payment_instructions_source: string | null
          payment_instructions_text: string | null
          payor_label: string | null
          percent_base_reference: string | null
          percent_basis_points: number | null
          scheduled_date: string | null
          source_document_id: string | null
          source_text_snippet: string | null
          status: Database["public"]["Enums"]["obligation_status"]
          structured_json: Json | null
          timing_type: Database["public"]["Enums"]["obligation_timing"]
          tolerance_minor: number | null
          updated_at: string
        }
        Insert: {
          amount_currency?: string | null
          amount_type?: Database["public"]["Enums"]["obligation_amount_type"]
          amount_value_minor?: number | null
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by_user_id?: string | null
          created_at?: string
          deal_id: string
          extracted_by?: string | null
          formula_text?: string | null
          id?: string
          instructions_confirmed?: boolean | null
          mapped_intent_ids?: Json | null
          mapping_notes?: string | null
          mapping_status?: Database["public"]["Enums"]["obligation_mapping_status"]
          obligation_type?: Database["public"]["Enums"]["obligation_type"]
          payee_label?: string | null
          payment_instructions_source?: string | null
          payment_instructions_text?: string | null
          payor_label?: string | null
          percent_base_reference?: string | null
          percent_basis_points?: number | null
          scheduled_date?: string | null
          source_document_id?: string | null
          source_text_snippet?: string | null
          status?: Database["public"]["Enums"]["obligation_status"]
          structured_json?: Json | null
          timing_type?: Database["public"]["Enums"]["obligation_timing"]
          tolerance_minor?: number | null
          updated_at?: string
        }
        Update: {
          amount_currency?: string | null
          amount_type?: Database["public"]["Enums"]["obligation_amount_type"]
          amount_value_minor?: number | null
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by_user_id?: string | null
          created_at?: string
          deal_id?: string
          extracted_by?: string | null
          formula_text?: string | null
          id?: string
          instructions_confirmed?: boolean | null
          mapped_intent_ids?: Json | null
          mapping_notes?: string | null
          mapping_status?: Database["public"]["Enums"]["obligation_mapping_status"]
          obligation_type?: Database["public"]["Enums"]["obligation_type"]
          payee_label?: string | null
          payment_instructions_source?: string | null
          payment_instructions_text?: string | null
          payor_label?: string | null
          percent_base_reference?: string | null
          percent_basis_points?: number | null
          scheduled_date?: string | null
          source_document_id?: string | null
          source_text_snippet?: string | null
          status?: Database["public"]["Enums"]["obligation_status"]
          structured_json?: Json | null
          timing_type?: Database["public"]["Enums"]["obligation_timing"]
          tolerance_minor?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ontology_approvals: {
        Row: {
          approval_type: Database["public"]["Enums"]["ontology_approval_type"]
          condition_id: string | null
          created_at: string
          deal_id: string
          id: string
          status: Database["public"]["Enums"]["ontology_approval_status"]
        }
        Insert: {
          approval_type: Database["public"]["Enums"]["ontology_approval_type"]
          condition_id?: string | null
          created_at?: string
          deal_id: string
          id?: string
          status?: Database["public"]["Enums"]["ontology_approval_status"]
        }
        Update: {
          approval_type?: Database["public"]["Enums"]["ontology_approval_type"]
          condition_id?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          status?: Database["public"]["Enums"]["ontology_approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ontology_approvals_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ontology_approvals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      ontology_documents: {
        Row: {
          created_at: string
          deal_id: string
          doc_type: Database["public"]["Enums"]["ontology_doc_type"]
          id: string
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          doc_type?: Database["public"]["Enums"]["ontology_doc_type"]
          id?: string
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          doc_type?: Database["public"]["Enums"]["ontology_doc_type"]
          id?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ontology_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      ontology_terms: {
        Row: {
          created_at: string
          definition: string
          display_name: string
          entity_type: Database["public"]["Enums"]["ontology_entity_type"]
          example: string | null
          id: string
          relationships: Json
          required_fields: Json
          status: Database["public"]["Enums"]["ontology_status"]
          term_key: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          definition: string
          display_name: string
          entity_type: Database["public"]["Enums"]["ontology_entity_type"]
          example?: string | null
          id?: string
          relationships?: Json
          required_fields?: Json
          status?: Database["public"]["Enums"]["ontology_status"]
          term_key: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          definition?: string
          display_name?: string
          entity_type?: Database["public"]["Enums"]["ontology_entity_type"]
          example?: string | null
          id?: string
          relationships?: Json
          required_fields?: Json
          status?: Database["public"]["Enums"]["ontology_status"]
          term_key?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      org_kyb: {
        Row: {
          admin_notes: string | null
          country_jurisdiction: string | null
          created_at: string
          id: string
          legal_entity_name: string | null
          registered_address: string | null
          registration_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          country_jurisdiction?: string | null
          created_at?: string
          id?: string
          legal_entity_name?: string | null
          registered_address?: string | null
          registration_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          country_jurisdiction?: string | null
          created_at?: string
          id?: string
          legal_entity_name?: string | null
          registered_address?: string | null
          registration_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          revoked_at: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          revoked_at?: string | null
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          revoked_at?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          created_at: string
          created_by: string | null
          id: string
          legal_entity_name: string | null
          name: string
          org_type: string
          product_kind: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legal_entity_name?: string | null
          name: string
          org_type?: string
          product_kind?: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legal_entity_name?: string | null
          name?: string
          org_type?: string
          product_kind?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          allocation_type: string
          amount: number
          confidence_status: string
          created_at: string
          created_by_source: string
          created_by_user_id: string | null
          currency: string
          deal_id: string
          id: string
          last_updated_by_source: string
          last_updated_by_user_id: string | null
          locked: boolean
          locked_reason: string | null
          needs_review: boolean
          recipient: string
          source_document_id: string | null
          source_wire_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          allocation_type?: string
          amount?: number
          confidence_status?: string
          created_at?: string
          created_by_source?: string
          created_by_user_id?: string | null
          currency?: string
          deal_id: string
          id?: string
          last_updated_by_source?: string
          last_updated_by_user_id?: string | null
          locked?: boolean
          locked_reason?: string | null
          needs_review?: boolean
          recipient: string
          source_document_id?: string | null
          source_wire_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          allocation_type?: string
          amount?: number
          confidence_status?: string
          created_at?: string
          created_by_source?: string
          created_by_user_id?: string | null
          currency?: string
          deal_id?: string
          id?: string
          last_updated_by_source?: string
          last_updated_by_user_id?: string | null
          locked?: boolean
          locked_reason?: string | null
          needs_review?: boolean
          recipient?: string
          source_document_id?: string | null
          source_wire_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_source_wire_id_fkey"
            columns: ["source_wire_id"]
            isOneToOne: false
            referencedRelation: "wire_instructions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_instructions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          deal_id: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          title: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          deal_id: string
          id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          title: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          deal_id?: string
          id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_instructions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          organization: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          organization?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          organization?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      re_beneficial_owners: {
        Row: {
          created_at: string
          has_substantial_control: boolean
          id: string
          id_doc_expiration: string | null
          id_doc_issuing_jurisdiction: string | null
          id_doc_number_last4: string | null
          id_doc_type: string | null
          individual_address_city: string | null
          individual_address_country: string
          individual_address_line1: string | null
          individual_address_state: string | null
          individual_address_zip: string | null
          individual_dob: string | null
          individual_full_name: string
          ownership_pct: number | null
          party_id: string
          persona_account_id: string | null
          persona_last_inquiry_id: string | null
          persona_last_verified_at: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          has_substantial_control?: boolean
          id?: string
          id_doc_expiration?: string | null
          id_doc_issuing_jurisdiction?: string | null
          id_doc_number_last4?: string | null
          id_doc_type?: string | null
          individual_address_city?: string | null
          individual_address_country?: string
          individual_address_line1?: string | null
          individual_address_state?: string | null
          individual_address_zip?: string | null
          individual_dob?: string | null
          individual_full_name: string
          ownership_pct?: number | null
          party_id: string
          persona_account_id?: string | null
          persona_last_inquiry_id?: string | null
          persona_last_verified_at?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          has_substantial_control?: boolean
          id?: string
          id_doc_expiration?: string | null
          id_doc_issuing_jurisdiction?: string | null
          id_doc_number_last4?: string | null
          id_doc_type?: string | null
          individual_address_city?: string | null
          individual_address_country?: string
          individual_address_line1?: string | null
          individual_address_state?: string | null
          individual_address_zip?: string | null
          individual_dob?: string | null
          individual_full_name?: string
          ownership_pct?: number | null
          party_id?: string
          persona_account_id?: string | null
          persona_last_inquiry_id?: string | null
          persona_last_verified_at?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_beneficial_owners_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "re_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      re_deal_terms: {
        Row: {
          additional_deposits: number | null
          cam_reconciliation_required: boolean
          closing_date: string | null
          contingency_notes: string | null
          created_at: string
          due_diligence_deadline: string | null
          earnest_money: number | null
          environmental_contingency: boolean
          estoppel_required: boolean
          financing_contingency: boolean
          financing_contingency_end: string | null
          id: string
          inspection_contingency: boolean
          lender_approval_required: boolean
          purchase_price: number | null
          rent_proration_required: boolean
          security_deposits_credited: boolean
          signing_date: string | null
          source: string
          source_ref: Json | null
          tax_proration_method: string | null
          transaction_id: string
          updated_at: string
          utility_adjustment_method: string | null
          workspace_id: string
        }
        Insert: {
          additional_deposits?: number | null
          cam_reconciliation_required?: boolean
          closing_date?: string | null
          contingency_notes?: string | null
          created_at?: string
          due_diligence_deadline?: string | null
          earnest_money?: number | null
          environmental_contingency?: boolean
          estoppel_required?: boolean
          financing_contingency?: boolean
          financing_contingency_end?: string | null
          id?: string
          inspection_contingency?: boolean
          lender_approval_required?: boolean
          purchase_price?: number | null
          rent_proration_required?: boolean
          security_deposits_credited?: boolean
          signing_date?: string | null
          source?: string
          source_ref?: Json | null
          tax_proration_method?: string | null
          transaction_id: string
          updated_at?: string
          utility_adjustment_method?: string | null
          workspace_id: string
        }
        Update: {
          additional_deposits?: number | null
          cam_reconciliation_required?: boolean
          closing_date?: string | null
          contingency_notes?: string | null
          created_at?: string
          due_diligence_deadline?: string | null
          earnest_money?: number | null
          environmental_contingency?: boolean
          estoppel_required?: boolean
          financing_contingency?: boolean
          financing_contingency_end?: string | null
          id?: string
          inspection_contingency?: boolean
          lender_approval_required?: boolean
          purchase_price?: number | null
          rent_proration_required?: boolean
          security_deposits_credited?: boolean
          signing_date?: string | null
          source?: string
          source_ref?: Json | null
          tax_proration_method?: string | null
          transaction_id?: string
          updated_at?: string
          utility_adjustment_method?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_deal_terms_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_deal_terms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      re_parties: {
        Row: {
          authority_doc_id: string | null
          authority_verified: boolean
          authority_verified_by: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string | null
          entity_ein: string | null
          entity_legal_name: string | null
          entity_state_of_formation: string | null
          entity_type: string | null
          entity_type_enum: string | null
          id: string
          individual_dob: string | null
          individual_name_first: string | null
          individual_name_last: string | null
          individual_ssn_last4: string | null
          is_entity: boolean
          ownership_pct: number | null
          persona_account_id: string | null
          persona_last_inquiry_id: string | null
          persona_last_verified_at: string | null
          phone: string | null
          role: string
          transaction_id: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          authority_doc_id?: string | null
          authority_verified?: boolean
          authority_verified_by?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email?: string | null
          entity_ein?: string | null
          entity_legal_name?: string | null
          entity_state_of_formation?: string | null
          entity_type?: string | null
          entity_type_enum?: string | null
          id?: string
          individual_dob?: string | null
          individual_name_first?: string | null
          individual_name_last?: string | null
          individual_ssn_last4?: string | null
          is_entity?: boolean
          ownership_pct?: number | null
          persona_account_id?: string | null
          persona_last_inquiry_id?: string | null
          persona_last_verified_at?: string | null
          phone?: string | null
          role: string
          transaction_id: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          authority_doc_id?: string | null
          authority_verified?: boolean
          authority_verified_by?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string | null
          entity_ein?: string | null
          entity_legal_name?: string | null
          entity_state_of_formation?: string | null
          entity_type?: string | null
          entity_type_enum?: string | null
          id?: string
          individual_dob?: string | null
          individual_name_first?: string | null
          individual_name_last?: string | null
          individual_ssn_last4?: string | null
          is_entity?: boolean
          ownership_pct?: number | null
          persona_account_id?: string | null
          persona_last_inquiry_id?: string | null
          persona_last_verified_at?: string | null
          phone?: string | null
          role?: string
          transaction_id?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_parties_authority_doc_id_fkey"
            columns: ["authority_doc_id"]
            isOneToOne: false
            referencedRelation: "tx_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_parties_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      re_property_profile: {
        Row: {
          created_at: string
          current_owner_name: string | null
          id: string
          legal_description: string | null
          lot_size_sqft: number | null
          ownership_structure: string | null
          property_type: string | null
          source: string
          source_ref: Json | null
          square_footage: number | null
          transaction_id: string
          updated_at: string
          workspace_id: string
          year_built: number | null
          zoning: string | null
        }
        Insert: {
          created_at?: string
          current_owner_name?: string | null
          id?: string
          legal_description?: string | null
          lot_size_sqft?: number | null
          ownership_structure?: string | null
          property_type?: string | null
          source?: string
          source_ref?: Json | null
          square_footage?: number | null
          transaction_id: string
          updated_at?: string
          workspace_id: string
          year_built?: number | null
          zoning?: string | null
        }
        Update: {
          created_at?: string
          current_owner_name?: string | null
          id?: string
          legal_description?: string | null
          lot_size_sqft?: number | null
          ownership_structure?: string | null
          property_type?: string | null
          source?: string
          source_ref?: Json | null
          square_footage?: number | null
          transaction_id?: string
          updated_at?: string
          workspace_id?: string
          year_built?: number | null
          zoning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_property_profile_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_property_profile_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      re_settlement_lines: {
        Row: {
          category: string
          cd_line_number: string | null
          created_at: string
          credit_amount: number
          currency: string
          debit_amount: number
          description: string | null
          id: string
          is_buyer_side: boolean
          is_seller_side: boolean
          party_id: string | null
          sort_order: number
          transaction_id: string
          updated_at: string
        }
        Insert: {
          category: string
          cd_line_number?: string | null
          created_at?: string
          credit_amount?: number
          currency?: string
          debit_amount?: number
          description?: string | null
          id?: string
          is_buyer_side?: boolean
          is_seller_side?: boolean
          party_id?: string | null
          sort_order?: number
          transaction_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          cd_line_number?: string | null
          created_at?: string
          credit_amount?: number
          currency?: string
          debit_amount?: number
          description?: string | null
          id?: string
          is_buyer_side?: boolean
          is_seller_side?: boolean
          party_id?: string | null
          sort_order?: number
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_settlement_lines_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "re_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_settlement_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      re_transactions: {
        Row: {
          apn: string | null
          closing_date_actual: string | null
          closing_date_target: string | null
          contract_price: number | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          earnest_money: number | null
          fincen_reportable: boolean | null
          id: string
          is_entity_buyer: boolean
          is_non_financed: boolean
          org_id: string
          property_address_line1: string | null
          property_address_line2: string | null
          property_city: string | null
          property_county: string | null
          property_state: string | null
          property_zip: string | null
          status: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          apn?: string | null
          closing_date_actual?: string | null
          closing_date_target?: string | null
          contract_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          earnest_money?: number | null
          fincen_reportable?: boolean | null
          id?: string
          is_entity_buyer?: boolean
          is_non_financed?: boolean
          org_id: string
          property_address_line1?: string | null
          property_address_line2?: string | null
          property_city?: string | null
          property_county?: string | null
          property_state?: string | null
          property_zip?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          apn?: string | null
          closing_date_actual?: string | null
          closing_date_target?: string | null
          contract_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          earnest_money?: number | null
          fincen_reportable?: boolean | null
          id?: string
          is_entity_buyer?: boolean
          is_non_financed?: boolean
          org_id?: string
          property_address_line1?: string | null
          property_address_line2?: string | null
          property_city?: string | null
          property_county?: string | null
          property_state?: string | null
          property_zip?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_conditions: {
        Row: {
          assigned_to: string | null
          checklist_item_id: string | null
          cleared_at: string | null
          condition_type: string
          created_at: string
          deal_id: string
          early_termination_granted_at: string | null
          filed_at: string | null
          id: string
          notes: string | null
          status: string
          waiting_period_end: string | null
        }
        Insert: {
          assigned_to?: string | null
          checklist_item_id?: string | null
          cleared_at?: string | null
          condition_type: string
          created_at?: string
          deal_id: string
          early_termination_granted_at?: string | null
          filed_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          waiting_period_end?: string | null
        }
        Update: {
          assigned_to?: string | null
          checklist_item_id?: string | null
          cleared_at?: string | null
          condition_type?: string
          created_at?: string
          deal_id?: string
          early_termination_granted_at?: string | null
          filed_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          waiting_period_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_conditions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "deal_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_conditions_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: true
            referencedRelation: "closing_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_conditions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      relationships: {
        Row: {
          confidence: number | null
          created_at: string
          deal_id: string
          effective_date: string | null
          entity_from_id: string
          entity_to_id: string
          id: string
          provenance: string | null
          relationship_type: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          deal_id: string
          effective_date?: string | null
          entity_from_id: string
          entity_to_id: string
          id?: string
          provenance?: string | null
          relationship_type: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          deal_id?: string
          effective_date?: string | null
          entity_from_id?: string
          entity_to_id?: string
          id?: string
          provenance?: string | null
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_entity_from_id_fkey"
            columns: ["entity_from_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_from_id"]
          },
          {
            foreignKeyName: "relationships_entity_from_id_fkey"
            columns: ["entity_from_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_to_id"]
          },
          {
            foreignKeyName: "relationships_entity_from_id_fkey"
            columns: ["entity_from_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_entity_to_id_fkey"
            columns: ["entity_to_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_from_id"]
          },
          {
            foreignKeyName: "relationships_entity_to_id_fkey"
            columns: ["entity_to_id"]
            isOneToOne: false
            referencedRelation: "deal_entity_graph"
            referencedColumns: ["entity_to_id"]
          },
          {
            foreignKeyName: "relationships_entity_to_id_fkey"
            columns: ["entity_to_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      required_document_matrix: {
        Row: {
          condition_expression: string | null
          created_at: string
          deal_type: string
          doc_type: string
          id: string
          is_required: boolean
          requirement_group: string
        }
        Insert: {
          condition_expression?: string | null
          created_at?: string
          deal_type: string
          doc_type: string
          id?: string
          is_required?: boolean
          requirement_group?: string
        }
        Update: {
          condition_expression?: string | null
          created_at?: string
          deal_type?: string
          doc_type?: string
          id?: string
          is_required?: boolean
          requirement_group?: string
        }
        Relationships: []
      }
      requirement_evidence: {
        Row: {
          created_at: string
          deal_id: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          document_id: string | null
          filename: string | null
          human_decision: string | null
          id: string
          request_id: string | null
          requirement_id: string
          storage_path: string | null
          submitted_at: string
          submitted_by_email: string | null
          verification_confidence: number | null
          verification_details: Json
          verification_issues: Json
          verification_verdict: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          document_id?: string | null
          filename?: string | null
          human_decision?: string | null
          id?: string
          request_id?: string | null
          requirement_id: string
          storage_path?: string | null
          submitted_at?: string
          submitted_by_email?: string | null
          verification_confidence?: number | null
          verification_details?: Json
          verification_issues?: Json
          verification_verdict?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          document_id?: string | null
          filename?: string | null
          human_decision?: string | null
          id?: string
          request_id?: string | null
          requirement_id?: string
          storage_path?: string | null
          submitted_at?: string
          submitted_by_email?: string | null
          verification_confidence?: number | null
          verification_details?: Json
          verification_issues?: Json
          verification_verdict?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requirement_evidence_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_evidence_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requirement_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_evidence_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "deal_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_to_send: boolean
          auto_remind: boolean
          cancelled_at: string | null
          channel: string
          created_at: string
          created_by: string | null
          deal_id: string
          escalate_to: string | null
          escalated_at: string | null
          expires_at: string | null
          external_ref: string | null
          id: string
          last_error: string | null
          last_reminder_at: string | null
          next_reminder_at: string | null
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          reminder_cadence_days: number[]
          reminder_count: number
          requirement_id: string
          responded_at: string | null
          sent_at: string | null
          status: string
          token_hash: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_to_send?: boolean
          auto_remind?: boolean
          cancelled_at?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          deal_id: string
          escalate_to?: string | null
          escalated_at?: string | null
          expires_at?: string | null
          external_ref?: string | null
          id?: string
          last_error?: string | null
          last_reminder_at?: string | null
          next_reminder_at?: string | null
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          reminder_cadence_days?: number[]
          reminder_count?: number
          requirement_id: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          token_hash?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_to_send?: boolean
          auto_remind?: boolean
          cancelled_at?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string
          escalate_to?: string | null
          escalated_at?: string | null
          expires_at?: string | null
          external_ref?: string | null
          id?: string
          last_error?: string | null
          last_reminder_at?: string | null
          next_reminder_at?: string | null
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          reminder_cadence_days?: number[]
          reminder_count?: number
          requirement_id?: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_requests_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "deal_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_bank_instructions: {
        Row: {
          account_number_encrypted: string
          bank_name: string | null
          counterparty_profile_id: string
          created_at: string
          id: string
          label: string
          routing_number: string | null
          swift_code: string | null
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          account_number_encrypted: string
          bank_name?: string | null
          counterparty_profile_id: string
          created_at?: string
          id?: string
          label: string
          routing_number?: string | null
          swift_code?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          account_number_encrypted?: string
          bank_name?: string | null
          counterparty_profile_id?: string
          created_at?: string
          id?: string
          label?: string
          routing_number?: string | null
          swift_code?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_bank_instructions_counterparty_profile_id_fkey"
            columns: ["counterparty_profile_id"]
            isOneToOne: false
            referencedRelation: "counterparty_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          affected_area: string
          assigned_to: string | null
          attachment_path: string | null
          category: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          priority: string
          status: string
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          affected_area: string
          assigned_to?: string | null
          attachment_path?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          priority?: string
          status?: string
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          affected_area?: string
          assigned_to?: string | null
          attachment_path?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          priority?: string
          status?: string
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tax_forms: {
        Row: {
          created_at: string
          deal_id: string
          document_id: string | null
          expires_on: string | null
          form_type: string
          id: string
          notes: string | null
          recipient_id: string
          signed_date: string | null
          status: string
          tin_last4: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          document_id?: string | null
          expires_on?: string | null
          form_type: string
          id?: string
          notes?: string | null
          recipient_id: string
          signed_date?: string | null
          status?: string
          tin_last4?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          document_id?: string | null
          expires_on?: string | null
          form_type?: string
          id?: string
          notes?: string | null
          recipient_id?: string
          signed_date?: string | null
          status?: string
          tin_last4?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_forms_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_forms_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "tax_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_recipients: {
        Row: {
          created_at: string
          deal_id: string
          email: string | null
          id: string
          linked_stakeholder_id: string | null
          name: string
          recipient_type: string
          tax_residency: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          email?: string | null
          id?: string
          linked_stakeholder_id?: string | null
          name: string
          recipient_type?: string
          tax_residency?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          email?: string | null
          id?: string
          linked_stakeholder_id?: string | null
          name?: string
          recipient_type?: string
          tax_residency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_recipients_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      tx_approvals: {
        Row: {
          approvals: Json
          created_at: string
          created_by: string | null
          id: string
          required_count: number
          resolved_at: string | null
          status: string
          subject_kind: string
          subject_ref: string | null
          transaction_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approvals?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          required_count?: number
          resolved_at?: string | null
          status?: string
          subject_kind: string
          subject_ref?: string | null
          transaction_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approvals?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          required_count?: number
          resolved_at?: string | null
          status?: string
          subject_kind?: string
          subject_ref?: string | null
          transaction_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tx_approvals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_approvals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tx_audit_log: {
        Row: {
          actor_email: string | null
          actor_source: string
          actor_user_id: string | null
          created_at: string
          diff: Json | null
          id: number
          operation: string
          row_id: string | null
          table_name: string
          transaction_id: string | null
          workspace_id: string
        }
        Insert: {
          actor_email?: string | null
          actor_source?: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: number
          operation: string
          row_id?: string | null
          table_name: string
          transaction_id?: string | null
          workspace_id: string
        }
        Update: {
          actor_email?: string | null
          actor_source?: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: number
          operation?: string
          row_id?: string | null
          table_name?: string
          transaction_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tx_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tx_conditions_precedent: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          description: string | null
          evidence_doc_id: string | null
          id: string
          satisfied_at: string | null
          satisfied_by: string | null
          sort_order: number
          source: string
          source_ref: Json | null
          status: string
          title: string
          transaction_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          evidence_doc_id?: string | null
          id?: string
          satisfied_at?: string | null
          satisfied_by?: string | null
          sort_order?: number
          source?: string
          source_ref?: Json | null
          status?: string
          title: string
          transaction_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          evidence_doc_id?: string | null
          id?: string
          satisfied_at?: string | null
          satisfied_by?: string | null
          sort_order?: number
          source?: string
          source_ref?: Json | null
          status?: string
          title?: string
          transaction_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tx_conditions_precedent_evidence_doc_id_fkey"
            columns: ["evidence_doc_id"]
            isOneToOne: false
            referencedRelation: "tx_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_conditions_precedent_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_conditions_precedent_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tx_documents: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          filename: string
          id: string
          mime_type: string | null
          parent_doc_id: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          transaction_id: string
          updated_at: string
          uploaded_by: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          filename: string
          id?: string
          mime_type?: string | null
          parent_doc_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          transaction_id: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          filename?: string
          id?: string
          mime_type?: string | null
          parent_doc_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          transaction_id?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tx_documents_parent_doc_id_fkey"
            columns: ["parent_doc_id"]
            isOneToOne: false
            referencedRelation: "tx_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tx_funds_flow_lines: {
        Row: {
          account_last4: string | null
          amount: number
          bank_name: string | null
          category: string
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          direction: string
          id: string
          payee_party: string | null
          routing_last4: string | null
          sort_order: number
          source: string
          source_ref: Json | null
          transaction_id: string
          updated_at: string
          wire_confirmed_at: string | null
          wire_sent_at: string | null
          wire_status: string
          workspace_id: string
        }
        Insert: {
          account_last4?: string | null
          amount: number
          bank_name?: string | null
          category: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          direction: string
          id?: string
          payee_party?: string | null
          routing_last4?: string | null
          sort_order?: number
          source?: string
          source_ref?: Json | null
          transaction_id: string
          updated_at?: string
          wire_confirmed_at?: string | null
          wire_sent_at?: string | null
          wire_status?: string
          workspace_id: string
        }
        Update: {
          account_last4?: string | null
          amount?: number
          bank_name?: string | null
          category?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          direction?: string
          id?: string
          payee_party?: string | null
          routing_last4?: string | null
          sort_order?: number
          source?: string
          source_ref?: Json | null
          transaction_id?: string
          updated_at?: string
          wire_confirmed_at?: string | null
          wire_sent_at?: string | null
          wire_status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tx_funds_flow_lines_payee_party_fkey"
            columns: ["payee_party"]
            isOneToOne: false
            referencedRelation: "re_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_funds_flow_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_funds_flow_lines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tx_obligations: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          owed_by_party: string | null
          owed_by_side: string
          satisfied_at: string | null
          satisfied_by: string | null
          sort_order: number
          source: string
          source_ref: Json | null
          status: string
          title: string
          transaction_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owed_by_party?: string | null
          owed_by_side: string
          satisfied_at?: string | null
          satisfied_by?: string | null
          sort_order?: number
          source?: string
          source_ref?: Json | null
          status?: string
          title: string
          transaction_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owed_by_party?: string | null
          owed_by_side?: string
          satisfied_at?: string | null
          satisfied_by?: string | null
          sort_order?: number
          source?: string
          source_ref?: Json | null
          status?: string
          title?: string
          transaction_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tx_obligations_owed_by_party_fkey"
            columns: ["owed_by_party"]
            isOneToOne: false
            referencedRelation: "re_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_obligations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_obligations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tx_readiness_dimensions: {
        Row: {
          created_at: string
          dimension: string
          id: string
          notes: string | null
          score_pct: number
          source: string
          transaction_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          dimension: string
          id?: string
          notes?: string | null
          score_pct?: number
          source?: string
          transaction_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          dimension?: string
          id?: string
          notes?: string | null
          score_pct?: number
          source?: string
          transaction_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tx_readiness_dimensions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "re_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tx_readiness_dimensions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_events: {
        Row: {
          created_at: string
          deal_id: string | null
          event_category: string
          event_type: string
          id: string
          metadata: Json | null
          page_path: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id?: string | null
          event_category?: string
          event_type: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string | null
          event_category?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_kyc: {
        Row: {
          account_holder_name: string | null
          account_number_last4: string | null
          admin_notes: string | null
          bank_address: string | null
          bank_country: string | null
          bank_name: string | null
          bank_verified: boolean | null
          created_at: string
          date_of_birth: string | null
          full_legal_name: string | null
          iban: string | null
          id: string
          intermediary_bank: string | null
          kyc_type: string
          nationality: string | null
          residential_address: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role_at_org: string | null
          routing_number: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string | null
          swift_bic: string | null
          updated_at: string
          user_id: string
          wire_currency: string | null
        }
        Insert: {
          account_holder_name?: string | null
          account_number_last4?: string | null
          admin_notes?: string | null
          bank_address?: string | null
          bank_country?: string | null
          bank_name?: string | null
          bank_verified?: boolean | null
          created_at?: string
          date_of_birth?: string | null
          full_legal_name?: string | null
          iban?: string | null
          id?: string
          intermediary_bank?: string | null
          kyc_type?: string
          nationality?: string | null
          residential_address?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_at_org?: string | null
          routing_number?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          swift_bic?: string | null
          updated_at?: string
          user_id: string
          wire_currency?: string | null
        }
        Update: {
          account_holder_name?: string | null
          account_number_last4?: string | null
          admin_notes?: string | null
          bank_address?: string | null
          bank_country?: string | null
          bank_name?: string | null
          bank_verified?: boolean | null
          created_at?: string
          date_of_birth?: string | null
          full_legal_name?: string | null
          iban?: string | null
          id?: string
          intermediary_bank?: string | null
          kyc_type?: string
          nationality?: string | null
          residential_address?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_at_org?: string | null
          routing_number?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          swift_bic?: string | null
          updated_at?: string
          user_id?: string
          wire_currency?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      validation_results: {
        Row: {
          affected_field: string | null
          check_name: string
          created_at: string
          deal_id: string
          id: string
          message: string | null
          status: string
        }
        Insert: {
          affected_field?: string | null
          check_name: string
          created_at?: string
          deal_id: string
          id?: string
          message?: string | null
          status?: string
        }
        Update: {
          affected_field?: string | null
          check_name?: string
          created_at?: string
          deal_id?: string
          id?: string
          message?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_results_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          file_url: string
          id: string
          verification_request_id: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          file_name: string
          file_url: string
          id?: string
          verification_request_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          file_url?: string
          id?: string
          verification_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_documents_verification_request_id_fkey"
            columns: ["verification_request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          expires_at: string
          id: string
          manual_review_notes: string | null
          opened_at: string | null
          recipient_email: string
          recipient_name: string
          revoked_at: string | null
          sent_at: string | null
          stakeholder_id: string
          stakeholder_type: string
          status: Database["public"]["Enums"]["verification_request_status"]
          submission_data: Json | null
          submitted_at: string | null
          token_hash: string
          updated_at: string
          verification_type: string
          verified_at: string | null
          verified_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          expires_at?: string
          id?: string
          manual_review_notes?: string | null
          opened_at?: string | null
          recipient_email: string
          recipient_name: string
          revoked_at?: string | null
          sent_at?: string | null
          stakeholder_id: string
          stakeholder_type?: string
          status?: Database["public"]["Enums"]["verification_request_status"]
          submission_data?: Json | null
          submitted_at?: string | null
          token_hash: string
          updated_at?: string
          verification_type?: string
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          expires_at?: string
          id?: string
          manual_review_notes?: string | null
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string
          revoked_at?: string | null
          sent_at?: string | null
          stakeholder_id?: string
          stakeholder_type?: string
          status?: Database["public"]["Enums"]["verification_request_status"]
          submission_data?: Json | null
          submitted_at?: string | null
          token_hash?: string
          updated_at?: string
          verification_type?: string
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "cap_table_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_submissions: {
        Row: {
          consent_accepted: boolean
          created_at: string
          id: string
          ip_address: string | null
          payload_json: Json
          user_agent: string | null
          verification_request_id: string
        }
        Insert: {
          consent_accepted?: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          payload_json?: Json
          user_agent?: string | null
          verification_request_id: string
        }
        Update: {
          consent_accepted?: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          payload_json?: Json
          user_agent?: string | null
          verification_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_submissions_verification_request_id_fkey"
            columns: ["verification_request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      waterfall_allocation_lines: {
        Row: {
          amount_original: number
          consideration_type: Database["public"]["Enums"]["consideration_type"]
          created_at: string
          currency_original: string
          id: string
          priority_rank: number
          recipient_id: string
          settlement_currency: string
          updated_at: string
          waterfall_allocation_id: string
        }
        Insert: {
          amount_original?: number
          consideration_type?: Database["public"]["Enums"]["consideration_type"]
          created_at?: string
          currency_original?: string
          id?: string
          priority_rank?: number
          recipient_id: string
          settlement_currency?: string
          updated_at?: string
          waterfall_allocation_id: string
        }
        Update: {
          amount_original?: number
          consideration_type?: Database["public"]["Enums"]["consideration_type"]
          created_at?: string
          currency_original?: string
          id?: string
          priority_rank?: number
          recipient_id?: string
          settlement_currency?: string
          updated_at?: string
          waterfall_allocation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waterfall_allocation_lines_waterfall_allocation_id_fkey"
            columns: ["waterfall_allocation_id"]
            isOneToOne: false
            referencedRelation: "waterfall_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      waterfall_allocations: {
        Row: {
          calculation_version_hash: string
          created_at: string
          deal_id: string
          id: string
          input_totals: Json
          output_summary: Json
          snapshot_at: string
          updated_at: string
        }
        Insert: {
          calculation_version_hash: string
          created_at?: string
          deal_id: string
          id?: string
          input_totals?: Json
          output_summary?: Json
          snapshot_at?: string
          updated_at?: string
        }
        Update: {
          calculation_version_hash?: string
          created_at?: string
          deal_id?: string
          id?: string
          input_totals?: Json
          output_summary?: Json
          snapshot_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waterfall_allocations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      waterfall_tiers: {
        Row: {
          allocation_logic_type: Database["public"]["Enums"]["allocation_logic_type"]
          created_at: string
          deal_id: string
          id: string
          name: string
          params: Json
          tier_rank: number
          updated_at: string
        }
        Insert: {
          allocation_logic_type?: Database["public"]["Enums"]["allocation_logic_type"]
          created_at?: string
          deal_id: string
          id?: string
          name: string
          params?: Json
          tier_rank: number
          updated_at?: string
        }
        Update: {
          allocation_logic_type?: Database["public"]["Enums"]["allocation_logic_type"]
          created_at?: string
          deal_id?: string
          id?: string
          name?: string
          params?: Json
          tier_rank?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waterfall_tiers_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      wire_instruction_history: {
        Row: {
          banking_changed: boolean
          changed_by: string | null
          changed_by_source: string
          changed_fields: string[]
          created_at: string
          deal_id: string
          id: string
          new_values: Json
          previous_values: Json
          previous_verification_status: string | null
          source_document_id: string | null
          wire_instruction_id: string
        }
        Insert: {
          banking_changed?: boolean
          changed_by?: string | null
          changed_by_source?: string
          changed_fields?: string[]
          created_at?: string
          deal_id: string
          id?: string
          new_values?: Json
          previous_values?: Json
          previous_verification_status?: string | null
          source_document_id?: string | null
          wire_instruction_id: string
        }
        Update: {
          banking_changed?: boolean
          changed_by?: string | null
          changed_by_source?: string
          changed_fields?: string[]
          created_at?: string
          deal_id?: string
          id?: string
          new_values?: Json
          previous_values?: Json
          previous_verification_status?: string | null
          source_document_id?: string | null
          wire_instruction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wire_instruction_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wire_instruction_history_wire_instruction_id_fkey"
            columns: ["wire_instruction_id"]
            isOneToOne: false
            referencedRelation: "wire_instructions"
            referencedColumns: ["id"]
          },
        ]
      }
      wire_instructions: {
        Row: {
          account_holder: string | null
          account_number_last4: string | null
          amount: number
          bank_name: string | null
          confidence_status: string
          created_at: string
          created_by_source: string
          created_by_user_id: string | null
          currency: string
          deal_id: string
          iban: string | null
          id: string
          last_updated_by_source: string
          last_updated_by_user_id: string | null
          locked: boolean
          locked_reason: string | null
          needs_review: boolean
          payee_entity: string
          payer_entity: string | null
          payment_type: string
          routing_number: string | null
          source_document_id: string | null
          swift_bic: string | null
          updated_at: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_holder?: string | null
          account_number_last4?: string | null
          amount?: number
          bank_name?: string | null
          confidence_status?: string
          created_at?: string
          created_by_source?: string
          created_by_user_id?: string | null
          currency?: string
          deal_id: string
          iban?: string | null
          id?: string
          last_updated_by_source?: string
          last_updated_by_user_id?: string | null
          locked?: boolean
          locked_reason?: string | null
          needs_review?: boolean
          payee_entity: string
          payer_entity?: string | null
          payment_type?: string
          routing_number?: string | null
          source_document_id?: string | null
          swift_bic?: string | null
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_holder?: string | null
          account_number_last4?: string | null
          amount?: number
          bank_name?: string | null
          confidence_status?: string
          created_at?: string
          created_by_source?: string
          created_by_user_id?: string | null
          currency?: string
          deal_id?: string
          iban?: string | null
          id?: string
          last_updated_by_source?: string
          last_updated_by_user_id?: string | null
          locked?: boolean
          locked_reason?: string | null
          needs_review?: boolean
          payee_entity?: string
          payer_entity?: string | null
          payment_type?: string
          routing_number?: string | null
          source_document_id?: string | null
          swift_bic?: string | null
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wire_instructions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wire_instructions_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      deal_entity_graph: {
        Row: {
          deal_id: string | null
          effective_date: string | null
          entity_from_canonical_id: string | null
          entity_from_canonical_name: string | null
          entity_from_id: string | null
          entity_from_metadata: Json | null
          entity_from_name: string | null
          entity_from_type: string | null
          entity_from_variants: string[] | null
          entity_to_canonical_id: string | null
          entity_to_canonical_name: string | null
          entity_to_id: string | null
          entity_to_metadata: Json | null
          entity_to_name: string | null
          entity_to_type: string | null
          entity_to_variants: string[] | null
          provenance: string | null
          relationship_confidence: number | null
          relationship_created_at: string | null
          relationship_id: string | null
          relationship_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relationships_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_organization_invite: { Args: { _token: string }; Returns: Json }
      ack_job_message: {
        Args: { p_msg_id: number; p_queue_name: string }
        Returns: boolean
      }
      apply_checklist_template_to_deal: {
        Args: { _deal_id: string; _template_id: string }
        Returns: number
      }
      bump_minor_version: { Args: { _version: string }; Returns: string }
      can_access_deal: {
        Args: { _deal_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_intelligence: { Args: { _user_id: string }; Returns: boolean }
      can_manage_org_templates: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_write_deal: {
        Args: { _deal_id: string; _user_id: string }
        Returns: boolean
      }
      claim_next_job: {
        Args: {
          p_qty?: number
          p_queue_name: string
          p_visibility_timeout?: number
        }
        Returns: {
          job_status_id: string
          job_type: string
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      complete_job_processing: {
        Args: { p_job_status_id: string; p_result?: Json }
        Returns: {
          attempts: number
          completed_at: string | null
          deal_id: string | null
          error: string | null
          id: string
          job_type: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          queue_name: string
          queued_at: string
          result: Json | null
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "job_status"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_event_hash: { Args: { event_id: string }; Returns: string }
      create_checklist_template_version: {
        Args: { _template_id: string }
        Returns: string
      }
      create_workspace: {
        Args: { billing_email_in?: string; workspace_name: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      demo_org_id: { Args: never; Returns: string }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_job_status: {
        Args: {
          p_deal_id: string
          p_job_type: string
          p_max_attempts?: number
          p_payload?: Json
          p_queue_name: string
        }
        Returns: string
      }
      ensure_pgmq_queue_exists: {
        Args: { p_queue_name: string }
        Returns: undefined
      }
      fail_job_processing: {
        Args: {
          p_error: string
          p_job_status_id: string
          p_retry_delay_minutes?: number
        }
        Returns: {
          attempts: number
          completed_at: string | null
          deal_id: string | null
          error: string | null
          id: string
          job_type: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          queue_name: string
          queued_at: string
          result: Json | null
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "job_status"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_checklist_template_analytics: {
        Args: { _template_id: string }
        Returns: {
          avg_completion_rate_with_template: number
          avg_completion_rate_without_template: number
          deals_using_template: number
          most_commonly_added: Json
          most_commonly_deleted: Json
        }[]
      }
      get_checklist_template_diff: {
        Args: { _from_template_id: string; _to_template_id: string }
        Returns: {
          change_type: string
          item_title: string
          next_condition_type: string
          next_description: string
          previous_condition_type: string
          previous_description: string
        }[]
      }
      get_condition_precedent_benchmarks: {
        Args: { _deal_id: string }
        Returns: {
          average_days_to_satisfaction: number
          benchmark_sample_size: number
          cp_type: string
          current_days_outstanding: number
          has_minimum_group: boolean
          status_indicator: string
        }[]
      }
      get_deal_benchmark_panel: {
        Args: { _deal_id: string }
        Returns: {
          benchmark_conditions_satisfied_pct: number
          benchmark_days_since_signing: number
          benchmark_open_discrepancies: number
          benchmark_sample_size: number
          current_conditions_satisfied_pct: number
          current_days_since_signing: number
          current_open_discrepancies: number
          deal_id: string
          deal_type: string
          has_minimum_group: boolean
        }[]
      }
      get_job_status: {
        Args: { p_job_status_id: string }
        Returns: {
          attempts: number
          completed_at: string | null
          deal_id: string | null
          error: string | null
          id: string
          job_type: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          queue_name: string
          queued_at: string
          result: Json | null
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "job_status"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_deal_role: {
        Args: {
          _deal_id: string
          _role: Database["public"]["Enums"]["deal_execution_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_org_role: {
        Args: { _org_id: string; _required_role: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_admin: { Args: { _user_id: string }; Returns: boolean }
      is_deal_accessible: {
        Args: { _deal_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      re_create_workspace: { Args: { workspace_name: string }; Returns: string }
      re_user_in_org: { Args: { target_org: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_field_correction:
        | {
            Args: {
              p_ai_confidence?: number
              p_ai_output: string
              p_document_span?: Json
              p_field_name: string
              p_human_correction: string
              p_record_id: string
              p_table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              p_ai_confidence?: number
              p_ai_output: string
              p_document_span?: Json
              p_field_name: string
              p_human_correction: string
              p_record_id: string
              p_resolution_type?: string
              p_table_name: string
            }
            Returns: string
          }
      regulatory_condition_checklist_status: {
        Args: { _filed_at: string; _status: string }
        Returns: string
      }
      requirement_reminder_sent: {
        Args: { _request_id: string }
        Returns: undefined
      }
      requirement_reminders_due: {
        Args: { _limit?: number }
        Returns: {
          deal_id: string
          due_date: string
          escalate_to: string
          internal_owner_id: string
          is_escalation: boolean
          recipient_email: string
          recipient_name: string
          reminder_number: number
          request_id: string
          requirement_id: string
          requirement_title: string
        }[]
      }
      search_entities: {
        Args: { entity_type?: string; search_term: string }
        Returns: {
          canonical_id: string
          canonical_name: string
          created_by_source: string
          entity_id: string
          entity_type: string
          matched_name: string
          metadata: Json
          similarity_score: number
          source_deal_id: string
        }[]
      }
      soft_delete_deal: { Args: { _deal_id: string }; Returns: boolean }
      start_job_processing: {
        Args: { p_job_status_id: string }
        Returns: {
          attempts: number
          completed_at: string | null
          deal_id: string | null
          error: string | null
          id: string
          job_type: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          queue_name: string
          queued_at: string
          result: Json | null
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "job_status"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      template_rule_matches: {
        Args: { _deal_type: string; _deal_value: number; _rules: Json }
        Returns: boolean
      }
      user_org_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      allocation_logic_type: "fixed" | "percentage" | "pro_rata" | "threshold"
      app_role:
        | "admin"
        | "participant"
        | "super_admin"
        | "ops_admin"
        | "support_admin"
        | "read_only"
        | "intelligence"
      compliance_check_status:
        | "pending"
        | "submitted"
        | "under_review"
        | "passed"
        | "failed"
      compliance_check_type:
        | "kyb_entity_verification"
        | "ubo_verification"
        | "sanctions_screening"
        | "pep_screening"
        | "tax_form_validation"
      condition_status:
        | "NOT_STARTED"
        | "IN_PROGRESS"
        | "SATISFIED"
        | "WAIVED"
        | "BLOCKED"
      consideration_status: "draft" | "pending" | "executed" | "confirmed"
      consideration_type:
        | "cash"
        | "shares"
        | "seller_note"
        | "earnout"
        | "rollover_equity"
        | "debt_assumption"
        | "escrow_holdback"
        | "contingent"
      contract_doc_status:
        | "UPLOADED"
        | "TEXT_EXTRACTED"
        | "EXTRACTION_COMPLETE"
        | "ERROR"
        | "PROCESSING"
        | "PARSED"
        | "PARSE_FAILED"
        | "VERIFIED"
      contract_doc_type:
        | "SPA"
        | "FUNDS_FLOW"
        | "ESCROW_AGREEMENT"
        | "PAYOFF_LETTER"
        | "FEE_LETTER"
        | "OTHER"
        | "DISCLOSURE_SCHEDULES"
        | "WIRE_AUTHORIZATION"
        | "WIRE_INSTRUCTIONS"
        | "BOARD_CONSENT"
        | "SECRETARY_CERTIFICATE"
        | "OFFICER_CERTIFICATE"
        | "BRING_DOWN_CERTIFICATE"
        | "CAP_TABLE"
        | "WORKING_CAPITAL_STATEMENT"
        | "LEGAL_OPINION"
        | "EMPLOYMENT_AGREEMENT"
        | "IP_ASSIGNMENT"
        | "NON_COMPETE"
        | "TSA"
        | "THIRD_PARTY_CONSENT"
        | "W9"
        | "GOOD_STANDING"
        | "SIDE_LETTER"
        | "EARNOUT"
        | "WATERFALL_MODEL"
        | "PURCHASE_PRICE_ALLOCATION"
        | "ESCROW_ALLOCATION"
        | "DISTRIBUTION_SCHEDULE"
        | "BOARD_RESOLUTION"
        | "SHAREHOLDER_APPROVAL"
        | "WRITTEN_CONSENT"
        | "W8BEN"
        | "W8BENE"
        | "FATCA"
        | "WITHHOLDING"
        | "TAX_RESIDENCY"
      deal_execution_role: "VIEWER" | "EDITOR" | "APPROVER" | "EXECUTOR"
      deal_kind: "demo" | "template" | "live"
      deal_member_role:
        | "BUYER_COUNSEL"
        | "SELLER_COUNSEL"
        | "DEAL_LEAD"
        | "FINANCE_APPROVER"
        | "OPERATIONS"
        | "VIEWER"
      deal_state:
        | "draft"
        | "verification_pending"
        | "structuring"
        | "conditions_pending"
        | "ready_for_execution"
        | "executing"
        | "settled"
        | "archived"
      disbursement_status:
        | "draft"
        | "pending_conditions"
        | "pending_approvals"
        | "eligible"
        | "executing"
        | "executed"
        | "settled"
        | "reconciled"
        | "failed"
      discrepancy_scope: "deal" | "intent" | "document" | "party"
      discrepancy_severity: "blocker" | "warn" | "info"
      discrepancy_status: "open" | "acknowledged" | "resolved" | "suppressed"
      fx_risk_bearer: "buyer" | "seller" | "shared"
      graph_edge_type:
        | "HAS_PARTY"
        | "HAS_DOCUMENT"
        | "REQUIRES"
        | "SATISFIES"
        | "BLOCKS"
        | "PAYS"
        | "DERIVED_FROM"
        | "RESULTS_IN"
      graph_node_status:
        | "not_started"
        | "in_progress"
        | "complete"
        | "blocked"
        | "failed"
      graph_node_type:
        | "deal"
        | "stakeholder"
        | "document"
        | "obligation"
        | "compliance_check"
        | "approval"
        | "payment_intent"
        | "settlement"
        | "waterfall"
        | "discrepancy"
      kyc_status:
        | "not_started"
        | "draft"
        | "submitted"
        | "in_review"
        | "approved"
        | "rejected"
      obligation_amount_type:
        | "FIXED"
        | "PERCENT_OF_BASE"
        | "FORMULA"
        | "UNKNOWN"
      obligation_mapping_status: "UNMAPPED" | "PARTIALLY_MAPPED" | "MAPPED"
      obligation_status:
        | "DRAFT_EXTRACTED"
        | "NEEDS_REVIEW"
        | "CONFIRMED"
        | "REJECTED"
        | "SUPERSEDED"
      obligation_timing:
        | "AT_CLOSING"
        | "PRE_CLOSING"
        | "POST_CLOSING"
        | "ON_CONDITION"
        | "ON_DATE"
      obligation_type:
        | "PURCHASE_PRICE_BASE"
        | "PURCHASE_PRICE_ADJUSTMENT"
        | "ESCROW_HOLD_BACK"
        | "DEBT_PAYOFF"
        | "SELLER_PROCEEDS"
        | "BROKER_FEE"
        | "LEGAL_FEE"
        | "ADVISORY_FEE"
        | "TAX_WITHHOLDING"
        | "EARNOUT_RESERVE"
        | "WORKING_CAPITAL_TRUE_UP"
        | "INDEMNITY_RESERVE"
        | "OTHER"
      ontology_approval_status: "PENDING" | "APPROVED" | "REJECTED"
      ontology_approval_type:
        | "LEGAL_SIGNOFF"
        | "FINANCE_SIGNOFF"
        | "KYC_APPROVAL"
        | "KYB_APPROVAL"
      ontology_doc_type:
        | "SPA"
        | "ESCROW_AGREEMENT"
        | "PAYMENT_INSTRUCTIONS"
        | "OTHER"
      ontology_entity_type:
        | "core_entity"
        | "workflow_entity"
        | "compliance_entity"
        | "computed_entity"
      ontology_status: "draft" | "active" | "deprecated"
      party_type: "BUYER" | "SELLER" | "ESCROW_AGENT" | "LENDER" | "OTHER"
      payment_status: "DRAFT" | "READY" | "SENT" | "CONFIRMED"
      verification_request_status:
        | "pending"
        | "sent"
        | "opened"
        | "submitted"
        | "verified"
        | "expired"
        | "revoked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      allocation_logic_type: ["fixed", "percentage", "pro_rata", "threshold"],
      app_role: [
        "admin",
        "participant",
        "super_admin",
        "ops_admin",
        "support_admin",
        "read_only",
        "intelligence",
      ],
      compliance_check_status: [
        "pending",
        "submitted",
        "under_review",
        "passed",
        "failed",
      ],
      compliance_check_type: [
        "kyb_entity_verification",
        "ubo_verification",
        "sanctions_screening",
        "pep_screening",
        "tax_form_validation",
      ],
      condition_status: [
        "NOT_STARTED",
        "IN_PROGRESS",
        "SATISFIED",
        "WAIVED",
        "BLOCKED",
      ],
      consideration_status: ["draft", "pending", "executed", "confirmed"],
      consideration_type: [
        "cash",
        "shares",
        "seller_note",
        "earnout",
        "rollover_equity",
        "debt_assumption",
        "escrow_holdback",
        "contingent",
      ],
      contract_doc_status: [
        "UPLOADED",
        "TEXT_EXTRACTED",
        "EXTRACTION_COMPLETE",
        "ERROR",
        "PROCESSING",
        "PARSED",
        "PARSE_FAILED",
        "VERIFIED",
      ],
      contract_doc_type: [
        "SPA",
        "FUNDS_FLOW",
        "ESCROW_AGREEMENT",
        "PAYOFF_LETTER",
        "FEE_LETTER",
        "OTHER",
        "DISCLOSURE_SCHEDULES",
        "WIRE_AUTHORIZATION",
        "WIRE_INSTRUCTIONS",
        "BOARD_CONSENT",
        "SECRETARY_CERTIFICATE",
        "OFFICER_CERTIFICATE",
        "BRING_DOWN_CERTIFICATE",
        "CAP_TABLE",
        "WORKING_CAPITAL_STATEMENT",
        "LEGAL_OPINION",
        "EMPLOYMENT_AGREEMENT",
        "IP_ASSIGNMENT",
        "NON_COMPETE",
        "TSA",
        "THIRD_PARTY_CONSENT",
        "W9",
        "GOOD_STANDING",
        "SIDE_LETTER",
        "EARNOUT",
        "WATERFALL_MODEL",
        "PURCHASE_PRICE_ALLOCATION",
        "ESCROW_ALLOCATION",
        "DISTRIBUTION_SCHEDULE",
        "BOARD_RESOLUTION",
        "SHAREHOLDER_APPROVAL",
        "WRITTEN_CONSENT",
        "W8BEN",
        "W8BENE",
        "FATCA",
        "WITHHOLDING",
        "TAX_RESIDENCY",
      ],
      deal_execution_role: ["VIEWER", "EDITOR", "APPROVER", "EXECUTOR"],
      deal_kind: ["demo", "template", "live"],
      deal_member_role: [
        "BUYER_COUNSEL",
        "SELLER_COUNSEL",
        "DEAL_LEAD",
        "FINANCE_APPROVER",
        "OPERATIONS",
        "VIEWER",
      ],
      deal_state: [
        "draft",
        "verification_pending",
        "structuring",
        "conditions_pending",
        "ready_for_execution",
        "executing",
        "settled",
        "archived",
      ],
      disbursement_status: [
        "draft",
        "pending_conditions",
        "pending_approvals",
        "eligible",
        "executing",
        "executed",
        "settled",
        "reconciled",
        "failed",
      ],
      discrepancy_scope: ["deal", "intent", "document", "party"],
      discrepancy_severity: ["blocker", "warn", "info"],
      discrepancy_status: ["open", "acknowledged", "resolved", "suppressed"],
      fx_risk_bearer: ["buyer", "seller", "shared"],
      graph_edge_type: [
        "HAS_PARTY",
        "HAS_DOCUMENT",
        "REQUIRES",
        "SATISFIES",
        "BLOCKS",
        "PAYS",
        "DERIVED_FROM",
        "RESULTS_IN",
      ],
      graph_node_status: [
        "not_started",
        "in_progress",
        "complete",
        "blocked",
        "failed",
      ],
      graph_node_type: [
        "deal",
        "stakeholder",
        "document",
        "obligation",
        "compliance_check",
        "approval",
        "payment_intent",
        "settlement",
        "waterfall",
        "discrepancy",
      ],
      kyc_status: [
        "not_started",
        "draft",
        "submitted",
        "in_review",
        "approved",
        "rejected",
      ],
      obligation_amount_type: [
        "FIXED",
        "PERCENT_OF_BASE",
        "FORMULA",
        "UNKNOWN",
      ],
      obligation_mapping_status: ["UNMAPPED", "PARTIALLY_MAPPED", "MAPPED"],
      obligation_status: [
        "DRAFT_EXTRACTED",
        "NEEDS_REVIEW",
        "CONFIRMED",
        "REJECTED",
        "SUPERSEDED",
      ],
      obligation_timing: [
        "AT_CLOSING",
        "PRE_CLOSING",
        "POST_CLOSING",
        "ON_CONDITION",
        "ON_DATE",
      ],
      obligation_type: [
        "PURCHASE_PRICE_BASE",
        "PURCHASE_PRICE_ADJUSTMENT",
        "ESCROW_HOLD_BACK",
        "DEBT_PAYOFF",
        "SELLER_PROCEEDS",
        "BROKER_FEE",
        "LEGAL_FEE",
        "ADVISORY_FEE",
        "TAX_WITHHOLDING",
        "EARNOUT_RESERVE",
        "WORKING_CAPITAL_TRUE_UP",
        "INDEMNITY_RESERVE",
        "OTHER",
      ],
      ontology_approval_status: ["PENDING", "APPROVED", "REJECTED"],
      ontology_approval_type: [
        "LEGAL_SIGNOFF",
        "FINANCE_SIGNOFF",
        "KYC_APPROVAL",
        "KYB_APPROVAL",
      ],
      ontology_doc_type: [
        "SPA",
        "ESCROW_AGREEMENT",
        "PAYMENT_INSTRUCTIONS",
        "OTHER",
      ],
      ontology_entity_type: [
        "core_entity",
        "workflow_entity",
        "compliance_entity",
        "computed_entity",
      ],
      ontology_status: ["draft", "active", "deprecated"],
      party_type: ["BUYER", "SELLER", "ESCROW_AGENT", "LENDER", "OTHER"],
      payment_status: ["DRAFT", "READY", "SENT", "CONFIRMED"],
      verification_request_status: [
        "pending",
        "sent",
        "opened",
        "submitted",
        "verified",
        "expired",
        "revoked",
      ],
    },
  },
} as const
