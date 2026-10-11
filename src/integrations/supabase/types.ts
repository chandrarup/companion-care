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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          household_id: string | null
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          household_id?: string | null
          id?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          household_id?: string | null
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_concerns: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          resolved_at: string | null
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          resolved_at?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          resolved_at?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_concerns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caregiver_concerns_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      cue_events: {
        Row: {
          created_at: string
          cue_id: string
          id: string
          occurred_at: string
          outcome: string | null
          scheduled_for: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cue_id: string
          id?: string
          occurred_at?: string
          outcome?: string | null
          scheduled_for?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cue_id?: string
          id?: string
          occurred_at?: string
          outcome?: string | null
          scheduled_for?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cue_events_cue_id_fkey"
            columns: ["cue_id"]
            isOneToOne: false
            referencedRelation: "cues"
            referencedColumns: ["id"]
          },
        ]
      }
      cues: {
        Row: {
          active: boolean
          created_at: string
          cue_type: string
          days_of_week: number[]
          deleted_at: string | null
          household_id: string
          id: string
          label: string
          payload: Json
          schedule_times: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cue_type?: string
          days_of_week?: number[]
          deleted_at?: string | null
          household_id: string
          id?: string
          label: string
          payload?: Json
          schedule_times?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cue_type?: string
          days_of_week?: number[]
          deleted_at?: string | null
          household_id?: string
          id?: string
          label?: string
          payload?: Json
          schedule_times?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cues_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          caregiver_distress: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          log_date: string
          mood: string | null
          notes: string | null
          quick_ok: boolean
          sleep_hours: number | null
          sleep_quality: number | null
          updated_at: string
        }
        Insert: {
          caregiver_distress?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          log_date?: string
          mood?: string | null
          notes?: string | null
          quick_ok?: boolean
          sleep_hours?: number | null
          sleep_quality?: number | null
          updated_at?: string
        }
        Update: {
          caregiver_distress?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          log_date?: string
          mood?: string | null
          notes?: string | null
          quick_ok?: boolean
          sleep_hours?: number | null
          sleep_quality?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_responses: {
        Row: {
          answer: string
          created_at: string
          id: string
          keywords: string[]
          label: string
          mode: string
          priority: number
          tag: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          keywords?: string[]
          label: string
          mode?: string
          priority?: number
          tag?: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          keywords?: string[]
          label?: string
          mode?: string
          priority?: number
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      episodes: {
        Row: {
          antecedent: string | null
          caregiver_distress: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          household_id: string
          id: string
          intervention_tried: string | null
          occurred_at: string
          outcome: string | null
          severity: number | null
          symptom: string | null
          time_of_day: string | null
          updated_at: string
        }
        Insert: {
          antecedent?: string | null
          caregiver_distress?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          household_id: string
          id?: string
          intervention_tried?: string | null
          occurred_at?: string
          outcome?: string | null
          severity?: number | null
          symptom?: string | null
          time_of_day?: string | null
          updated_at?: string
        }
        Update: {
          antecedent?: string | null
          caregiver_distress?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          household_id?: string
          id?: string
          intervention_tried?: string | null
          occurred_at?: string
          outcome?: string | null
          severity?: number | null
          symptom?: string | null
          time_of_day?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      fingerprint_insights: {
        Row: {
          created_at: string
          deleted_at: string | null
          household_id: string
          id: string
          insight: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          household_id: string
          id?: string
          insight?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          insight?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fingerprint_insights_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string | null
          permissions: Json
          role: Database["public"]["Enums"]["membership_role"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          household_id: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          role: Database["public"]["Enums"]["membership_role"]
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          role?: Database["public"]["Enums"]["membership_role"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          deleted_at: string | null
          edit_lock_days: number
          id: string
          intake_capture_mode: string
          intake_progress: Json
          is_demo: boolean
          min_evidence: number
          name: string
          notify_window_end: string
          notify_window_start: string
          pin_hash: string | null
          preferred_language: Database["public"]["Enums"]["app_language"]
          reminder_enabled: boolean
          reminder_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          edit_lock_days?: number
          id?: string
          intake_capture_mode?: string
          intake_progress?: Json
          is_demo?: boolean
          min_evidence?: number
          name: string
          notify_window_end?: string
          notify_window_start?: string
          pin_hash?: string | null
          preferred_language?: Database["public"]["Enums"]["app_language"]
          reminder_enabled?: boolean
          reminder_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          edit_lock_days?: number
          id?: string
          intake_capture_mode?: string
          intake_progress?: Json
          is_demo?: boolean
          min_evidence?: number
          name?: string
          notify_window_end?: string
          notify_window_start?: string
          pin_hash?: string | null
          preferred_language?: Database["public"]["Enums"]["app_language"]
          reminder_enabled?: boolean
          reminder_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      log_symptoms: {
        Row: {
          antecedent: string | null
          caregiver_distress: number | null
          created_at: string
          daily_log_id: string
          id: string
          intervention_tried: string | null
          outcome: string | null
          severity: number | null
          symptom: string
          time_of_day: string | null
          updated_at: string
        }
        Insert: {
          antecedent?: string | null
          caregiver_distress?: number | null
          created_at?: string
          daily_log_id: string
          id?: string
          intervention_tried?: string | null
          outcome?: string | null
          severity?: number | null
          symptom: string
          time_of_day?: string | null
          updated_at?: string
        }
        Update: {
          antecedent?: string | null
          caregiver_distress?: number | null
          created_at?: string
          daily_log_id?: string
          id?: string
          intervention_tried?: string | null
          outcome?: string | null
          severity?: number | null
          symptom?: string
          time_of_day?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_symptoms_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          audio_path: string | null
          caption: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          kind: string
          storage_path: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          audio_path?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          kind?: string
          storage_path: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          audio_path?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          kind?: string
          storage_path?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          deleted_at: string | null
          household_id: string
          id: string
          permissions: Json
          role: Database["public"]["Enums"]["membership_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          household_id: string
          id?: string
          permissions?: Json
          role: Database["public"]["Enums"]["membership_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["membership_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      music_sessions: {
        Row: {
          created_at: string
          deleted_at: string | null
          ended_at: string | null
          episode_id: string | null
          helped: string | null
          household_id: string
          id: string
          provider: string | null
          song_label: string | null
          started_at: string
          started_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          episode_id?: string | null
          helped?: string | null
          household_id: string
          id?: string
          provider?: string | null
          song_label?: string | null
          started_at?: string
          started_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          episode_id?: string | null
          helped?: string | null
          household_id?: string
          id?: string
          provider?: string | null
          song_label?: string | null
          started_at?: string
          started_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_sessions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_sessions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_sessions_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_profile: {
        Row: {
          address_as: string | null
          biography: string | null
          calming_strategies: string[]
          conditions: string[]
          created_at: string
          culture_faith: string | null
          daily_routines: string | null
          deleted_at: string | null
          diagnosis_date: string | null
          diagnosis_type: string | null
          dislikes: string[]
          display_name: string
          greeting_audio_path: string | null
          hometown: string | null
          household_id: string
          id: string
          key_people: Json
          known_triggers: string[]
          language: Database["public"]["Enums"]["app_language"]
          languages: string[]
          life_events: string[]
          likes: string[]
          medication_names: string[]
          music_disliked: string[]
          music_preferences: string[]
          music_provider: string | null
          preferred_name: string | null
          profession: string | null
          referral_consent: boolean
          stage_self_select: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_as?: string | null
          biography?: string | null
          calming_strategies?: string[]
          conditions?: string[]
          created_at?: string
          culture_faith?: string | null
          daily_routines?: string | null
          deleted_at?: string | null
          diagnosis_date?: string | null
          diagnosis_type?: string | null
          dislikes?: string[]
          display_name: string
          greeting_audio_path?: string | null
          hometown?: string | null
          household_id: string
          id?: string
          key_people?: Json
          known_triggers?: string[]
          language?: Database["public"]["Enums"]["app_language"]
          languages?: string[]
          life_events?: string[]
          likes?: string[]
          medication_names?: string[]
          music_disliked?: string[]
          music_preferences?: string[]
          music_provider?: string | null
          preferred_name?: string | null
          profession?: string | null
          referral_consent?: boolean
          stage_self_select?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_as?: string | null
          biography?: string | null
          calming_strategies?: string[]
          conditions?: string[]
          created_at?: string
          culture_faith?: string | null
          daily_routines?: string | null
          deleted_at?: string | null
          diagnosis_date?: string | null
          diagnosis_type?: string | null
          dislikes?: string[]
          display_name?: string
          greeting_audio_path?: string | null
          hometown?: string | null
          household_id?: string
          id?: string
          key_people?: Json
          known_triggers?: string[]
          language?: Database["public"]["Enums"]["app_language"]
          languages?: string[]
          life_events?: string[]
          likes?: string[]
          medication_names?: string[]
          music_disliked?: string[]
          music_preferences?: string[]
          music_provider?: string | null
          preferred_name?: string | null
          profession?: string | null
          referral_consent?: boolean
          stage_self_select?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_profile_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      physician_summaries: {
        Row: {
          created_at: string
          deleted_at: string | null
          generated_by: string | null
          household_id: string
          id: string
          period_end: string | null
          period_start: string | null
          stats: Json | null
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          generated_by?: string | null
          household_id: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          stats?: Json | null
          summary: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          generated_by?: string | null
          household_id?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          stats?: Json | null
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "physician_summaries_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physician_summaries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      training_content: {
        Row: {
          action_card_text: string | null
          body: string | null
          created_at: string
          deleted_at: string | null
          id: string
          language: Database["public"]["Enums"]["app_language"]
          self_hosted: boolean
          source_attribution: string | null
          symptom_tag: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          action_card_text?: string | null
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          language?: Database["public"]["Enums"]["app_language"]
          self_hosted?: boolean
          source_attribution?: string | null
          symptom_tag?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          action_card_text?: string | null
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          language?: Database["public"]["Enums"]["app_language"]
          self_hosted?: boolean
          source_attribution?: string | null
          symptom_tag?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      training_feedback: {
        Row: {
          action_saved: boolean
          created_at: string
          deleted_at: string | null
          helped: string | null
          household_id: string
          id: string
          training_id: string
          tried_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action_saved?: boolean
          created_at?: string
          deleted_at?: string | null
          helped?: string | null
          household_id: string
          id?: string
          training_id: string
          tried_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action_saved?: boolean
          created_at?: string
          deleted_at?: string | null
          helped?: string | null
          household_id?: string
          id?: string
          training_id?: string
          tried_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_feedback_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_feedback_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "training_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          intended_role: string | null
          preferred_language: Database["public"]["Enums"]["app_language"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          intended_role?: string | null
          preferred_language?: Database["public"]["Enums"]["app_language"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          intended_role?: string | null
          preferred_language?: Database["public"]["Enums"]["app_language"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_clinician_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      is_household_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      is_record_locked: {
        Args: { _created_at: string; _household_id: string }
        Returns: boolean
      }
      member_section_access: {
        Args: { _household_id: string; _section: string; _user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_language: "en" | "es"
      app_role:
        | "admin"
        | "primary_caregiver"
        | "family"
        | "friend"
        | "clinician"
      membership_role: "primary_caregiver" | "family" | "friend" | "clinician"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_language: ["en", "es"],
      app_role: ["admin", "primary_caregiver", "family", "friend", "clinician"],
      membership_role: ["primary_caregiver", "family", "friend", "clinician"],
    },
  },
} as const
