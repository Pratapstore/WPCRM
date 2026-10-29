import { Badge } from '@/components/ui/badge';
import type { OrderStatus, PaymentStatus, PaymentMethod } from '@/types/orders';
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  CheckCheck,
  XCircle,
  AlertCircle,
  RotateCcw,
  CreditCard,
  Banknote,
  Smartphone,
} from 'lucide-react';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  switch (status) {
    case 'new':
      return (
        <Badge
          variant="outline"
          className={`bg-sky-500/10 text-sky-400 border-sky-500/30 gap-1 font-medium ${className || ''}`}
        >
          <Clock className="h-3 w-3" />
          <span>New</span>
        </Badge>
      );
    case 'confirmed':
      return (
        <Badge
          variant="outline"
          className={`bg-indigo-500/10 text-indigo-400 border-indigo-500/30 gap-1 font-medium ${className || ''}`}
        >
          <CheckCircle2 className="h-3 w-3" />
          <span>Confirmed</span>
        </Badge>
      );
    case 'processing':
      return (
        <Badge
          variant="outline"
          className={`bg-purple-500/10 text-purple-400 border-purple-500/30 gap-1 font-medium ${className || ''}`}
        >
          <Package className="h-3 w-3" />
          <span>Processing</span>
        </Badge>
      );
    case 'shipped':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1 font-medium ${className || ''}`}
        >
          <Truck className="h-3 w-3" />
          <span>Shipped</span>
        </Badge>
      );
    case 'delivered':
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1 font-medium ${className || ''}`}
        >
          <CheckCheck className="h-3 w-3" />
          <span>Delivered</span>
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge
          variant="outline"
          className={`bg-rose-500/10 text-rose-400 border-rose-500/30 gap-1 font-medium ${className || ''}`}
        >
          <XCircle className="h-3 w-3" />
          <span>Cancelled</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={className}>
          {status}
        </Badge>
      );
  }
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  className?: string;
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  switch (status) {
    case 'paid':
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 font-semibold ${className || ''}`}
        >
          <CheckCircle2 className="h-3 w-3" />
          <span>PAID</span>
        </Badge>
      );
    case 'pending':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 font-medium ${className || ''}`}
        >
          <Clock className="h-3 w-3" />
          <span>PENDING</span>
        </Badge>
      );
    case 'failed':
      return (
        <Badge
          variant="outline"
          className={`bg-red-500/15 text-red-400 border-red-500/30 gap-1 font-medium ${className || ''}`}
        >
          <AlertCircle className="h-3 w-3" />
          <span>FAILED</span>
        </Badge>
      );
    case 'refunded':
      return (
        <Badge
          variant="outline"
          className={`bg-purple-500/15 text-purple-400 border-purple-500/30 gap-1 font-medium ${className || ''}`}
        >
          <RotateCcw className="h-3 w-3" />
          <span>REFUNDED</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={className}>
          {status}
        </Badge>
      );
  }
}

interface PaymentMethodBadgeProps {
  method: PaymentMethod | string;
  className?: string;
}

/**
 * Crystal-clear badge distinguishing PREPAID (Razorpay / Online) vs COD (Cash on Delivery).
 */
export function PaymentMethodBadge({ method, className }: PaymentMethodBadgeProps) {
  const isPrepaid = method === 'razorpay' || method === 'prepaid' || method === 'upi';

  if (isPrepaid) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm ${className || ''}`}
      >
        <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
        <span>PREPAID (Razorpay)</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm ${className || ''}`}
    >
      <Banknote className="h-3.5 w-3.5 text-amber-400" />
      <span>COD (Cash on Delivery)</span>
    </span>
  );
}
