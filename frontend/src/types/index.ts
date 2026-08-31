export type UserRole = 'ADMIN' | 'MAGACIONER';

export type MovementType =
  | '101_INBOUND'
  | '201_OUTBOUND'
  | '551_SCRAP'
  | '301_TRANSFER'
  | '301_TRANSFER_OUT'
  | '301_TRANSFER_IN'
  | 'INBOUND'
  | 'OUTBOUND';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  city: string;
  address: string;
  capacity_sqm: number;
  is_active: boolean | number;
  created_at?: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit_of_measure: string;
  unit_price: number;
  min_threshold: number;
  created_at?: string;
  current_stock?: number;
  total_value?: number;
  stock_status?: 'OPTIMALNO' | 'KRITIČNO' | 'NEMA NA STANJU';
}

export interface StockMovement {
  id: number;
  product_id: number;
  warehouse_id: number;
  user_id: number;
  movement_type: MovementType;
  quantity: number;
  reference_doc: string | null;
  notes: string | null;
  movement_date: string;
  product_name?: string;
  product_sku?: string;
  unit_of_measure?: string;
  warehouse_name?: string;
  warehouse_code?: string;
  warehouse_city?: string;
  user_name?: string;
}

export interface ReconciliationItem {
  product_id: number;
  product_sku: string;
  product_name: string;
  warehouse_id: number;
  warehouse_name: string;
  warehouse_city: string;
  ledger_sum: number;
  snapshot_quantity: number;
  delta: number;
  is_match: boolean;
}

export interface ReconciliationReport {
  is_healthy: boolean;
  total_records_checked: number;
  total_discrepancies: number;
  timestamp: string;
  details: ReconciliationItem[];
}

export interface DashboardStats {
  kpis: {
    total_warehouses: number;
    total_products: number;
    total_movements: number;
    total_stock_items: number;
    total_inventory_value: number;
    critical_stock_count: number;
    architecture?: string;
  };
  low_stock_products: Array<{
    id: number;
    sku: string;
    name: string;
    category: string;
    unit_of_measure: string;
    current_stock: number;
    min_threshold: number;
    is_out_of_stock: boolean;
  }>;
  recent_movements: StockMovement[];
  warehouse_stats: Array<{
    id: number;
    code: string;
    name: string;
    city: string;
    total_items: number;
    total_inventory_value: number;
    distinct_products_count: number;
    total_movements: number;
  }>;
}
