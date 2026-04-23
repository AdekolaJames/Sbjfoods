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
      audit_logs: {
        Row: {
          action: string
          branch_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          branch_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          branch_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          manager_id: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          address: string | null
          branch_id: string | null
          business_name: string
          created_at: string
          currency: string
          email: string | null
          enable_cash: boolean
          enable_pos: boolean
          enable_transfer: boolean
          id: string
          logo_url: string | null
          phone: string | null
          receipt_footer: string | null
          service_charge_percent: number
          updated_at: string
          vat_percent: number
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          business_name?: string
          created_at?: string
          currency?: string
          email?: string | null
          enable_cash?: boolean
          enable_pos?: boolean
          enable_transfer?: boolean
          id?: string
          logo_url?: string | null
          phone?: string | null
          receipt_footer?: string | null
          service_charge_percent?: number
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          business_name?: string
          created_at?: string
          currency?: string
          email?: string | null
          enable_cash?: boolean
          enable_pos?: boolean
          enable_transfer?: boolean
          id?: string
          logo_url?: string | null
          phone?: string | null
          receipt_footer?: string | null
          service_charge_percent?: number
          updated_at?: string
          vat_percent?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          branch_id: string | null
          created_at: string
          email: string | null
          id: string
          last_order_date: string | null
          name: string
          phone: string
          total_orders: number
          total_spent: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_order_date?: string | null
          name: string
          phone: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_order_date?: string | null
          name?: string
          phone?: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string
          category: string
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          expense_date: string
          id: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id: string
          category?: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          category?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_addons: {
        Row: {
          branch_id: string
          category: string | null
          created_at: string
          id: string
          is_available: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          category?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          category?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_addons_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          branch_id: string
          category_id: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          prep_time: number | null
          price: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          prep_time?: number | null
          price?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          prep_time?: number | null
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          branch_id: string | null
          channel: string
          created_at: string
          error_message: string | null
          id: string
          message: string | null
          provider: string | null
          recipient: string | null
          status: string
        }
        Insert: {
          branch_id?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string | null
          provider?: string | null
          recipient?: string | null
          status: string
        }
        Update: {
          branch_id?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string | null
          provider?: string | null
          recipient?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          api_token: string | null
          branch_id: string | null
          created_at: string
          frequency: string
          id: string
          last_sent_at: string | null
          mock_mode: boolean
          phone_number_id: string | null
          provider: string
          report_time: string
          sender_id: string | null
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          api_token?: string | null
          branch_id?: string | null
          created_at?: string
          frequency?: string
          id?: string
          last_sent_at?: string | null
          mock_mode?: boolean
          phone_number_id?: string | null
          provider?: string
          report_time?: string
          sender_id?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          api_token?: string | null
          branch_id?: string | null
          created_at?: string
          frequency?: string
          id?: string
          last_sent_at?: string | null
          mock_mode?: boolean
          phone_number_id?: string | null
          provider?: string
          report_time?: string
          sender_id?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_addons: {
        Row: {
          addon_id: string | null
          addon_name: string
          created_at: string
          id: string
          order_item_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          addon_id?: string | null
          addon_name: string
          created_at?: string
          id?: string
          order_item_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          addon_id?: string | null
          addon_name?: string
          created_at?: string
          id?: string
          order_item_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "menu_item_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_addons_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          item_name: string
          menu_item_id: string | null
          notes: string | null
          order_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_name: string
          menu_item_id?: string | null
          notes?: string | null
          order_id: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_name?: string
          menu_item_id?: string | null
          notes?: string | null
          order_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          cashier_id: string
          created_at: string
          customer_address: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          deleted_at: string | null
          discount_amount: number
          discount_type: string | null
          id: string
          is_held: boolean
          notes: string | null
          offline_id: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          source: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string | null
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          cashier_id: string
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          discount_amount?: number
          discount_type?: string | null
          id?: string
          is_held?: boolean
          notes?: string | null
          offline_id?: string | null
          order_number: string
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          cashier_id?: string
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          discount_amount?: number
          discount_type?: string | null
          id?: string
          is_held?: boolean
          notes?: string | null
          offline_id?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          deleted_at: string | null
          id: string
          method: string
          order_id: string
          reference: string | null
          staff_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          method: string
          order_id: string
          reference?: string | null
          staff_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          method?: string
          order_id?: string
          reference?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          quantity_needed: number
          stock_item_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          quantity_needed: number
          stock_item_id: string
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          quantity_needed?: number
          stock_item_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          branch_id: string
          capacity: number
          created_at: string
          id: string
          status: string
          table_number: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          capacity?: number
          created_at?: string
          id?: string
          status?: string
          table_number: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capacity?: number
          created_at?: string
          id?: string
          status?: string
          table_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          is_enabled: boolean
          permission_key: string
          role_name: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          permission_key: string
          role_name: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          id?: string
          is_enabled?: boolean
          permission_key?: string
          role_name?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      staff_branch_assignments: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          average_cost: number
          base_unit: string | null
          branch_id: string
          category: string
          conversion_rate: number
          created_at: string
          id: string
          is_active: boolean
          low_stock_threshold: number
          name: string
          quantity: number
          sub_unit: string | null
          supplier: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          average_cost?: number
          base_unit?: string | null
          branch_id: string
          category?: string
          conversion_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          quantity?: number
          sub_unit?: string | null
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          average_cost?: number
          base_unit?: string | null
          branch_id?: string
          category?: string
          conversion_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          quantity?: number
          sub_unit?: string | null
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          action: string
          branch_id: string
          created_at: string
          deleted_at: string | null
          id: string
          order_id: string | null
          quantity: number
          reason: string | null
          staff_id: string
          stock_item_id: string
        }
        Insert: {
          action: string
          branch_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          order_id?: string | null
          quantity: number
          reason?: string | null
          staff_id: string
          stock_item_id: string
        }
        Update: {
          action?: string
          branch_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          order_id?: string | null
          quantity?: number
          reason?: string | null
          staff_id?: string
          stock_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_purchases: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          quantity_added: number
          stock_item_id: string
          supplier: string | null
          total_cost: number
          unit_cost: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          quantity_added: number
          stock_item_id: string
          supplier?: string | null
          total_cost?: number
          unit_cost: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          quantity_added?: number
          stock_item_id?: string
          supplier?: string | null
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_purchases_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          symbol?: string
          updated_at?: string
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
      generate_order_number: { Args: { _branch_code: string }; Returns: string }
      get_user_branch: { Args: { _user_id: string }; Returns: string }
      get_user_branches: { Args: { _user_id: string }; Returns: string[] }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_inventory_deduction: {
        Args: { _order_id: string }
        Returns: Json
      }
      system_reset: {
        Args: {
          _branch_id?: string
          _hard_delete?: boolean
          _reset_stock_qty?: boolean
          _scope_movements?: boolean
          _scope_orders?: boolean
          _scope_payments?: boolean
        }
        Returns: Json
      }
      system_reset_preview: {
        Args: {
          _branch_id?: string
          _reset_stock_qty?: boolean
          _scope_movements?: boolean
          _scope_orders?: boolean
          _scope_payments?: boolean
        }
        Returns: Json
      }
      user_can_access_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "cashier" | "kitchen" | "waiter" | "branch_manager"
      order_status:
        | "pending_approval"
        | "pending"
        | "sent_to_kitchen"
        | "preparing"
        | "ready"
        | "served"
        | "completed"
        | "cancelled"
      order_type: "dine_in" | "takeaway" | "delivery"
      payment_status: "unpaid" | "partial" | "paid" | "refunded"
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
      app_role: ["admin", "cashier", "kitchen", "waiter", "branch_manager"],
      order_status: [
        "pending_approval",
        "pending",
        "sent_to_kitchen",
        "preparing",
        "ready",
        "served",
        "completed",
        "cancelled",
      ],
      order_type: ["dine_in", "takeaway", "delivery"],
      payment_status: ["unpaid", "partial", "paid", "refunded"],
    },
  },
} as const
