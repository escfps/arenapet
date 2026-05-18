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
      battles: {
        Row: {
          attacker_id: string
          coins_reward: number
          created_at: string
          defender_id: string
          id: string
          log: Json
          winner_id: string
          xp_reward: number
        }
        Insert: {
          attacker_id: string
          coins_reward?: number
          created_at?: string
          defender_id: string
          id?: string
          log?: Json
          winner_id: string
          xp_reward?: number
        }
        Update: {
          attacker_id?: string
          coins_reward?: number
          created_at?: string
          defender_id?: string
          id?: string
          log?: Json
          winner_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      expeditions: {
        Row: {
          claimed: boolean
          coins_reward: number
          created_at: string
          duration_minutes: number
          ends_at: string
          food_cost: number
          gems_reward: number
          id: string
          monster_id: string
          ration_drop: number
          started_at: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          claimed?: boolean
          coins_reward?: number
          created_at?: string
          duration_minutes: number
          ends_at: string
          food_cost?: number
          gems_reward?: number
          id?: string
          monster_id: string
          ration_drop?: number
          started_at?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          claimed?: boolean
          coins_reward?: number
          created_at?: string
          duration_minutes?: number
          ends_at?: string
          food_cost?: number
          gems_reward?: number
          id?: string
          monster_id?: string
          ration_drop?: number
          started_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      inventory: {
        Row: {
          item_type: string
          quantity: number
          user_id: string
        }
        Insert: {
          item_type: string
          quantity?: number
          user_id: string
        }
        Update: {
          item_type?: string
          quantity?: number
          user_id?: string
        }
        Relationships: []
      }
      monsters: {
        Row: {
          atk: number
          battle_energy: number
          battle_energy_at: string
          created_at: string
          def: number
          energy: number
          happiness: number
          hp: number
          hunger: number
          id: string
          in_team: boolean
          int: number
          last_tick: string
          name: string
          owner_id: string
          rank: number
          skin: string
          spd: number
          species: string
        }
        Insert: {
          atk?: number
          battle_energy?: number
          battle_energy_at?: string
          created_at?: string
          def?: number
          energy?: number
          happiness?: number
          hp?: number
          hunger?: number
          id?: string
          in_team?: boolean
          int?: number
          last_tick?: string
          name: string
          owner_id: string
          rank?: number
          skin?: string
          spd?: number
          species: string
        }
        Update: {
          atk?: number
          battle_energy?: number
          battle_energy_at?: string
          created_at?: string
          def?: number
          energy?: number
          happiness?: number
          hp?: number
          hunger?: number
          id?: string
          in_team?: boolean
          int?: number
          last_tick?: string
          name?: string
          owner_id?: string
          rank?: number
          skin?: string
          spd?: number
          species?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          arena_points: number
          coins: number
          created_at: string
          expedition_slots: number
          gems: number
          id: string
          level: number
          losses: number
          updated_at: string
          username: string
          vip_until: string | null
          wins: number
          xp: number
        }
        Insert: {
          arena_points?: number
          coins?: number
          created_at?: string
          expedition_slots?: number
          gems?: number
          id: string
          level?: number
          losses?: number
          updated_at?: string
          username: string
          vip_until?: string | null
          wins?: number
          xp?: number
        }
        Update: {
          arena_points?: number
          coins?: number
          created_at?: string
          expedition_slots?: number
          gems?: number
          id?: string
          level?: number
          losses?: number
          updated_at?: string
          username?: string
          vip_until?: string | null
          wins?: number
          xp?: number
        }
        Relationships: []
      }
      skins_owned: {
        Row: {
          acquired_at: string
          skin_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          skin_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          skin_id?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string
          from_confirmed: boolean
          from_monster_id: string
          from_user_id: string
          id: string
          status: string
          to_confirmed: boolean
          to_monster_id: string | null
          to_user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          from_confirmed?: boolean
          from_monster_id: string
          from_user_id: string
          id?: string
          status?: string
          to_confirmed?: boolean
          to_monster_id?: string | null
          to_user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          from_confirmed?: boolean
          from_monster_id?: string
          from_user_id?: string
          id?: string
          status?: string
          to_confirmed?: boolean
          to_monster_id?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_from_monster_id_fkey"
            columns: ["from_monster_id"]
            isOneToOne: false
            referencedRelation: "monsters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_to_monster_id_fkey"
            columns: ["to_monster_id"]
            isOneToOne: false
            referencedRelation: "monsters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
