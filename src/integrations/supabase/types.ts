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
      cash_registers: {
        Row: {
          closed_at: string | null
          id: string
          initial_amount: number
          notes: string | null
          opened_at: string
          opened_by: string
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
          total_card?: number
          total_cash?: number
          total_fiado?: number
          total_pix?: number
          total_sales?: number
        }
        Relationships: []
      }
      categories: {
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
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          min_order: number | null
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
          type?: Database["public"]["Enums"]["discount_type"]
          value?: number
        }
        Relationships: []
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
          updated_at?: string
        }
        Relationships: []
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
          status: Database["public"]["Enums"]["order_status"]
          table_number: number | null
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
          status?: Database["public"]["Enums"]["order_status"]
          table_number?: number | null
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
          status?: Database["public"]["Enums"]["order_status"]
          table_number?: number | null
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
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
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
          total: number
        }
        Insert: {
          customer_id?: string | null
          date?: string
          id?: string
          items?: Json
          order_id?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          total?: number
        }
        Update: {
          customer_id?: string | null
          date?: string
          id?: string
          items?: Json
          order_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
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
        ]
      }
      stock_entries: {
        Row: {
          date: string
          id: string
          product_id: string
          quantity: number
          supplier_id: string | null
        }
        Insert: {
          date?: string
          id?: string
          product_id: string
          quantity?: number
          supplier_id?: string | null
        }
        Update: {
          date?: string
          id?: string
          product_id?: string
          quantity?: number
          supplier_id?: string | null
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
        ]
      }
      store_settings: {
        Row: {
          id: string
          table_count: number
          updated_at: string
        }
        Insert: {
          id?: string
          table_count?: number
          updated_at?: string
        }
        Update: {
          id?: string
          table_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      store_tables: {
        Row: {
          id: string
          number: number
          order_id: string | null
          status: Database["public"]["Enums"]["table_status"]
        }
        Insert: {
          id?: string
          number: number
          order_id?: string | null
          status?: Database["public"]["Enums"]["table_status"]
        }
        Update: {
          id?: string
          number?: number
          order_id?: string | null
          status?: Database["public"]["Enums"]["table_status"]
        }
        Relationships: [
          {
            foreignKeyName: "store_tables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
        }
        Insert: {
          contact?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          contact?: string
          created_at?: string
          id?: string
          name?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "atendente" | "motoboy"
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
      app_role: ["admin", "atendente", "motoboy"],
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
