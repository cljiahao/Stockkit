export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// The ledger entry kind. 'initial' is the DB-seeded opening balance recorded
// when a product is first created with a nonzero starting on_hand — never
// chosen by the user through the stock-movement form (see schemas.ts).
export type StockMovementReason = 'restock' | 'waste' | 'adjustment' | 'initial';

export interface Database {
  stockkit: {
    Tables: {
      vendors: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          tour_seen_at: string | null;
          plan: 'free' | 'pro';
        };
        Insert: {
          id: string;
          name: string;
          created_at?: string;
          tour_seen_at?: string | null;
          plan?: 'free' | 'pro';
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          tour_seen_at?: string | null;
          plan?: 'free' | 'pro';
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          unit: string;
          unit_cost_cents: number;
          on_hand: number;
          low_stock_threshold: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          name: string;
          unit?: string;
          unit_cost_cents?: number;
          on_hand?: number;
          low_stock_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          name?: string;
          unit?: string;
          unit_cost_cents?: number;
          on_hand?: number;
          low_stock_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_vendor_id_fkey';
            columns: ['vendor_id'];
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_movements: {
        Row: {
          id: string;
          vendor_id: string;
          product_id: string;
          delta: number;
          reason: StockMovementReason;
          note: string | null;
          unit_cost_cents: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          product_id: string;
          delta: number;
          reason: StockMovementReason;
          note?: string | null;
          unit_cost_cents?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          product_id?: string;
          delta?: number;
          reason?: StockMovementReason;
          note?: string | null;
          unit_cost_cents?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_movements_vendor_id_fkey';
            columns: ['vendor_id'];
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      feedback: {
        Row: {
          id: number;
          vendor_id: string;
          nps: number;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          vendor_id: string;
          nps: number;
          message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          vendor_id?: string;
          nps?: number;
          message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      // Policy-internal (products_vendor_insert's WITH CHECK, migration
      // 0011). Mirrored here to keep this file a faithful schema mirror —
      // the app never calls it via .rpc(); the plan cap it enforces is
      // surfaced to vendors by saveProduct's own friendly-error check.
      can_create_product: {
        Args: { p_vendor: string };
        Returns: boolean;
      };
      record_stock_movement: {
        Args: {
          p_product_id: string;
          p_delta: number;
          p_reason: string;
          p_note?: string | null;
          p_unit_cost_cents?: number | null;
        };
        Returns: Database['stockkit']['Tables']['products']['Row'];
      };
      sync_vendor_profile: {
        Args: { p_stall_name: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Vendor = Database['stockkit']['Tables']['vendors']['Row'];
export type Product = Database['stockkit']['Tables']['products']['Row'];
export type StockMovement = Database['stockkit']['Tables']['stock_movements']['Row'];
export type Feedback = Database['stockkit']['Tables']['feedback']['Row'];
