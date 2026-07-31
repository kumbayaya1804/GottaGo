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
      app_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      availability_flags: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          location_id: string
          reporter_id: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          location_id: string
          reporter_id?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          location_id?: string
          reporter_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_flags_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      confidence_scores: {
        Row: {
          computed_at: string | null
          id: string
          location_id: string
          score: string
        }
        Insert: {
          computed_at?: string | null
          id?: string
          location_id: string
          score?: string
        }
        Update: {
          computed_at?: string | null
          id?: string
          location_id?: string
          score?: string
        }
        Relationships: [
          {
            foreignKeyName: "confidence_scores_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      failure_events: {
        Row: {
          id: string
          location_id: string
          timestamp: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          id?: string
          location_id: string
          timestamp?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          id?: string
          location_id?: string
          timestamp?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failure_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failure_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          access_code_confirmed_at: string | null
          access_instructions: string | null
          access_sensitivity: string | null
          address: string | null
          chill_spot: boolean | null
          confidence_score: string | null
          confidence_tier: string | null
          coordinates: unknown
          created_at: string | null
          data_source: string
          decay_tier: string | null
          deleted_at: string | null
          failure_event_count: number | null
          hours: Json | null
          id: string
          is_open_now: boolean | null
          last_verified_at: string | null
          name: string
          pending_access_code: string | null
          pending_code_proposed_by: string | null
          policy_tag: string | null
          respect_signal_score: number | null
          shadowban_status: boolean
          suppressed_at: string | null
          timezone: string
          updated_at: string | null
          verification_count: number | null
        }
        Insert: {
          access_code_confirmed_at?: string | null
          access_instructions?: string | null
          access_sensitivity?: string | null
          address?: string | null
          chill_spot?: boolean | null
          confidence_score?: string | null
          confidence_tier?: string | null
          coordinates: unknown
          created_at?: string | null
          data_source?: string
          decay_tier?: string | null
          deleted_at?: string | null
          failure_event_count?: number | null
          hours?: Json | null
          id?: string
          is_open_now?: boolean | null
          last_verified_at?: string | null
          name: string
          pending_access_code?: string | null
          pending_code_proposed_by?: string | null
          policy_tag?: string | null
          respect_signal_score?: number | null
          shadowban_status?: boolean
          suppressed_at?: string | null
          timezone?: string
          updated_at?: string | null
          verification_count?: number | null
        }
        Update: {
          access_code_confirmed_at?: string | null
          access_instructions?: string | null
          access_sensitivity?: string | null
          address?: string | null
          chill_spot?: boolean | null
          confidence_score?: string | null
          confidence_tier?: string | null
          coordinates?: unknown
          created_at?: string | null
          data_source?: string
          decay_tier?: string | null
          deleted_at?: string | null
          failure_event_count?: number | null
          hours?: Json | null
          id?: string
          is_open_now?: boolean | null
          last_verified_at?: string | null
          name?: string
          pending_access_code?: string | null
          pending_code_proposed_by?: string | null
          policy_tag?: string | null
          respect_signal_score?: number | null
          shadowban_status?: boolean
          suppressed_at?: string | null
          timezone?: string
          updated_at?: string | null
          verification_count?: number | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          accessibility: number | null
          cleanliness: number | null
          convenience: number | null
          created_at: string | null
          id: string
          location_id: string
          review_text: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          accessibility?: number | null
          cleanliness?: number | null
          convenience?: number | null
          created_at?: string | null
          id?: string
          location_id: string
          review_text?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          accessibility?: number | null
          cleanliness?: number | null
          convenience?: number | null
          created_at?: string | null
          id?: string
          location_id?: string
          review_text?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          details: string | null
          geographic_distance_meters: number | null
          id: string
          location_id: string
          report_type: string
          trust_weight: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          geographic_distance_meters?: number | null
          id?: string
          location_id: string
          report_type: string
          trust_weight?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          geographic_distance_meters?: number | null
          id?: string
          location_id?: string
          report_type?: string
          trust_weight?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      respect_signal_log: {
        Row: {
          event_type: string
          id: string
          location_id: string
          timestamp: string | null
          weight: number
        }
        Insert: {
          event_type: string
          id?: string
          location_id: string
          timestamp?: string | null
          weight: number
        }
        Update: {
          event_type?: string
          id?: string
          location_id?: string
          timestamp?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "respect_signal_log_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_tags: {
        Row: {
          created_at: string | null
          id: string
          key: string
          submission_id: string
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          submission_id: string
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          submission_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_tags_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          access_code_confirmed_at: string | null
          access_instructions: string | null
          access_sensitivity: string | null
          address: string | null
          confirmation_count: number | null
          coordinates: unknown
          created_at: string | null
          expires_at: string
          hours: Json | null
          id: string
          location_id: string | null
          name: string | null
          policy_tag: string | null
          status: string
          submitter_id: string | null
          timing_tip: string | null
          updated_at: string | null
        }
        Insert: {
          access_code_confirmed_at?: string | null
          access_instructions?: string | null
          access_sensitivity?: string | null
          address?: string | null
          confirmation_count?: number | null
          coordinates?: unknown
          created_at?: string | null
          expires_at?: string
          hours?: Json | null
          id?: string
          location_id?: string | null
          name?: string | null
          policy_tag?: string | null
          status?: string
          submitter_id?: string | null
          timing_tip?: string | null
          updated_at?: string | null
        }
        Update: {
          access_code_confirmed_at?: string | null
          access_instructions?: string | null
          access_sensitivity?: string | null
          address?: string | null
          confirmation_count?: number | null
          coordinates?: unknown
          created_at?: string | null
          expires_at?: string
          hours?: Json | null
          id?: string
          location_id?: string | null
          name?: string | null
          policy_tag?: string | null
          status?: string
          submitter_id?: string | null
          timing_tip?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string | null
          id: string
          key: string
          location_id: string
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          location_id: string
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          location_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_events: {
        Row: {
          action_type: string
          context_ref: string | null
          delta: number
          id: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          context_ref?: string | null
          delta: number
          id?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          context_ref?: string | null
          delta?: number
          id?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trust_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          admin_override: boolean | null
          created_at: string | null
          display_name: string | null
          email: string | null
          family_mode: boolean | null
          gamification_points: number | null
          gps_consent: boolean | null
          gps_consent_at: string | null
          gps_verified_contribution_count: number | null
          id: string
          leaderboard_position: number | null
          shadowban_status: boolean
          trust_multiplier: number | null
          trust_score: number | null
          updated_at: string | null
        }
        Insert: {
          admin_override?: boolean | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          family_mode?: boolean | null
          gamification_points?: number | null
          gps_consent?: boolean | null
          gps_consent_at?: string | null
          gps_verified_contribution_count?: number | null
          id: string
          leaderboard_position?: number | null
          shadowban_status?: boolean
          trust_multiplier?: number | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Update: {
          admin_override?: boolean | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          family_mode?: boolean | null
          gamification_points?: number | null
          gps_consent?: boolean | null
          gps_consent_at?: string | null
          gps_verified_contribution_count?: number | null
          id?: string
          leaderboard_position?: number | null
          shadowban_status?: boolean
          trust_multiplier?: number | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      verification_events: {
        Row: {
          captured_at: string | null
          distance_from_location_meters: number
          event_type: string
          gps_accuracy_m: number | null
          gps_location: unknown
          id: string
          location_id: string | null
          raw_gps_purge_after: string | null
          submission_id: string | null
          timestamp: string | null
          user_id: string | null
          weight: number
        }
        Insert: {
          captured_at?: string | null
          distance_from_location_meters: number
          event_type: string
          gps_accuracy_m?: number | null
          gps_location?: unknown
          id?: string
          location_id?: string | null
          raw_gps_purge_after?: string | null
          submission_id?: string | null
          timestamp?: string | null
          user_id?: string | null
          weight: number
        }
        Update: {
          captured_at?: string | null
          distance_from_location_meters?: number
          event_type?: string
          gps_accuracy_m?: number | null
          gps_location?: unknown
          id?: string
          location_id?: string | null
          raw_gps_purge_after?: string | null
          submission_id?: string | null
          timestamp?: string | null
          user_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "verification_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      availability_flags_public: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string | null
          location_id: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          location_id?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          location_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_flags_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings_public: {
        Row: {
          accessibility: number | null
          cleanliness: number | null
          convenience: number | null
          created_at: string | null
          id: string | null
          location_id: string | null
          review_text: string | null
          updated_at: string | null
        }
        Insert: {
          accessibility?: number | null
          cleanliness?: number | null
          convenience?: number | null
          created_at?: string | null
          id?: string | null
          location_id?: string | null
          review_text?: string | null
          updated_at?: string | null
        }
        Update: {
          accessibility?: number | null
          cleanliness?: number | null
          convenience?: number | null
          created_at?: string | null
          id?: string | null
          location_id?: string | null
          review_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      respect_signal_90d: {
        Row: {
          event_count: number | null
          location_id: string | null
          total_weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "respect_signal_log_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_display_name_available: { Args: { name: string }; Returns: boolean }
      confirm_access_code: {
        Args: { p_location_id: string }
        Returns: undefined
      }
      delete_account: { Args: never; Returns: undefined }
      get_access_code: { Args: { p_location_id: string }; Returns: string }
      get_location_detail: {
        Args: { location_id: string; user_lat?: number; user_lng?: number }
        Returns: {
          address: string
          chill_spot: boolean
          confidence_tier: string
          distance_m: number
          hours: Json
          id: string
          is_open_now: boolean
          last_verified_at: string
          lat: number
          lng: number
          name: string
          policy_tag: string
          verification_count: number
        }[]
      }
      get_my_pending_submissions: {
        Args: never
        Returns: {
          confirmation_count: number
          expires_at: string
          id: string
          lat: number
          lng: number
          name: string
          policy_tag: string
        }[]
      }
      get_profile_stats: { Args: never; Returns: Json }
      search_locations_bbox: {
        Args: {
          filter_changing?: boolean
          filter_chill_spot?: boolean
          filter_high_conf?: boolean
          filter_open_now?: boolean
          filter_wheelchair?: boolean
          max_lat: number
          max_lng: number
          max_pins?: number
          min_lat: number
          min_lng: number
        }
        Returns: {
          chill_spot: boolean
          confidence_tier: string
          id: string
          is_open_now: boolean
          last_verified_at: string
          lat: number
          lng: number
          name: string
          policy_tag: string
          verification_count: number
        }[]
      }
      search_locations_nearby: {
        Args: {
          filter_changing?: boolean
          filter_chill_spot?: boolean
          filter_high_conf?: boolean
          filter_open_now?: boolean
          filter_wheelchair?: boolean
          result_limit?: number
          user_lat: number
          user_lng: number
        }
        Returns: {
          chill_spot: boolean
          confidence_tier: string
          distance_m: number
          id: string
          is_open_now: boolean
          last_verified_at: string
          lat: number
          lng: number
          name: string
          policy_tag: string
          verification_count: number
        }[]
      }
      search_pending_submissions_nearby: {
        Args: { result_limit?: number; user_lat: number; user_lng: number }
        Returns: {
          distance_m: number
          id: string
          lat: number
          lng: number
          name: string
          policy_tag: string
        }[]
      }
      set_gps_consent: { Args: never; Returns: undefined }
      submit_location: {
        Args: {
          p_access_code?: string
          p_access_sensitivity?: string
          p_accuracy_m: number
          p_address?: string
          p_captured_at: string
          p_hours?: Json
          p_lat: number
          p_lng: number
          p_mocked: boolean
          p_name: string
          p_policy_tag: string
          p_timing_tip?: string
        }
        Returns: string
      }
      update_access_code: {
        Args: { p_code: string; p_location_id: string }
        Returns: undefined
      }
      update_profile: {
        Args: { new_display_name?: string; new_family_mode?: boolean }
        Returns: undefined
      }
      withdraw_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
