export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      availability: {
        Row: {
          id: number;
          venue_id: number | null;
          court_id: number | null;
          slot_date: string;
          start_time: string;
          end_time: string;
          status: string | null;
          price: number;
          currency: string;
          is_peak: boolean | null;
          source: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          venue_id?: number | null;
          court_id?: number | null;
          slot_date: string;
          start_time: string;
          end_time: string;
          status?: string | null;
          price: number;
          currency: string;
          is_peak?: boolean | null;
          source?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          venue_id?: number | null;
          court_id?: number | null;
          slot_date?: string;
          start_time?: string;
          end_time?: string;
          status?: string | null;
          price?: number;
          currency?: string;
          is_peak?: boolean | null;
          source?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: number;
          user_id: number | null;
          court_id: number | null;
          venue_id: number | null;
          slot_start: string;
          slot_end: string;
          duration_minutes: number | null;
          status: Database["public"]["Enums"]["booking_status"] | null;
          cancellation_reason: string | null;
          cancellation_timestamp: string | null;
          total_price: number;
          currency: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
          booking_number: string | null;
          player_name: string | null;
          player_email: string | null;
          source: string | null;
          payment_status: string | null;
          player_id: number | null;
          membership_type_id: number | null;
          membership_type: string | null;
          pricing_override_reason: string | null;
          final_price: number | null;
          start_at: string | null;
          end_at: string | null;
          date: string | null;
          time: string | null;
        };
        Insert: {
          id?: number;
          user_id?: number | null;
          court_id?: number | null;
          venue_id?: number | null;
          slot_start: string;
          slot_end: string;
          duration_minutes?: number | null;
          status?: Database["public"]["Enums"]["booking_status"] | null;
          cancellation_reason?: string | null;
          cancellation_timestamp?: string | null;
          total_price: number;
          currency?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          booking_number?: string | null;
          player_name?: string | null;
          player_email?: string | null;
          source?: string | null;
          payment_status?: string | null;
          player_id?: number | null;
          membership_type_id?: number | null;
          membership_type?: string | null;
          pricing_override_reason?: string | null;
          final_price?: number | null;
          start_at?: string | null;
          end_at?: string | null;
          date?: string | null;
          time?: string | null;
        };
        Update: {
          id?: number;
          user_id?: number | null;
          court_id?: number | null;
          venue_id?: number | null;
          slot_start?: string;
          slot_end?: string;
          duration_minutes?: number | null;
          status?: Database["public"]["Enums"]["booking_status"] | null;
          cancellation_reason?: string | null;
          cancellation_timestamp?: string | null;
          total_price?: number;
          currency?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          booking_number?: string | null;
          player_name?: string | null;
          player_email?: string | null;
          source?: string | null;
          payment_status?: string | null;
          player_id?: number | null;
          membership_type_id?: number | null;
          membership_type?: string | null;
          pricing_override_reason?: string | null;
          final_price?: number | null;
          start_at?: string | null;
          end_at?: string | null;
          date?: string | null;
          time?: string | null;
        };
        Relationships: [];
      };
      courts: {
        Row: {
          id: number;
          venue_id: number | null;
          name: string;
          sport_type: string | null;
          capacity: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          amenities: Json | null;
          status: string;
          environment: string | null;
          surface_type: string | null;
          has_lighting: boolean;
          weekday_price_per_hour_thb: number | null;
          weekend_price_per_hour_thb: number | null;
          peak_price: number | null;
          off_peak_price: number | null;
          buffer_minutes: number;
          sport: string | null;
        };
        Insert: {
          id?: number;
          venue_id?: number | null;
          name: string;
          sport_type?: string | null;
          capacity?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          amenities?: Json | null;
          status?: string;
          environment?: string | null;
          surface_type?: string | null;
          has_lighting?: boolean;
          weekday_price_per_hour_thb?: number | null;
          weekend_price_per_hour_thb?: number | null;
          peak_price?: number | null;
          off_peak_price?: number | null;
          buffer_minutes?: number;
          sport?: string | null;
        };
        Update: {
          id?: number;
          venue_id?: number | null;
          name?: string;
          sport_type?: string | null;
          capacity?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          amenities?: Json | null;
          status?: string;
          environment?: string | null;
          surface_type?: string | null;
          has_lighting?: boolean;
          weekday_price_per_hour_thb?: number | null;
          weekend_price_per_hour_thb?: number | null;
          peak_price?: number | null;
          off_peak_price?: number | null;
          buffer_minutes?: number;
          sport?: string | null;
        };
        Relationships: [];
      };
      membership_types: {
        Row: {
          id: number;
          venue_id: number | null;
          name: string;
          description_public: string | null;
          description_internal: string | null;
          status: Database["public"]["Enums"]["membership_type_status"];
          fixed_hourly_rate: number | null;
          percent_discount: number | null;
          early_booking_hours: number | null;
          auto_confirm: boolean;
          allow_peak_hours: boolean;
          extended_cancellation_hours: number | null;
          no_show_forgiveness: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          venue_id?: number | null;
          name: string;
          description_public?: string | null;
          description_internal?: string | null;
          status?: Database["public"]["Enums"]["membership_type_status"];
          fixed_hourly_rate?: number | null;
          percent_discount?: number | null;
          early_booking_hours?: number | null;
          auto_confirm?: boolean;
          allow_peak_hours?: boolean;
          extended_cancellation_hours?: number | null;
          no_show_forgiveness?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          venue_id?: number | null;
          name?: string;
          description_public?: string | null;
          description_internal?: string | null;
          status?: Database["public"]["Enums"]["membership_type_status"];
          fixed_hourly_rate?: number | null;
          percent_discount?: number | null;
          early_booking_hours?: number | null;
          auto_confirm?: boolean;
          allow_peak_hours?: boolean;
          extended_cancellation_hours?: number | null;
          no_show_forgiveness?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_memberships: {
        Row: {
          id: number;
          player_id: number | null;
          membership_type_id: number | null;
          status: Database["public"]["Enums"]["membership_status"];
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          player_id?: number | null;
          membership_type_id?: number | null;
          status?: Database["public"]["Enums"]["membership_status"];
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          player_id?: number | null;
          membership_type_id?: number | null;
          status?: Database["public"]["Enums"]["membership_status"];
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_notes: {
        Row: {
          id: number;
          player_id: number | null;
          note: string;
          created_by: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          player_id?: number | null;
          note: string;
          created_by?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          player_id?: number | null;
          note?: string;
          created_by?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: number;
          venue_id: number | null;
          name: string;
          phone: string | null;
          email: string | null;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          venue_id?: number | null;
          name: string;
          phone?: string | null;
          email?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          venue_id?: number | null;
          name?: string;
          phone?: string | null;
          email?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: number;
          user_id: number | null;
          booking_id: number | null;
          venue_id: number | null;
          amount: number;
          currency: string;
          payment_method: string | null;
          status: Database["public"]["Enums"]["payment_status"] | null;
          transaction_id: string | null;
          transaction_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id?: number | null;
          booking_id?: number | null;
          venue_id?: number | null;
          amount: number;
          currency?: string;
          payment_method?: string | null;
          status?: Database["public"]["Enums"]["payment_status"] | null;
          transaction_id?: string | null;
          transaction_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: number | null;
          booking_id?: number | null;
          venue_id?: number | null;
          amount?: number;
          currency?: string;
          payment_method?: string | null;
          status?: Database["public"]["Enums"]["payment_status"] | null;
          transaction_id?: string | null;
          transaction_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          id: number;
          venue_id: number | null;
          court_id: number | null;
          type: string;
          url: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          venue_id?: number | null;
          court_id?: number | null;
          type: string;
          url: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          venue_id?: number | null;
          court_id?: number | null;
          type?: string;
          url?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      recurring_bookings: {
        Row: {
          id: number;
          venue_id: number | null;
          court_id: number | null;
          day_of_week: number;
          time: string;
          duration: number;
          player_name: string;
          player_email: string | null;
          status: string;
          start_date: string;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          venue_id?: number | null;
          court_id?: number | null;
          day_of_week: number;
          time: string;
          duration?: number;
          player_name: string;
          player_email?: string | null;
          status?: string;
          start_date: string;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          venue_id?: number | null;
          court_id?: number | null;
          day_of_week?: number;
          time?: string;
          duration?: number;
          player_name?: string;
          player_email?: string | null;
          status?: string;
          start_date?: string;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: number;
          email: string;
          role: Database["public"]["Enums"]["user_role"];
          full_name: string | null;
          phone_number: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          is_active: boolean;
          date_of_birth: string | null;
          location: string | null;
          interests: Json | null;
          profile_completed: boolean;
          username: string | null;
          auth_id: string | null;
        };
        Insert: {
          id?: number;
          email: string;
          role?: Database["public"]["Enums"]["user_role"];
          full_name?: string | null;
          phone_number?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          date_of_birth?: string | null;
          location?: string | null;
          interests?: Json | null;
          profile_completed?: boolean;
          username?: string | null;
          auth_id?: string | null;
        };
        Update: {
          id?: number;
          email?: string;
          role?: Database["public"]["Enums"]["user_role"];
          full_name?: string | null;
          phone_number?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          date_of_birth?: string | null;
          location?: string | null;
          interests?: Json | null;
          profile_completed?: boolean;
          username?: string | null;
          auth_id?: string | null;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: number;
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          country: string;
          postal_code: string | null;
          owner_id: number | null;
          email: string | null;
          phone: string | null;
          description: string | null;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
          is_active: boolean;
          name_en: string | null;
          name_th: string | null;
          venue_type: string | null;
          address_line1: string | null;
          subdistrict: string | null;
          district: string | null;
          province: string | null;
          postcode: string | null;
          google_maps_url: string | null;
          opening_hours: Json | null;
          default_slot_duration_mins: number | null;
          status: Database["public"]["Enums"]["venue_status"];
          timezone: string | null;
          tax_information: string | null;
          sports_supported: string[];
        };
        Insert: {
          id?: number;
          name: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string;
          postal_code?: string | null;
          owner_id?: number | null;
          email?: string | null;
          phone?: string | null;
          description?: string | null;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          name_en?: string | null;
          name_th?: string | null;
          venue_type?: string | null;
          address_line1?: string | null;
          subdistrict?: string | null;
          district?: string | null;
          province?: string | null;
          postcode?: string | null;
          google_maps_url?: string | null;
          opening_hours?: Json | null;
          default_slot_duration_mins?: number | null;
          status?: Database["public"]["Enums"]["venue_status"];
          timezone?: string | null;
          tax_information?: string | null;
          sports_supported?: string[];
        };
        Update: {
          id?: number;
          name?: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string;
          postal_code?: string | null;
          owner_id?: number | null;
          email?: string | null;
          phone?: string | null;
          description?: string | null;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          name_en?: string | null;
          name_th?: string | null;
          venue_type?: string | null;
          address_line1?: string | null;
          subdistrict?: string | null;
          district?: string | null;
          province?: string | null;
          postcode?: string | null;
          google_maps_url?: string | null;
          opening_hours?: Json | null;
          default_slot_duration_mins?: number | null;
          status?: Database["public"]["Enums"]["venue_status"];
          timezone?: string | null;
          tax_information?: string | null;
          sports_supported?: string[];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      booking_status: "pending" | "confirmed" | "paid" | "cancelled" | "held";
      payment_status: "pending" | "completed" | "failed" | "refunded";
      membership_status: "active" | "inactive" | "suspended";
      membership_type_status: "active" | "inactive";
      venue_status: "DRAFT" | "SUBMITTED";
      user_role: "user" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;
