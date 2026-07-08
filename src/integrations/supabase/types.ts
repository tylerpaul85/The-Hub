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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_availability: {
        Row: {
          agent_id: string
          created_at: string
          date_end: string
          date_start: string
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          date_end: string
          date_start: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          date_end?: string
          date_start?: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_availability_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "duty_calendar_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      closing_gift_inventory: {
        Row: {
          color: string
          color_hex: string
          created_at: string
          id: string
          quantity_available: number
          size: string
          updated_at: string
        }
        Insert: {
          color: string
          color_hex: string
          created_at?: string
          id?: string
          quantity_available?: number
          size: string
          updated_at?: string
        }
        Update: {
          color?: string
          color_hex?: string
          created_at?: string
          id?: string
          quantity_available?: number
          size?: string
          updated_at?: string
        }
        Relationships: []
      }
      closing_gift_requests: {
        Row: {
          agent_name: string
          client_first_name: string
          client_last_name: string
          closing_date: string | null
          closing_location: string | null
          comments: string | null
          created_at: string
          id: string
          shirts: Json
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_name: string
          client_first_name: string
          client_last_name: string
          closing_date?: string | null
          closing_location?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          shirts?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_name?: string
          client_first_name?: string
          client_last_name?: string
          closing_date?: string | null
          closing_location?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          shirts?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      content_archive: {
        Row: {
          agent_name: string | null
          brand: string
          campaign_tag: string | null
          content_type: string
          created_at: string
          date_created: string
          drive_url: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          listing_address: string | null
          notes: string | null
          platforms: string[]
          source_content_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          agent_name?: string | null
          brand?: string
          campaign_tag?: string | null
          content_type: string
          created_at?: string
          date_created?: string
          drive_url?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          listing_address?: string | null
          notes?: string | null
          platforms?: string[]
          source_content_id?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          agent_name?: string | null
          brand?: string
          campaign_tag?: string | null
          content_type?: string
          created_at?: string
          date_created?: string
          drive_url?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          listing_address?: string | null
          notes?: string | null
          platforms?: string[]
          source_content_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_archive_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_comments: {
        Row: {
          body: string
          content_id: string
          created_at: string
          id: string
          image_urls: string[]
          mentions: string[]
          user_id: string
        }
        Insert: {
          body: string
          content_id: string
          created_at?: string
          id?: string
          image_urls?: string[]
          mentions?: string[]
          user_id: string
        }
        Update: {
          body?: string
          content_id?: string
          created_at?: string
          id?: string
          image_urls?: string[]
          mentions?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_comments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_history: {
        Row: {
          content_id: string
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          content_id: string
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          blog_content: string | null
          blog_doc_link: string | null
          brand: string
          canva_link: string | null
          caption: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email_body: string | null
          email_subject_line: string | null
          id: string
          image_urls: string[]
          link: string | null
          meta_copy: string | null
          meta_graphic_link: string | null
          meta_media_link: string | null
          meta_video_link: string | null
          note_attachments: Json
          notes: string | null
          platforms: string[]
          priority: Database["public"]["Enums"]["content_priority"]
          revision_note: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["content_status"]
          target_publish_date: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          youtube_thumbnail_url: string | null
          youtube_video_title: string | null
        }
        Insert: {
          blog_content?: string | null
          blog_doc_link?: string | null
          brand?: string
          canva_link?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_body?: string | null
          email_subject_line?: string | null
          id?: string
          image_urls?: string[]
          link?: string | null
          meta_copy?: string | null
          meta_graphic_link?: string | null
          meta_media_link?: string | null
          meta_video_link?: string | null
          note_attachments?: Json
          notes?: string | null
          platforms?: string[]
          priority?: Database["public"]["Enums"]["content_priority"]
          revision_note?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["content_status"]
          target_publish_date?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          youtube_thumbnail_url?: string | null
          youtube_video_title?: string | null
        }
        Update: {
          blog_content?: string | null
          blog_doc_link?: string | null
          brand?: string
          canva_link?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_body?: string | null
          email_subject_line?: string | null
          id?: string
          image_urls?: string[]
          link?: string | null
          meta_copy?: string | null
          meta_graphic_link?: string | null
          meta_media_link?: string | null
          meta_video_link?: string | null
          note_attachments?: Json
          notes?: string | null
          platforms?: string[]
          priority?: Database["public"]["Enums"]["content_priority"]
          revision_note?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["content_status"]
          target_publish_date?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          youtube_thumbnail_url?: string | null
          youtube_video_title?: string | null
        }
        Relationships: []
      }
      duty_calendar: {
        Row: {
          assigned_agent_id: string | null
          created_at: string
          duty_day: number
          id: string
          month: number
          office: string
          updated_at: string
          year: number
        }
        Insert: {
          assigned_agent_id?: string | null
          created_at?: string
          duty_day: number
          id?: string
          month: number
          office: string
          updated_at?: string
          year: number
        }
        Update: {
          assigned_agent_id?: string | null
          created_at?: string
          duty_day?: number
          id?: string
          month?: number
          office?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "duty_calendar_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "duty_calendar_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_calendar_agents: {
        Row: {
          created_at: string
          id: string
          name: string
          office: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          office: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          office?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_checklist_items: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          event_id: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_checklist_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_content_suggestions: {
        Row: {
          content_id: string | null
          created_at: string
          event_id: string
          id: string
          slot_type: string
          status: string
          suggested_date: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          slot_type: string
          status?: string
          suggested_date: string
        }
        Update: {
          content_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          slot_type?: string
          status?: string
          suggested_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_content_suggestions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_content_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          budget: number | null
          created_at: string
          created_by: string | null
          event_date: string
          event_time: string | null
          headcount: number | null
          hosts: string[]
          id: string
          linked_listing: string | null
          location: string | null
          name: string
          notes: string | null
          type: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          created_by?: string | null
          event_date: string
          event_time?: string | null
          headcount?: number | null
          hosts?: string[]
          id?: string
          linked_listing?: string | null
          location?: string | null
          name: string
          notes?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_time?: string | null
          headcount?: number | null
          hosts?: string[]
          id?: string
          linked_listing?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      headlines: {
        Row: {
          converted_issue_id: string | null
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["headline_kind"]
          meeting_id: string | null
          reviewed_at: string | null
          submitted_by: string
          title: string
        }
        Insert: {
          converted_issue_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["headline_kind"]
          meeting_id?: string | null
          reviewed_at?: string | null
          submitted_by: string
          title: string
        }
        Update: {
          converted_issue_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["headline_kind"]
          meeting_id?: string | null
          reviewed_at?: string | null
          submitted_by?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "headlines_converted_issue_id_fkey"
            columns: ["converted_issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "headlines_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          issue_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          issue_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          issue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_notes_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          converted_rock_id: string | null
          created_at: string
          description: string | null
          id: string
          meeting_id: string | null
          outcome_note: string | null
          status: Database["public"]["Enums"]["issue_status"]
          submitted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          converted_rock_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          meeting_id?: string | null
          outcome_note?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          submitted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          converted_rock_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          meeting_id?: string | null
          outcome_note?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          submitted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_converted_rock_id_fkey"
            columns: ["converted_rock_id"]
            isOneToOne: false
            referencedRelation: "rocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_meeting_issue_priorities: {
        Row: {
          created_at: string
          issue_id: string
          meeting_id: string
          rank: number
        }
        Insert: {
          created_at?: string
          issue_id: string
          meeting_id: string
          rank: number
        }
        Update: {
          created_at?: string
          issue_id?: string
          meeting_id?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "l10_meeting_issue_priorities_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_meeting_issue_priorities_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_meeting_ratings: {
        Row: {
          created_at: string
          meeting_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          meeting_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          meeting_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "l10_meeting_ratings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      l10_meetings: {
        Row: {
          attendees: string[]
          completed_at: string | null
          completed_by: string | null
          conclude_notes: string | null
          created_at: string
          created_by: string | null
          headlines: string | null
          id: string
          meeting_date: string
          meeting_rating: number | null
          segue: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendees?: string[]
          completed_at?: string | null
          completed_by?: string | null
          conclude_notes?: string | null
          created_at?: string
          created_by?: string | null
          headlines?: string | null
          id?: string
          meeting_date: string
          meeting_rating?: number | null
          segue?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attendees?: string[]
          completed_at?: string | null
          completed_by?: string | null
          conclude_notes?: string | null
          created_at?: string
          created_by?: string | null
          headlines?: string | null
          id?: string
          meeting_date?: string
          meeting_rating?: number | null
          segue?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      l10_rock_reviews: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          rock_id: string
          status: Database["public"]["Enums"]["rock_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          rock_id: string
          status?: Database["public"]["Enums"]["rock_status"]
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          rock_id?: string
          status?: Database["public"]["Enums"]["rock_status"]
        }
        Relationships: [
          {
            foreignKeyName: "l10_rock_reviews_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "l10_rock_reviews_rock_id_fkey"
            columns: ["rock_id"]
            isOneToOne: false
            referencedRelation: "rocks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_requests: {
        Row: {
          agent_email: string
          agent_name: string
          closing_gift: Json | null
          closing_gift_completed_at: string | null
          closing_gift_completed_by: string | null
          converted_content_id: string | null
          converted_task_id: string | null
          converted_video_id: string | null
          copy_notes: string | null
          created_at: string
          deadline: string | null
          decline_note: string | null
          description: string
          file_urls: string[]
          id: string
          priority: string
          property_address: string | null
          request_types: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_email: string
          agent_name: string
          closing_gift?: Json | null
          closing_gift_completed_at?: string | null
          closing_gift_completed_by?: string | null
          converted_content_id?: string | null
          converted_task_id?: string | null
          converted_video_id?: string | null
          copy_notes?: string | null
          created_at?: string
          deadline?: string | null
          decline_note?: string | null
          description: string
          file_urls?: string[]
          id?: string
          priority?: string
          property_address?: string | null
          request_types?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_email?: string
          agent_name?: string
          closing_gift?: Json | null
          closing_gift_completed_at?: string | null
          closing_gift_completed_by?: string | null
          converted_content_id?: string | null
          converted_task_id?: string | null
          converted_video_id?: string | null
          copy_notes?: string | null
          created_at?: string
          deadline?: string | null
          decline_note?: string | null
          description?: string
          file_urls?: string[]
          id?: string
          priority?: string
          property_address?: string | null
          request_types?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_requests_converted_content_id_fkey"
            columns: ["converted_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_requests_converted_video_id_fkey"
            columns: ["converted_video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content_id: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          task_id: string | null
          type: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          id?: string
          message: string
          read?: boolean
          task_id?: string | null
          type: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          task_id?: string | null
          type?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      process_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      process_run_steps: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          id: string
          label: string
          run_id: string
          step_index: number
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          id?: string
          label: string
          run_id: string
          step_index: number
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          id?: string
          label?: string
          run_id?: string
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "process_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "process_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      process_runs: {
        Row: {
          completed_at: string | null
          id: string
          process_id: string
          started_at: string
          started_by: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          process_id: string
          started_at?: string
          started_by: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          process_id?: string
          started_at?: string
          started_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_runs_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          category_id: string | null
          checklist_mode: boolean
          content: string
          created_at: string
          id: string
          last_updated_by: string | null
          steps: Json
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          checklist_mode?: boolean
          content?: string
          created_at?: string
          id?: string
          last_updated_by?: string | null
          steps?: Json
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          checklist_mode?: boolean
          content?: string
          created_at?: string
          id?: string
          last_updated_by?: string | null
          steps?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "process_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_active_at: string | null
          last_name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_active_at?: string | null
          last_name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_active_at?: string | null
          last_name?: string | null
        }
        Relationships: []
      }
      project_private_notes: {
        Row: {
          created_at: string
          id: string
          notes: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_private_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          owner: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          owner?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          owner?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          key: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          key: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      recurring_task_templates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          description: string | null
          frequency: string
          id: string
          interval_days: number | null
          last_generated_on: string | null
          next_due_on: string
          owner: string | null
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          frequency: string
          id?: string
          interval_days?: number | null
          last_generated_on?: string | null
          next_due_on: string
          owner?: string | null
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          frequency?: string
          id?: string
          interval_days?: number | null
          last_generated_on?: string | null
          next_due_on?: string
          owner?: string | null
          priority?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      rock_milestones: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          rock_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          rock_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          rock_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rock_milestones_rock_id_fkey"
            columns: ["rock_id"]
            isOneToOne: false
            referencedRelation: "rocks"
            referencedColumns: ["id"]
          },
        ]
      }
      rocks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          owner: string
          quarter: string
          status: Database["public"]["Enums"]["rock_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner: string
          quarter: string
          status?: Database["public"]["Enums"]["rock_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner?: string
          quarter?: string
          status?: Database["public"]["Enums"]["rock_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      scorecard_entries: {
        Row: {
          actual_value: number
          created_at: string
          id: string
          measurable_id: string
          meeting_id: string
        }
        Insert: {
          actual_value?: number
          created_at?: string
          id?: string
          measurable_id: string
          meeting_id: string
        }
        Update: {
          actual_value?: number
          created_at?: string
          id?: string
          measurable_id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_entries_measurable_id_fkey"
            columns: ["measurable_id"]
            isOneToOne: false
            referencedRelation: "scorecard_measurables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scorecard_entries_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecard_measurables: {
        Row: {
          created_at: string
          goal_direction: string
          id: string
          label: string
          owner_id: string | null
          sort_order: number
          source: string | null
          updated_at: string
          weekly_target: string
        }
        Insert: {
          created_at?: string
          goal_direction?: string
          id?: string
          label: string
          owner_id?: string | null
          sort_order?: number
          source?: string | null
          updated_at?: string
          weekly_target?: string
        }
        Update: {
          created_at?: string
          goal_direction?: string
          id?: string
          label?: string
          owner_id?: string | null
          sort_order?: number
          source?: string | null
          updated_at?: string
          weekly_target?: string
        }
        Relationships: []
      }
      scorecard_weekly_entries: {
        Row: {
          actual_value: number
          created_at: string
          id: string
          measurable_id: string
          submitted_by: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          actual_value: number
          created_at?: string
          id?: string
          measurable_id: string
          submitted_by?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          actual_value?: number
          created_at?: string
          id?: string
          measurable_id?: string
          submitted_by?: string | null
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_weekly_entries_measurable_id_fkey"
            columns: ["measurable_id"]
            isOneToOne: false
            referencedRelation: "scorecard_measurables"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json
          target_id: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          target_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          target_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      staging_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          instantdeco_request_id: string | null
          listing_address: string | null
          prompt: string | null
          result_urls: Json | null
          room_type: string | null
          source_image_url: string
          status: string
          style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          instantdeco_request_id?: string | null
          listing_address?: string | null
          prompt?: string | null
          result_urls?: Json | null
          room_type?: string | null
          source_image_url: string
          status?: string
          style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          instantdeco_request_id?: string | null
          listing_address?: string | null
          prompt?: string | null
          result_urls?: Json | null
          room_type?: string | null
          source_image_url?: string
          status?: string
          style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          mentions: string[]
          task_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mentions?: string[]
          task_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mentions?: string[]
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_deliverables: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          label: string | null
          link_url: string | null
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          label?: string | null
          link_url?: string | null
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          label?: string | null
          link_url?: string | null
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agent_email: string | null
          agent_name: string | null
          attached_request_files: string[]
          content_item_id: string | null
          created_at: string
          created_by: string | null
          deliverable_sent_at: string | null
          deliverable_sent_by: string | null
          description: string | null
          due_date: string | null
          event_id: string | null
          id: string
          originating_request_id: string | null
          owner: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          recurring_template_id: string | null
          requested_by_name: string | null
          requested_by_user_id: string | null
          sort_order: number | null
          starred: boolean
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agent_email?: string | null
          agent_name?: string | null
          attached_request_files?: string[]
          content_item_id?: string | null
          created_at?: string
          created_by?: string | null
          deliverable_sent_at?: string | null
          deliverable_sent_by?: string | null
          description?: string | null
          due_date?: string | null
          event_id?: string | null
          id?: string
          originating_request_id?: string | null
          owner?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          recurring_template_id?: string | null
          requested_by_name?: string | null
          requested_by_user_id?: string | null
          sort_order?: number | null
          starred?: boolean
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agent_email?: string | null
          agent_name?: string | null
          attached_request_files?: string[]
          content_item_id?: string | null
          created_at?: string
          created_by?: string | null
          deliverable_sent_at?: string | null
          deliverable_sent_by?: string | null
          description?: string | null
          due_date?: string | null
          event_id?: string | null
          id?: string
          originating_request_id?: string | null
          owner?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          recurring_template_id?: string | null
          requested_by_name?: string | null
          requested_by_user_id?: string | null
          sort_order?: number | null
          starred?: boolean
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_originating_request_id_fkey"
            columns: ["originating_request_id"]
            isOneToOne: false
            referencedRelation: "marketing_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          completed: boolean
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          issue_id: string | null
          meeting_id: string | null
          owner: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          issue_id?: string | null
          meeting_id?: string | null
          owner: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          issue_id?: string | null
          meeting_id?: string | null
          owner?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "l10_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_agent_content: {
        Row: {
          agent_id: string
          caption: string | null
          content_type: string
          created_at: string
          drive_url: string | null
          file_size: number | null
          file_url: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          caption?: string | null
          content_type?: string
          created_at?: string
          drive_url?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          caption?: string | null
          content_type?: string
          created_at?: string
          drive_url?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_agent_content_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "toolbox_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_agents: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          headshot_url: string | null
          id: string
          identifier: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          headshot_url?: string | null
          id?: string
          identifier?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          headshot_url?: string | null
          id?: string
          identifier?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      toolbox_assets: {
        Row: {
          asset_type: string
          created_at: string
          created_by: string | null
          drive_url: string | null
          file_url: string | null
          id: string
          listing_id: string
          name: string | null
          thumbnail_url: string | null
        }
        Insert: {
          asset_type: string
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          file_url?: string | null
          id?: string
          listing_id: string
          name?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          file_url?: string | null
          id?: string
          listing_id?: string
          name?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_assets_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "toolbox_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_brand_assets: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          file_size: number | null
          file_url: string
          id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      toolbox_captions: {
        Row: {
          caption_text: string
          created_at: string
          created_by: string | null
          id: string
          listing_id: string
        }
        Insert: {
          caption_text: string
          created_at?: string
          created_by?: string | null
          id?: string
          listing_id: string
        }
        Update: {
          caption_text?: string
          created_at?: string
          created_by?: string | null
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_captions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "toolbox_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_educational: {
        Row: {
          caption: string | null
          category: string
          created_at: string
          created_by: string | null
          drive_url: string | null
          file_size: number | null
          file_url: string | null
          id: string
          title: string
        }
        Insert: {
          caption?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          title: string
        }
        Update: {
          caption?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      toolbox_listings: {
        Row: {
          address: string
          agent_name: string | null
          archived: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          address: string
          agent_name?: string | null
          archived?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          agent_name?: string | null
          archived?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      toolbox_open_house_assets: {
        Row: {
          asset_type: string
          category: string
          created_at: string
          created_by: string | null
          drive_url: string | null
          file_url: string | null
          id: string
          name: string | null
          open_house_id: string
          thumbnail_url: string | null
        }
        Insert: {
          asset_type: string
          category?: string
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          file_url?: string | null
          id?: string
          name?: string | null
          open_house_id: string
          thumbnail_url?: string | null
        }
        Update: {
          asset_type?: string
          category?: string
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          file_url?: string | null
          id?: string
          name?: string | null
          open_house_id?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_open_house_assets_open_house_id_fkey"
            columns: ["open_house_id"]
            isOneToOne: false
            referencedRelation: "toolbox_open_houses"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_open_house_captions: {
        Row: {
          caption_text: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          open_house_id: string
        }
        Insert: {
          caption_text: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          open_house_id: string
        }
        Update: {
          caption_text?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          open_house_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_open_house_captions_open_house_id_fkey"
            columns: ["open_house_id"]
            isOneToOne: false
            referencedRelation: "toolbox_open_houses"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_open_houses: {
        Row: {
          address: string
          agent_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          open_house_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address: string
          agent_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          open_house_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          agent_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          open_house_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          mentions: string[]
          user_id: string
          video_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mentions?: string[]
          user_id: string
          video_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mentions?: string[]
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          brand: string
          campaign_tag: string | null
          created_at: string
          created_by: string | null
          drive_link: string | null
          duration: string | null
          edited_by: string | null
          estimated_publish_date: string | null
          filmed_by: string | null
          id: string
          linked_content_item_id: string | null
          priority: Database["public"]["Enums"]["content_priority"]
          publish_at: string | null
          stage: Database["public"]["Enums"]["video_stage"]
          title: string
          updated_at: string
          video_type: string
        }
        Insert: {
          brand?: string
          campaign_tag?: string | null
          created_at?: string
          created_by?: string | null
          drive_link?: string | null
          duration?: string | null
          edited_by?: string | null
          estimated_publish_date?: string | null
          filmed_by?: string | null
          id?: string
          linked_content_item_id?: string | null
          priority?: Database["public"]["Enums"]["content_priority"]
          publish_at?: string | null
          stage?: Database["public"]["Enums"]["video_stage"]
          title: string
          updated_at?: string
          video_type?: string
        }
        Update: {
          brand?: string
          campaign_tag?: string | null
          created_at?: string
          created_by?: string | null
          drive_link?: string | null
          duration?: string | null
          edited_by?: string | null
          estimated_publish_date?: string | null
          filmed_by?: string | null
          id?: string
          linked_content_item_id?: string | null
          priority?: Database["public"]["Enums"]["content_priority"]
          publish_at?: string | null
          stage?: Database["public"]["Enums"]["video_stage"]
          title?: string
          updated_at?: string
          video_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_linked_content_item_id_fkey"
            columns: ["linked_content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_recurring_task_instances: { Args: never; Returns: number }
      get_team_members: {
        Args: never
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
        }[]
      }
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_l10_meeting_open: { Args: { _meeting_id: string }; Returns: boolean }
      log_security_event: {
        Args: {
          _event_type: string
          _ip_address?: string
          _metadata?: Json
          _target_id?: string
          _target_user_id?: string
          _user_agent?: string
        }
        Returns: string
      }
      next_recurrence_after: {
        Args: {
          _day_of_month: number
          _day_of_week: number
          _frequency: string
          _from: string
          _interval_days: number
        }
        Returns: string
      }
      rate_limit_hit: {
        Args: {
          _bucket: string
          _key: string
          _max: number
          _window_seconds: number
        }
        Returns: boolean
      }
      send_scorecard_weekly_reminders: { Args: never; Returns: number }
    }
    Enums: {
      app_role:
        | "admin"
        | "contributor"
        | "marketing_coordinator"
        | "video_editor"
        | "videographer"
        | "client_care"
      content_priority: "low" | "normal" | "high" | "urgent"
      content_status:
        | "draft"
        | "in_review"
        | "approved"
        | "scheduled"
        | "published"
        | "needs_revision"
        | "pending_re_approval"
      headline_kind: "announcement" | "cascade" | "issue"
      issue_status: "pending" | "open" | "solved" | "tabled" | "converted"
      rock_status: "on_track" | "off_track" | "complete"
      task_priority: "low" | "normal" | "high"
      task_status:
        | "todo"
        | "in_progress"
        | "needs_review"
        | "revision_needed"
        | "complete"
      video_stage: "idea" | "scheduled" | "ready_to_edit" | "ready_to_post"
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
      app_role: [
        "admin",
        "contributor",
        "marketing_coordinator",
        "video_editor",
        "videographer",
        "client_care",
      ],
      content_priority: ["low", "normal", "high", "urgent"],
      content_status: [
        "draft",
        "in_review",
        "approved",
        "scheduled",
        "published",
        "needs_revision",
        "pending_re_approval",
      ],
      headline_kind: ["announcement", "cascade", "issue"],
      issue_status: ["pending", "open", "solved", "tabled", "converted"],
      rock_status: ["on_track", "off_track", "complete"],
      task_priority: ["low", "normal", "high"],
      task_status: [
        "todo",
        "in_progress",
        "needs_review",
        "revision_needed",
        "complete",
      ],
      video_stage: ["idea", "scheduled", "ready_to_edit", "ready_to_post"],
    },
  },
} as const
