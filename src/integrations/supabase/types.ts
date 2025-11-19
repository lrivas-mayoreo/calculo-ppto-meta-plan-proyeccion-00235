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
      budgets: {
        Row: {
          created_at: string
          empresa: string
          fecha_destino: string
          id: string
          marca: string
          presupuesto: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
          vendor_adjustments: Json | null
        }
        Insert: {
          created_at?: string
          empresa: string
          fecha_destino: string
          id?: string
          marca: string
          presupuesto: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
          vendor_adjustments?: Json | null
        }
        Update: {
          created_at?: string
          empresa?: string
          fecha_destino?: string
          id?: string
          marca?: string
          presupuesto?: number
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
          vendor_adjustments?: Json | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          codigo: string
          created_at: string
          id: string
          nombre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          nombre: string
          updated_at?: string
          user_id: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          nombre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          created_at: string | null
          error_count: number | null
          error_message: string | null
          id: string
          processed_rows: number | null
          status: string
          success_count: number | null
          total_rows: number | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_count?: number | null
          error_message?: string | null
          id?: string
          processed_rows?: number | null
          status?: string
          success_count?: number | null
          total_rows?: number | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_count?: number | null
          error_message?: string | null
          id?: string
          processed_rows?: number | null
          status?: string
          success_count?: number | null
          total_rows?: number | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      import_staging: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          processed: boolean | null
          row_data: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          processed?: boolean | null
          row_data: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          processed?: boolean | null
          row_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_staging_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      marcas: {
        Row: {
          codigo: string
          created_at: string
          id: string
          nombre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          nombre: string
          updated_at?: string
          user_id: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          nombre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
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
      vendedores: {
        Row: {
          codigo: string
          created_at: string
          id: string
          nombre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          nombre: string
          updated_at?: string
          user_id: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          nombre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ventas_reales: {
        Row: {
          codigo_cliente: string
          codigo_marca: string
          codigo_vendedor: string | null
          created_at: string
          id: string
          mes: string
          monto: number
          updated_at: string
          user_id: string
        }
        Insert: {
          codigo_cliente: string
          codigo_marca: string
          codigo_vendedor?: string | null
          created_at?: string
          id?: string
          mes: string
          monto: number
          updated_at?: string
          user_id: string
        }
        Update: {
          codigo_cliente?: string
          codigo_marca?: string
          codigo_vendedor?: string | null
          created_at?: string
          id?: string
          mes?: string
          monto?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_reales_user_id_codigo_cliente_fkey"
            columns: ["user_id", "codigo_cliente"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["user_id", "codigo"]
          },
          {
            foreignKeyName: "ventas_reales_user_id_codigo_marca_fkey"
            columns: ["user_id", "codigo_marca"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["user_id", "codigo"]
          },
          {
            foreignKeyName: "ventas_reales_user_id_codigo_vendedor_fkey"
            columns: ["user_id", "codigo_vendedor"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["user_id", "codigo"]
          },
        ]
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
      process_import_batch: {
        Args: { p_batch_size?: number; p_job_id: string }
        Returns: {
          errors: number
          processed: number
        }[]
      }
    }
    Enums: {
      app_role: "administrador" | "gerente" | "admin_ventas" | "vendedor"
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
      app_role: ["administrador", "gerente", "admin_ventas", "vendedor"],
    },
  },
} as const
