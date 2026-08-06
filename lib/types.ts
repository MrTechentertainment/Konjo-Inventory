export type TransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'AUDIT_ADJUSTMENT';

export interface Product {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  category: string;
  low_stock_threshold: number;
  is_active: boolean;
  description: string | null;
  updated_at?: string;
  created_at: string;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  change_amount: number;
  transaction_type: TransactionType;
  notes: string | null;
  logged_by: string;
  timestamp: string;
}

/** A transaction joined with the product it belongs to, for the audit drawer. */
export interface InventoryTransactionWithProduct extends InventoryTransaction {
  products: Pick<Product, 'name' | 'sku'> | null;
}

export type SyncState = 'online' | 'syncing' | 'offline';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'BASIC';
export type OutletType = 'SUPERMARKET' | 'BAZAAR' | 'EVENT' | 'GIFT' | 'SAMPLE';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  must_reset_password: boolean;
  analytics_access: boolean;
  created_at: string;
}

export interface Outlet {
  id: string;
  name: string;
  type: OutletType;
  created_by: string | null;
  creator_name?: string | null;
  exception_flag: boolean;
  exception_note: string | null;
  deleted_at: string | null;
  created_at: string;
}

export type QuantityUnit = 'BOTTLE' | 'PACK';
export type PipelineStatus = 'DELIVERED' | 'PENDING_ORDER' | 'WAITING_CONFIRMATION' | 'PAID' | 'CONSIGNMENT';

export interface ProductPrice {
  id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  pack_size: number;
  tax_rate: number;
  bottle_price_before_tax: number;
  bottle_price_after_tax: number;
  pack_price_before_tax: number;
  pack_price_after_tax: number;
  effective_from: string;
  effective_to: string | null;
  version: number;
}

export interface DeliveryLineInput {
  product_id: string;
  quantity: number;
  unit: QuantityUnit;
}

export interface OutletDuplicate {
  id: string;
  name: string;
  created_by_name: string;
}

export interface DeliveryLogRow {
  id: string;
  batch_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit: QuantityUnit;
  quantity_bottles: number;
  occurred_at: string;
  recorded_at: string;
  status: PipelineStatus;
  recorded_by_name: string;
}

export interface PipelineSummary {
  status: PipelineStatus;
  item_count: number;
  bottle_count: number;
  amount_after_tax: number;
}

export interface MonthlyAnalytics {
  total_current_inventory: number;
  outlet_inventory: number;
  total_sales_volume: number;
  pending_sales: number;
  projected_sales: number;
  gross_revenue: number;
  net_revenue: number;
  total_tax_liability: number;
  outstanding_orders: number;
  active_outlets: number;
  low_stock_products: number;
  inventory_turnover: number;
}

export interface OutletInventory {
  id: string;
  outlet_id: string;
  product_id: string;
  stock_bottles: number;
  updated_at: string;
}

export interface OutletOperationFeedRow {
  id: string;
  outlet_id: string;
  outlet_name: string;
  outlet_type: OutletType;
  product_id: string;
  product_name: string;
  product_sku: string;
  change_bottles: number;
  username: string;
  timestamp: string;
}
