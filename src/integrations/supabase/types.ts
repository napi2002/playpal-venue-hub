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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      availability_rules: {
        Row: {
          court_id: string | null
          created_at: string
          day_of_week: number | null
          end_time: string
          id: string
          is_available: boolean | null
          rule_type: string | null
          specific_date: string | null
          start_time: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          court_id?: string | null
          created_at?: string
          day_of_week?: number | null
          end_time: string
          id?: string
          is_available?: boolean | null
          rule_type?: string | null
          specific_date?: string | null
          start_time: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          court_id?: string | null
          created_at?: string
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_available?: boolean | null
          rule_type?: string | null
          specific_date?: string | null
          start_time?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount: string
          booking_number: string
          court_id: string
          created_at: string
          date: string
          duration: number
          id: string
          notes: string | null
          payment_status: string
          player_email: string
          player_name: string
          source: string
          sport: string
          status: Database["public"]["Enums"]["booking_status"]
          time: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          amount: string
          booking_number: string
          court_id: string
          created_at?: string
          date: string
          duration?: number
          id?: string
          notes?: string | null
          payment_status?: string
          player_email: string
          player_name: string
          source: string
          sport: string
          status?: Database["public"]["Enums"]["booking_status"]
          time: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          amount?: string
          booking_number?: string
          court_id?: string
          created_at?: string
          date?: string
          duration?: number
          id?: string
          notes?: string | null
          payment_status?: string
          player_email?: string
          player_name?: string
          source?: string
          sport?: string
          status?: Database["public"]["Enums"]["booking_status"]
          time?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          buffer_minutes: number
          created_at: string
          id: string
          name: string
          off_peak_price: number
          peak_price: number
          sport: string
          status: string
          venue_id: string | null
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          id?: string
          name: string
          off_peak_price: number
          peak_price: number
          sport: string
          status?: string
          venue_id?: string | null
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          id?: string
          name?: string
          off_peak_price?: number
          peak_price?: number
          sport?: string
          status?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string
          credentials_encrypted: string | null
          id: string
          integration_type: string
          is_enabled: boolean | null
          last_sync_at: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          integration_type: string
          is_enabled?: boolean | null
          last_sync_at?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          integration_type?: string
          is_enabled?: boolean | null
          last_sync_at?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_method: string | null
          payment_provider: string | null
          refund_amount: number | null
          refunded_at: string | null
          status: string | null
          transaction_id: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bookings: {
        Row: {
          amount: string
          court_id: string
          created_at: string
          day_of_week: number
          duration: number
          end_date: string | null
          id: string
          player_email: string
          player_name: string
          sport: string
          start_date: string
          status: Database["public"]["Enums"]["booking_status"]
          time: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          amount: string
          court_id: string
          created_at?: string
          day_of_week: number
          duration?: number
          end_date?: string | null
          id?: string
          player_email: string
          player_name: string
          sport: string
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"]
          time: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          amount?: string
          court_id?: string
          created_at?: string
          day_of_week?: number
          duration?: number
          end_date?: string | null
          id?: string
          player_email?: string
          player_name?: string
          sport?: string
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"]
          time?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          date_format: string | null
          id: string
          language: string | null
          notification_email: boolean | null
          notification_push: boolean | null
          notification_sms: boolean | null
          time_format: string | null
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          date_format?: string | null
          id?: string
          language?: string | null
          notification_email?: boolean | null
          notification_push?: boolean | null
          notification_sms?: boolean | null
          time_format?: string | null
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          date_format?: string | null
          id?: string
          language?: string | null
          notification_email?: boolean | null
          notification_push?: boolean | null
          notification_sms?: boolean | null
          time_format?: string | null
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_settings: {
        Row: {
          auto_confirm_bookings: boolean | null
          booking_buffer_minutes: number | null
          cancellation_policy: string | null
          created_at: string
          id: string
          logo_url: string | null
          max_booking_advance_days: number | null
          min_booking_notice_hours: number | null
          require_payment_upfront: boolean | null
          terms_and_conditions: string | null
          theme_color: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          auto_confirm_bookings?: boolean | null
          booking_buffer_minutes?: number | null
          cancellation_policy?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          max_booking_advance_days?: number | null
          min_booking_notice_hours?: number | null
          require_payment_upfront?: boolean | null
          terms_and_conditions?: string | null
          theme_color?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          auto_confirm_bookings?: boolean | null
          booking_buffer_minutes?: number | null
          cancellation_policy?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          max_booking_advance_days?: number | null
          min_booking_notice_hours?: number | null
          require_payment_upfront?: boolean | null
          terms_and_conditions?: string | null
          theme_color?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_settings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          slug: string
          status: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          slug: string
          status?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          slug?: string
          status?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_booking_number: { Args: never; Returns: string }
      generate_bookings_from_recurring: {
        Args: { _recurring_booking_id: string; _weeks_ahead?: number }
        Returns: number
      }
      get_user_venue_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
          _venue_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "staff"
      booking_status: "pending" | "confirmed" | "paid" | "cancelled" | "held"
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
      app_role: ["owner", "admin", "manager", "staff"],
      booking_status: ["pending", "confirmed", "paid", "cancelled", "held"],
    },
  },
} as const
