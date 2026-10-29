export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export type PaymentMethod =
  | 'razorpay'
  | 'cod'
  | 'upi_manual';

export interface OrderItem {
  id?: string;
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
  variant?: string;
  image_url?: string;
  subtotal: number;
}

export interface ShippingAddress {
  recipient_name?: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface Order {
  id: string;
  account_id: string;
  contact_id?: string | null;
  conversation_id?: string | null;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  shipping_address: ShippingAddress;
  items: OrderItem[];
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_payment_link_id?: string | null;
  razorpay_payment_link_url?: string | null;
  payment_captured_at?: string | null;
  tracking_carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  name: string;
  options: string[];
}

export interface Product {
  id: string;
  account_id: string;
  name: string;
  description?: string | null;
  category: string;
  price: number;
  compare_at_price?: number | null;
  image_url?: string | null;
  sku?: string | null;
  in_stock: boolean;
  variants?: ProductVariant[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
