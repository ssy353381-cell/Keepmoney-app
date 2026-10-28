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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          initial_balance: number
          is_archived: boolean
          ledger_id: string
          name: string
          sort_order: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          initial_balance?: number
          is_archived?: boolean
          ledger_id: string
          name: string
          sort_order?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          initial_balance?: number
          is_archived?: boolean
          ledger_id?: string
          name?: string
          sort_order?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          category_kind: Database["public"]["Enums"]["category_kind"]
          created_at: string
          id: string
          ledger_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          category_kind?: Database["public"]["Enums"]["category_kind"]
          created_at?: string
          id?: string
          ledger_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          category_kind?: Database["public"]["Enums"]["category_kind"]
          created_at?: string
          id?: string
          ledger_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_ledger_id_category_kind_category_id_fkey"
            columns: ["ledger_id", "category_kind", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["ledger_id", "kind", "id"]
          },
          {
            foreignKeyName: "budgets_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_archived: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          ledger_id: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          ledger_id: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["category_kind"]
          ledger_id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_ledger_id_kind_parent_id_fkey"
            columns: ["ledger_id", "kind", "parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["ledger_id", "kind", "id"]
          },
        ]
      }
      ledger_members: {
        Row: {
          created_at: string
          ledger_id: string
          role: Database["public"]["Enums"]["ledger_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          ledger_id: string
          role?: Database["public"]["Enums"]["ledger_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          ledger_id?: string
          role?: Database["public"]["Enums"]["ledger_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_members_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledgers: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          category_kind: Database["public"]["Enums"]["category_kind"] | null
          created_at: string
          created_by: string | null
          end_on: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          interval_count: number
          is_active: boolean
          ledger_id: string
          next_occurs_on: string
          note: string | null
          start_on: string
          to_account_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          category_kind?: Database["public"]["Enums"]["category_kind"] | null
          created_at?: string
          created_by?: string | null
          end_on?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval_count?: number
          is_active?: boolean
          ledger_id: string
          next_occurs_on: string
          note?: string | null
          start_on: string
          to_account_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          category_kind?: Database["public"]["Enums"]["category_kind"] | null
          created_at?: string
          created_by?: string | null
          end_on?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval_count?: number
          is_active?: boolean
          ledger_id?: string
          next_occurs_on?: string
          note?: string | null
          start_on?: string
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_ledger_id_account_id_fkey"
            columns: ["ledger_id", "account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["ledger_id", "account_id"]
          },
          {
            foreignKeyName: "recurring_transactions_ledger_id_account_id_fkey"
            columns: ["ledger_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["ledger_id", "id"]
          },
          {
            foreignKeyName: "recurring_transactions_ledger_id_category_kind_category_id_fkey"
            columns: ["ledger_id", "category_kind", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["ledger_id", "kind", "id"]
          },
          {
            foreignKeyName: "recurring_transactions_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_ledger_id_to_account_id_fkey"
            columns: ["ledger_id", "to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["ledger_id", "account_id"]
          },
          {
            foreignKeyName: "recurring_transactions_ledger_id_to_account_id_fkey"
            columns: ["ledger_id", "to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["ledger_id", "id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          ledger_id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          ledger_id: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          ledger_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tags: {
        Row: {
          ledger_id: string
          tag_id: string
          transaction_id: string
        }
        Insert: {
          ledger_id: string
          tag_id: string
          transaction_id: string
        }
        Update: {
          ledger_id?: string
          tag_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_ledger_id_tag_id_fkey"
            columns: ["ledger_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["ledger_id", "id"]
          },
          {
            foreignKeyName: "transaction_tags_ledger_id_transaction_id_fkey"
            columns: ["ledger_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["ledger_id", "id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          category_kind: Database["public"]["Enums"]["category_kind"] | null
          created_at: string
          created_by: string | null
          id: string
          ledger_id: string
          note: string | null
          occurred_on: string
          recurring_id: string | null
          to_account_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          category_kind?: Database["public"]["Enums"]["category_kind"] | null
          created_at?: string
          created_by?: string | null
          id?: string
          ledger_id: string
          note?: string | null
          occurred_on: string
          recurring_id?: string | null
          to_account_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          category_kind?: Database["public"]["Enums"]["category_kind"] | null
          created_at?: string
          created_by?: string | null
          id?: string
          ledger_id?: string
          note?: string | null
          occurred_on?: string
          recurring_id?: string | null
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_ledger_id_account_id_fkey"
            columns: ["ledger_id", "account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["ledger_id", "account_id"]
          },
          {
            foreignKeyName: "transactions_ledger_id_account_id_fkey"
            columns: ["ledger_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["ledger_id", "id"]
          },
          {
            foreignKeyName: "transactions_ledger_id_category_kind_category_id_fkey"
            columns: ["ledger_id", "category_kind", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["ledger_id", "kind", "id"]
          },
          {
            foreignKeyName: "transactions_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ledger_id_recurring_id_fkey"
            columns: ["ledger_id", "recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["ledger_id", "id"]
          },
          {
            foreignKeyName: "transactions_ledger_id_to_account_id_fkey"
            columns: ["ledger_id", "to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["ledger_id", "account_id"]
          },
          {
            foreignKeyName: "transactions_ledger_id_to_account_id_fkey"
            columns: ["ledger_id", "to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["ledger_id", "id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          balance: number | null
          ledger_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type:
        | "cash"
        | "bank"
        | "credit_card"
        | "e_wallet"
        | "investment"
        | "other"
      category_kind: "expense" | "income"
      ledger_role: "owner" | "editor" | "viewer"
      recurrence_frequency: "daily" | "weekly" | "monthly" | "yearly"
      transaction_type: "expense" | "income" | "transfer"
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
      account_type: [
        "cash",
        "bank",
        "credit_card",
        "e_wallet",
        "investment",
        "other",
      ],
      category_kind: ["expense", "income"],
      ledger_role: ["owner", "editor", "viewer"],
      recurrence_frequency: ["daily", "weekly", "monthly", "yearly"],
      transaction_type: ["expense", "income", "transfer"],
    },
  },
} as const
