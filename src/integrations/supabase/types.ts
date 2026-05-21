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
          attacker_points_delta: number
          coins_reward: number
          created_at: string
          defender_id: string
          defender_points_delta: number
          id: string
          log: Json
          winner_id: string
          xp_reward: number
        }
        Insert: {
          attacker_id: string
          attacker_points_delta?: number
          coins_reward?: number
          created_at?: string
          defender_id: string
          defender_points_delta?: number
          id?: string
          log?: Json
          winner_id: string
          xp_reward?: number
        }
        Update: {
          attacker_id?: string
          attacker_points_delta?: number
          coins_reward?: number
          created_at?: string
          defender_id?: string
          defender_points_delta?: number
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
      friend_challenges: {
        Row: {
          battle_id: string | null
          battle_log: Json | null
          challenger_id: string
          created_at: string
          id: string
          responded_at: string | null
          status: string
          target_id: string
          winner_id: string | null
        }
        Insert: {
          battle_id?: string | null
          battle_log?: Json | null
          challenger_id: string
          created_at?: string
          id?: string
          responded_at?: string | null
          status?: string
          target_id: string
          winner_id?: string | null
        }
        Update: {
          battle_id?: string | null
          battle_log?: Json | null
          challenger_id?: string
          created_at?: string
          id?: string
          responded_at?: string | null
          status?: string
          target_id?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      friend_gifts: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string
          gift_type: string
          id: string
          receiver_id: string
          sender_id: string
          sent_date: string
        }
        Insert: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          gift_type: string
          id?: string
          receiver_id: string
          sender_id: string
          sent_date?: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          gift_type?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          sent_date?: string
        }
        Relationships: []
      }
      friend_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          requester_id: string
          status: string
          user_a: string
          user_b: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          user_a: string
          user_b: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      gem_purchases: {
        Row: {
          amount_brl: number
          created_at: string
          environment: string
          gems_credited: number
          id: string
          paddle_transaction_id: string
          price_id: string
          user_id: string
        }
        Insert: {
          amount_brl: number
          created_at?: string
          environment?: string
          gems_credited: number
          id?: string
          paddle_transaction_id: string
          price_id: string
          user_id: string
        }
        Update: {
          amount_brl?: number
          created_at?: string
          environment?: string
          gems_credited?: number
          id?: string
          paddle_transaction_id?: string
          price_id?: string
          user_id?: string
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
          team_position: number
          train_count: number
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
          team_position?: number
          train_count?: number
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
          team_position?: number
          train_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          arena_points: number
          bp_customer_id: string | null
          bp_days_claimed: number
          bp_last_claim_date: string | null
          bp_monthly_claimed: boolean
          bp_silvers_given: number
          bp_started_at: string | null
          bp_status: string | null
          bp_subscription_id: string | null
          coins: number
          created_at: string
          expedition_slots: number
          gems: number
          highest_tier_rank: number
          id: string
          is_bot: boolean
          last_seen_at: string | null
          level: number
          losses: number
          nick_changes: number
          pity_gold: number
          pity_legendary: number
          pity_silver: number
          updated_at: string
          username: string
          vip_until: string | null
          welcome_chest_claimed: boolean
          wins: number
          xp: number
        }
        Insert: {
          arena_points?: number
          bp_customer_id?: string | null
          bp_days_claimed?: number
          bp_last_claim_date?: string | null
          bp_monthly_claimed?: boolean
          bp_silvers_given?: number
          bp_started_at?: string | null
          bp_status?: string | null
          bp_subscription_id?: string | null
          coins?: number
          created_at?: string
          expedition_slots?: number
          gems?: number
          highest_tier_rank?: number
          id: string
          is_bot?: boolean
          last_seen_at?: string | null
          level?: number
          losses?: number
          nick_changes?: number
          pity_gold?: number
          pity_legendary?: number
          pity_silver?: number
          updated_at?: string
          username: string
          vip_until?: string | null
          welcome_chest_claimed?: boolean
          wins?: number
          xp?: number
        }
        Update: {
          arena_points?: number
          bp_customer_id?: string | null
          bp_days_claimed?: number
          bp_last_claim_date?: string | null
          bp_monthly_claimed?: boolean
          bp_silvers_given?: number
          bp_started_at?: string | null
          bp_status?: string | null
          bp_subscription_id?: string | null
          coins?: number
          created_at?: string
          expedition_slots?: number
          gems?: number
          highest_tier_rank?: number
          id?: string
          is_bot?: boolean
          last_seen_at?: string | null
          level?: number
          losses?: number
          nick_changes?: number
          pity_gold?: number
          pity_legendary?: number
          pity_silver?: number
          updated_at?: string
          username?: string
          vip_until?: string | null
          welcome_chest_claimed?: boolean
          wins?: number
          xp?: number
        }
        Relationships: []
      }
      redeem_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          id: string
          reward_data: Json
          reward_type: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          id?: string
          reward_data?: Json
          reward_type: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          reward_data?: Json
          reward_type?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      season_trophies: {
        Row: {
          arena_points: number
          created_at: string
          final_rank: number | null
          id: string
          season_number: number
          tier: string
          user_id: string
        }
        Insert: {
          arena_points?: number
          created_at?: string
          final_rank?: number | null
          id?: string
          season_number: number
          tier: string
          user_id: string
        }
        Update: {
          arena_points?: number
          created_at?: string
          final_rank?: number | null
          id?: string
          season_number?: number
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          ended_at: string | null
          ends_at: string
          id: string
          number: number
          started_at: string
          status: string
        }
        Insert: {
          ended_at?: string | null
          ends_at: string
          id?: string
          number: number
          started_at?: string
          status?: string
        }
        Update: {
          ended_at?: string | null
          ends_at?: string
          id?: string
          number?: number
          started_at?: string
          status?: string
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
      tournament_champions: {
        Row: {
          last_win_at: string | null
          user_id: string
          wins: number
        }
        Insert: {
          last_win_at?: string | null
          user_id: string
          wins?: number
        }
        Update: {
          last_win_at?: string | null
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          created_at: string
          eliminated_round: number | null
          id: string
          is_bot: boolean
          power: number | null
          seed: number | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          eliminated_round?: number | null
          id?: string
          is_bot?: boolean
          power?: number | null
          seed?: number | null
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          eliminated_round?: number | null
          id?: string
          is_bot?: boolean
          power?: number | null
          seed?: number | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          created_at: string
          id: string
          log: Json | null
          p1_id: string | null
          p2_id: string | null
          played_at: string | null
          round: number
          score: string | null
          slot: number
          status: string
          tournament_id: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          log?: Json | null
          p1_id?: string | null
          p2_id?: string | null
          played_at?: string | null
          round: number
          score?: string | null
          slot: number
          status?: string
          tournament_id: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          log?: Json | null
          p1_id?: string | null
          p2_id?: string | null
          played_at?: string | null
          round?: number
          score?: string | null
          slot?: number
          status?: string
          tournament_id?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          champion_id: string | null
          champion_reward: Json | null
          created_at: string
          current_round: number
          finished_at: string | null
          id: string
          round_duration_seconds: number
          round_started_at: string | null
          slot_at: string
          status: string
        }
        Insert: {
          champion_id?: string | null
          champion_reward?: Json | null
          created_at?: string
          current_round?: number
          finished_at?: string | null
          id?: string
          round_duration_seconds?: number
          round_started_at?: string | null
          slot_at: string
          status?: string
        }
        Update: {
          champion_id?: string | null
          champion_reward?: Json | null
          created_at?: string
          current_round?: number
          finished_at?: string | null
          id?: string
          round_duration_seconds?: number
          round_started_at?: string | null
          slot_at?: string
          status?: string
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
      _bot_apply_levelup: {
        Args: { bot_id: string; from_lvl: number; to_lvl: number }
        Returns: undefined
      }
      _bot_award_xp: {
        Args: { bot_id: string; xp_amount: number }
        Returns: undefined
      }
      _bot_build_battle_log: {
        Args: { p_a: string; p_b: string; p_winner: string }
        Returns: Json
      }
      _bot_pick_chest_rarity: {
        Args: { p_arena_points: number }
        Returns: string
      }
      _bot_pull_card: {
        Args: { p_bot: string; p_rarity: string }
        Returns: undefined
      }
      _bot_random_species: { Args: { rarity: string }; Returns: string }
      _bot_rarity_weight: { Args: { r: string }; Returns: number }
      _bot_species_name: { Args: { sp: string }; Returns: string }
      _bot_species_rarity: { Args: { sp: string }; Returns: string }
      _bot_species_stats: {
        Args: { sp: string }
        Returns: {
          atk: number
          def: number
          hp: number
          spd: number
        }[]
      }
      _bot_try_upgrade_team: {
        Args: { bot_id: string; new_species: string }
        Returns: undefined
      }
      _bot_xp_for_next: { Args: { lvl: number }; Returns: number }
      _season_grant_chest: {
        Args: { p_item: string; p_qty: number; p_user: string }
        Returns: undefined
      }
      _season_tier_name: {
        Args: { p_points: number; p_rank: number }
        Returns: string
      }
      _tour_next_slot: { Args: never; Returns: string }
      _tour_pick_winner: {
        Args: { p1: string; p2: string; pw1: number; pw2: number }
        Returns: string
      }
      _tour_rank_mult: { Args: { r: number }; Returns: number }
      _tour_team_power: { Args: { uid: string }; Returns: number }
      advance_tournament_round: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      apply_arena_defender_result: {
        Args: {
          p_attacker_won: boolean
          p_defender_id: string
          p_loss_pts: number
          p_win_pts: number
        }
        Returns: undefined
      }
      close_tournament_registration: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      end_season: { Args: { p_season_id: string }; Returns: undefined }
      ensure_tournament: { Args: { slot: string }; Returns: string }
      join_tournament: { Args: { p_tournament_id: string }; Returns: Json }
      report_match_result: {
        Args: { p_log: Json; p_match_id: string; p_winner_id: string }
        Returns: undefined
      }
      seasons_tick: { Args: never; Returns: undefined }
      simulate_bot_battles: { Args: never; Returns: undefined }
      tournaments_tick: { Args: never; Returns: undefined }
      train_bot_pets: { Args: never; Returns: undefined }
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
