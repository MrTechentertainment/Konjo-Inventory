export type TransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'AUDIT_ADJUSTMENT';

export interface Product {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  category: string;
  low_stock_threshold: number;
  unit_price_etb: number;
  tax_rate: number;
  bottles_per_pack: number;
  image_url: string | null;
  stock_revision: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCreateInput {
  name: string;
  sku: string;
  category: string;
  current_stock: number;
  low_stock_threshold: number;
  unit_price_etb: number;
  tax_rate: number;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  change_amount: number;
  transaction_type: TransactionType;
  notes: string | null;
  logged_by: string;
  operation_id: string | null;
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
  role: UserRole;
  created_at: string;
}

export interface Outlet {
  id: string;
  name: string;
  type: OutletType;
  address: string | null;
  subcity: string | null;
  source_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OutletInventory {
  id: string;
  outlet_id: string;
  product_id: string;
  stock_bottles: number;
  stock_revision: number;
  updated_at: string;
}

export interface CreditSale {
  id: string;
  external_key: string;
  outlet_id: string;
  legacy_reference: string | null;
  payment_status: 'PAID' | 'UNPAID' | 'UNKNOWN';
  total_price: number | null;
  total_price_raw: string | null;
  refilled_date: string | null;
  refilled_date_raw: string | null;
  due_date: string | null;
  due_date_raw: string | null;
  payment_date: string | null;
  payment_date_raw: string | null;
  bottle_price_raw: string | null;
  agreement_period: string | null;
  payment_type: string | null;
  notes: string | null;
  sales_representative: string | null;
  source_name: string;
  source_row: number;
  imported_at: string;
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

export interface OutletDeliveryFinancialRow {
  id: string;
  delivery_batch_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_entered: number;
  quantity_unit: 'BOTTLE' | 'PACK';
  quantity_bottles: number;
  bottles_per_pack: number;
  unit_price_etb: number;
  tax_rate: number;
  subtotal_etb: number;
  tax_amount_etb: number;
  total_amount_etb: number;
  username: string;
  timestamp: string;
  notes: string | null;
}
