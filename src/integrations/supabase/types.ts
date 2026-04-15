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
      attendant_permissions: {
        Row: {
          apply_discounts: boolean
          cancel_orders: boolean
          edit_prices: boolean
          id: string
          manage_cash: boolean
          manage_categories: boolean
          manage_customers: boolean
          manage_products: boolean
          manage_stock: boolean
          remove_order_items: boolean
          tenant_id: string
          user_id: string
        }
        Insert: {
          apply_discounts?: boolean
          cancel_orders?: boolean
          edit_prices?: boolean
          id?: string
          manage_cash?: boolean
          manage_categories?: boolean
          manage_customers?: boolean
          manage_products?: boolean
          manage_stock?: boolean
          remove_order_items?: boolean
          tenant_id?: string
          user_id: string
        }
        Update: {
          apply_discounts?: boolean
          cancel_orders?: boolean
          edit_prices?: boolean
          id?: string
          manage_cash?: boolean
          manage_categories?: boolean
          manage_customers?: boolean
          manage_products?: boolean
          manage_stock?: boolean
          remove_order_items?: boolean
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          tenant_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          tenant_id?: string
          user_id: string
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          tenant_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          cash_register_id: string
          created_at: string
          description: string
          id: string
          tenant_id: string
          type: Database["public"]["Enums"]["cash_movement_type"]
        }
        Insert: {
          amount?: number
          cash_register_id: string
          created_at?: string
          description?: string
          id?: string
          tenant_id?: string
          type: Database["public"]["Enums"]["cash_movement_type"]
        }
        Update: {
          amount?: number
          cash_register_id?: string
          created_at?: string
          description?: string
          id?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["cash_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          id: string
          initial_amount: number
          notes: string | null
          opened_at: string
          opened_by: string
          tenant_id: string
          total_card: number
          total_cash: number
          total_fiado: number
          total_pix: number
          total_sales: number
        }
        Insert: {
          closed_at?: string | null
          id?: string
          initial_amount?: number
          notes?: string | null
          opened_at?: string
          opened_by: string
          tenant_id?: string
          total_card?: number
          total_cash?: number
          total_fiado?: number
          total_pix?: number
          total_sales?: number
        }
        Update: {
          closed_at?: string | null
          id?: string
          initial_amount?: number
          notes?: string | null
          opened_at?: string
          opened_by?: string
          tenant_id?: string
          total_card?: number
          total_cash?: number
          total_fiado?: number
          total_pix?: number
          total_sales?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_records: {
        Row: {
          cash_register_id: string
          commission_amount: number
          commission_percentage: number
          created_at: string
          id: string
          tenant_id: string
          total_sales: number
          user_id: string
          user_name: string
        }
        Insert: {
          cash_register_id: string
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          id?: string
          tenant_id?: string
          total_sales?: number
          user_id: string
          user_name?: string
        }
        Update: {
          cash_register_id?: string
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          id?: string
          tenant_id?: string
          total_sales?: number
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_records_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          min_order: number | null
          tenant_id: string
          type: Database["public"]["Enums"]["discount_type"]
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          min_order?: number | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["discount_type"]
          value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          min_order?: number | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["discount_type"]
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          created_at: string
          credit_balance: number
          id: string
          loyalty_points: number
          name: string
          notes: string
          phone: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string
          created_at?: string
          credit_balance?: number
          id?: string
          loyalty_points?: number
          name: string
          notes?: string
          phone?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          credit_balance?: number
          id?: string
          loyalty_points?: number
          name?: string
          notes?: string
          phone?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          completed_at: string | null
          coupon_id: string | null
          created_at: string
          customer_address: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          discount: number | null
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          held_at: string | null
          id: string
          items: Json
          loyalty_redemptions: number | null
          motoboy_name: string | null
          order_source: Database["public"]["Enums"]["order_source"] | null
          order_type: Database["public"]["Enums"]["order_type"]
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_splits: Json | null
          pickup_notes: string | null
          pickup_person: string | null
          pickup_time: string | null
          production_time: string | null
          service_fee: number | null
          status: Database["public"]["Enums"]["order_status"]
          table_number: number | null
          tenant_id: string
          total: number
        }
        Insert: {
          completed_at?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          discount?: number | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          held_at?: string | null
          id?: string
          items?: Json
          loyalty_redemptions?: number | null
          motoboy_name?: string | null
          order_source?: Database["public"]["Enums"]["order_source"] | null
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_splits?: Json | null
          pickup_notes?: string | null
          pickup_person?: string | null
          pickup_time?: string | null
          production_time?: string | null
          service_fee?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          table_number?: number | null
          tenant_id?: string
          total?: number
        }
        Update: {
          completed_at?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          discount?: number | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          held_at?: string | null
          id?: string
          items?: Json
          loyalty_redemptions?: number | null
          motoboy_name?: string | null
          order_source?: Database["public"]["Enums"]["order_source"] | null
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_splits?: Json | null
          pickup_notes?: string | null
          pickup_person?: string | null
          pickup_time?: string | null
          production_time?: string | null
          service_fee?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          table_number?: number | null
          tenant_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          image: string | null
          loyalty_eligible: boolean
          name: string
          price: number
          stock: number
          tenant_id: string
          type: Database["public"]["Enums"]["product_type"]
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          loyalty_eligible?: boolean
          name: string
          price?: number
          stock?: number
          tenant_id?: string
          type?: Database["public"]["Enums"]["product_type"]
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          loyalty_eligible?: boolean
          name?: string
          price?: number
          stock?: number
          tenant_id?: string
          type?: Database["public"]["Enums"]["product_type"]
          unit?: string
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
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          phone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          customer_id: string | null
          date: string
          id: string
          items: Json
          order_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_splits: Json | null
          tenant_id: string
          total: number
        }
        Insert: {
          customer_id?: string | null
          date?: string
          id?: string
          items?: Json
          order_id?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_splits?: Json | null
          tenant_id?: string
          total?: number
        }
        Update: {
          customer_id?: string | null
          date?: string
          id?: string
          items?: Json
          order_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_splits?: Json | null
          tenant_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_entries: {
        Row: {
          date: string
          id: string
          product_id: string
          quantity: number
          supplier_id: string | null
          tenant_id: string
        }
        Insert: {
          date?: string
          id?: string
          product_id: string
          quantity?: number
          supplier_id?: string | null
          tenant_id?: string
        }
        Update: {
          date?: string
          id?: string
          product_id?: string
          quantity?: number
          supplier_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          id: string
          service_fee_percentage: number
          table_count: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_fee_percentage?: number
          table_count?: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_fee_percentage?: number
          table_count?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_tables: {
        Row: {
          id: string
          number: number
          order_id: string | null
          status: Database["public"]["Enums"]["table_status"]
          tenant_id: string
        }
        Insert: {
          id?: string
          number: number
          order_id?: string | null
          status?: Database["public"]["Enums"]["table_status"]
          tenant_id?: string
        }
        Update: {
          id?: string
          number?: number
          order_id?: string | null
          status?: Database["public"]["Enums"]["table_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_tables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact: string
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          contact?: string
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
        }
        Update: {
          contact?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          commission_percentage: number
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          commission_percentage?: number
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          commission_percentage?: number
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          login_carousel_images: Json | null
          login_icon: string | null
          logo: string | null
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          login_carousel_images?: Json | null
          login_icon?: string | null
          logo?: string | null
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          login_carousel_images?: Json | null
          login_icon?: string | null
          logo?: string | null
          name?: string
          slug?: string
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_user_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_tenant_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id?: string
          p_entity_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "atendente" | "motoboy" | "superadmin"
      cash_movement_type: "entrada" | "saida"
      delivery_status: "pendente" | "pronto" | "finalizado"
      discount_type: "percentage" | "fixed"
      order_source:
        | "ifood"
        | "aiqfome"
        | "whatsapp"
        | "instagram"
        | "telefone"
        | "loja"
        | "outro"
      order_status:
        | "aberto"
        | "segurado"
        | "finalizado"
        | "cancelado"
        | "pronto"
      order_type: "balcao" | "mesa" | "delivery" | "retirada"
      payment_method: "pix" | "cartao" | "fiado" | "dinheiro"
      product_type: "unit" | "weight"
      table_status: "available" | "occupied"
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
      app_role: ["admin", "atendente", "motoboy", "superadmin"],
      cash_movement_type: ["entrada", "saida"],
      delivery_status: ["pendente", "pronto", "finalizado"],
      discount_type: ["percentage", "fixed"],
      order_source: [
        "ifood",
        "aiqfome",
        "whatsapp",
        "instagram",
        "telefone",
        "loja",
        "outro",
      ],
      order_status: ["aberto", "segurado", "finalizado", "cancelado", "pronto"],
      order_type: ["balcao", "mesa", "delivery", "retirada"],
      payment_method: ["pix", "cartao", "fiado", "dinheiro"],
      product_type: ["unit", "weight"],
      table_status: ["available", "occupied"],
    },
  },
} as const
