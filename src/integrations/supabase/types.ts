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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          contact_number: string | null
          created_at: string
          full_address: string
          id: string
          is_default: boolean | null
          label: string
          landmark: string | null
          latitude: number | null
          longitude: number | null
          user_id: string
        }
        Insert: {
          contact_number?: string | null
          created_at?: string
          full_address: string
          id?: string
          is_default?: boolean | null
          label?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          user_id: string
        }
        Update: {
          contact_number?: string | null
          created_at?: string
          full_address?: string
          id?: string
          is_default?: boolean | null
          label?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          user_id?: string
        }
        Relationships: []
      }
      billing_cycles: {
        Row: {
          created_at: string
          customer_id: string
          end_date: string
          id: string
          is_paid: boolean
          paid_at: string | null
          start_date: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          end_date: string
          id?: string
          is_paid?: boolean
          paid_at?: string | null
          start_date: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          end_date?: string
          id?: string
          is_paid?: boolean
          paid_at?: string | null
          start_date?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_boy_id: string | null
          id: string
          order_id: string
          picked_up_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_boy_id?: string | null
          id?: string
          order_id: string
          picked_up_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_boy_id?: string | null
          id?: string
          order_id?: string
          picked_up_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      food_addons: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          menu_id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          menu_id: string
          name: string
          price?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          menu_id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_addons_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "food_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      food_menus: {
        Row: {
          base_price: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          meal_type: string
          name: string
          rice_description: string
          seller_id: string
          updated_at: string
          vegetable_details: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          meal_type?: string
          name: string
          rice_description?: string
          seller_id: string
          updated_at?: string
          vegetable_details?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          meal_type?: string
          name?: string
          rice_description?: string
          seller_id?: string
          updated_at?: string
          vegetable_details?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_order_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_order_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_order_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          seller_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          quantity: number
          seller_id?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          seller_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_log: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_cycle_id: string | null
          contact_number: string | null
          created_at: string
          customer_id: string
          delivery_type: string
          estimated_delivery_date: string | null
          estimated_preparation_time: number | null
          food_preferences: string | null
          id: string
          landmark: string | null
          latitude: number | null
          longitude: number | null
          payment_method: string
          payment_status: string
          recurring_schedule_id: string | null
          scheduled_date: string | null
          scheduled_slot: string | null
          scheduled_time: string | null
          seller_delivers: boolean | null
          shipping_address: string
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          billing_cycle_id?: string | null
          contact_number?: string | null
          created_at?: string
          customer_id: string
          delivery_type?: string
          estimated_delivery_date?: string | null
          estimated_preparation_time?: number | null
          food_preferences?: string | null
          id?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          payment_method?: string
          payment_status?: string
          recurring_schedule_id?: string | null
          scheduled_date?: string | null
          scheduled_slot?: string | null
          scheduled_time?: string | null
          seller_delivers?: boolean | null
          shipping_address: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          billing_cycle_id?: string | null
          contact_number?: string | null
          created_at?: string
          customer_id?: string
          delivery_type?: string
          estimated_delivery_date?: string | null
          estimated_preparation_time?: number | null
          food_preferences?: string | null
          id?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          payment_method?: string
          payment_status?: string
          recurring_schedule_id?: string | null
          scheduled_date?: string | null
          scheduled_slot?: string | null
          scheduled_time?: string | null
          seller_delivers?: boolean | null
          shipping_address?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_recurring_schedule_id_fkey"
            columns: ["recurring_schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          billing_cycle_id: string
          created_at: string
          customer_id: string
          id: string
          method: string
          paid_at: string | null
          status: string
        }
        Insert: {
          amount: number
          billing_cycle_id: string
          created_at?: string
          customer_id: string
          id?: string
          method?: string
          paid_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          billing_cycle_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          method?: string
          paid_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          meal_type: string | null
          name: string
          price: number
          requires_delivery_boy: boolean | null
          seller_id: string
          stock: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          meal_type?: string | null
          name: string
          price: number
          requires_delivery_boy?: boolean | null
          seller_id: string
          stock?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          meal_type?: string | null
          name?: string
          price?: number
          requires_delivery_boy?: boolean | null
          seller_id?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          business_address: string | null
          created_at: string
          email: string
          full_name: string | null
          gst_number: string | null
          id: string
          id_proof_url: string | null
          is_approved: boolean | null
          is_blocked: boolean | null
          phone: string | null
          store_name: string | null
          updated_at: string
          user_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          business_address?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          gst_number?: string | null
          id?: string
          id_proof_url?: string | null
          is_approved?: boolean | null
          is_blocked?: boolean | null
          phone?: string | null
          store_name?: string | null
          updated_at?: string
          user_id: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          business_address?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          gst_number?: string | null
          id?: string
          id_proof_url?: string | null
          is_approved?: boolean | null
          is_blocked?: boolean | null
          phone?: string | null
          store_name?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Relationships: []
      }
      recurring_schedules: {
        Row: {
          created_at: string
          custom_days: Json | null
          customer_id: string
          end_date: string | null
          id: string
          is_active: boolean
          last_generated_date: string | null
          order_data: Json
          pattern: string
          scheduled_time: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_days?: Json | null
          customer_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          order_data: Json
          pattern?: string
          scheduled_time?: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_days?: Json | null
          customer_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          order_data?: Json
          pattern?: string
          scheduled_time?: string
          start_date?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_customer_order_ids: { Args: { _user_id: string }; Returns: string[] }
      get_delivery_boy_order_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_or_create_billing_cycle: {
        Args: { _customer_id: string }
        Returns: string
      }
      get_seller_order_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "customer" | "seller" | "delivery_boy" | "admin"
      delivery_status:
        | "assigned"
        | "accepted"
        | "rejected"
        | "picked_up"
        | "on_the_way"
        | "delivered"
      order_status:
        | "scheduled"
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "picked_up"
        | "on_the_way"
        | "delivered"
        | "cancelled"
        | "returned"
      vehicle_type: "bike" | "scooter" | "car" | "van" | "truck"
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
      app_role: ["customer", "seller", "delivery_boy", "admin"],
      delivery_status: [
        "assigned",
        "accepted",
        "rejected",
        "picked_up",
        "on_the_way",
        "delivered",
      ],
      order_status: [
        "scheduled",
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "picked_up",
        "on_the_way",
        "delivered",
        "cancelled",
        "returned",
      ],
      vehicle_type: ["bike", "scooter", "car", "van", "truck"],
    },
  },
} as const
