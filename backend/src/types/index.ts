import { Request } from 'express';

export type UserRole = 'ADMIN' | 'MAGACIONER';

export type MovementType =
  | '101_INBOUND'          // SAP 101: Prijem robe od dobavljača (+Qty)
  | '201_OUTBOUND'         // SAP 201: Izdavanje robe za nalog / kupca (-Qty)
  | '551_SCRAP'            // SAP 551: Rashod / Otpis oštećene robe (-Qty)
  | '301_TRANSFER'         // SAP 301: Međuskladišni prenos
  | '301_TRANSFER_OUT'     // SAP 301: Izlaz sa izvornog skladišta (-Qty)
  | '301_TRANSFER_IN'      // SAP 301: Ulaz na odredišno skladište (+Qty)
  | 'INBOUND'              // Alias za 101_INBOUND
  | 'OUTBOUND';            // Alias za 201_OUTBOUND

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  city: string;
  address: string;
  capacity_sqm: number;
  is_active: boolean;
  created_at: Date;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit_of_measure: string;
  unit_price: number;
  min_threshold: number;
  created_at: Date;
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
  movement_date: Date;
  product_name?: string;
  product_sku?: string;
  unit_of_measure?: string;
  warehouse_name?: string;
  warehouse_code?: string;
  warehouse_city?: string;
  user_name?: string;
}

export interface CurrentStock {
  id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  updated_at: Date;
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

export interface JwtPayload {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
