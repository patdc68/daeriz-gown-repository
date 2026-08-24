export const PAYMENT_TYPES = {
  DOWN_PAYMENT: 'Down Payment',
  RENTAL_PAYMENT: 'Rental Payment',
  SECURITY_DEPOSIT: 'Security Deposit',
  PENALTY: 'Penalty',
  REFUND: 'Refund',
} as const;

export type PaymentType = typeof PAYMENT_TYPES[keyof typeof PAYMENT_TYPES];
export const PAYMENT_TYPE_OPTIONS = Object.values(PAYMENT_TYPES);

export const PAYMENT_METHODS = {
  CASH: 'Cash',
  GCASH: 'GCash',
  MAYA: 'Maya',
  BANK_TRANSFER: 'Bank Transfer',
  OTHER: 'Other',
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];
export const PAYMENT_METHOD_OPTIONS = Object.values(PAYMENT_METHODS);

export interface RentalPayment {
  id: string;
  rental_id: string;
  payment_type: PaymentType;
  amount: number;
  payment_method: PaymentMethod;
  reference_no: string | null;
  receipt_img: string | null;
  payment_date: string;
  notes: string | null;
  related_payment_id: string | null;
  processed_by_id: string;
  created_at: string;
}

export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid';

export interface RentalFinancialSummary {
  grossRentalAmount: number;
  discount: number;
  netRentalAmount: number;
  rentalPaid: number;
  rentalBalance: number;
  paymentStatus: PaymentStatus;
  depositRequired: number;
  depositCollected: number;
  depositRefunded: number;
  depositHeld: number;
  depositOutstanding: number;
  penaltiesCollected: number;
  totalRefunds: number;
}

interface FinancialRental {
  rental_amount: number | string | null | undefined;
  discount_amount: number | string | null | undefined;
  security_deposit_amount: number | string | null | undefined;
}

const toAmount = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

export function calculateFinancialSummary(rental: FinancialRental, payments: RentalPayment[]): RentalFinancialSummary {
  const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));
  const grossRentalAmount = toAmount(rental.rental_amount);
  const discount = toAmount(rental.discount_amount);
  const netRentalAmount = Math.max(grossRentalAmount - discount, 0);
  let rentalPaid = 0;
  let depositCollected = 0;
  let depositRefunded = 0;
  let penaltiesCollected = 0;
  let totalRefunds = 0;

  payments.forEach((payment) => {
    const amount = toAmount(payment.amount);
    if (payment.payment_type === PAYMENT_TYPES.DOWN_PAYMENT || payment.payment_type === PAYMENT_TYPES.RENTAL_PAYMENT) rentalPaid += amount;
    if (payment.payment_type === PAYMENT_TYPES.SECURITY_DEPOSIT) depositCollected += amount;
    if (payment.payment_type === PAYMENT_TYPES.PENALTY) penaltiesCollected += amount;
    if (payment.payment_type === PAYMENT_TYPES.REFUND) {
      totalRefunds += amount;
      const originalType = payment.related_payment_id ? paymentsById.get(payment.related_payment_id)?.payment_type : undefined;
      if (originalType === PAYMENT_TYPES.SECURITY_DEPOSIT) depositRefunded += amount;
      if (originalType === PAYMENT_TYPES.DOWN_PAYMENT || originalType === PAYMENT_TYPES.RENTAL_PAYMENT) rentalPaid -= amount;
      if (originalType === PAYMENT_TYPES.PENALTY) penaltiesCollected -= amount;
    }
  });

  rentalPaid = Math.max(rentalPaid, 0);
  const rentalBalance = Math.max(netRentalAmount - rentalPaid, 0);
  const depositRequired = toAmount(rental.security_deposit_amount);
  const depositHeld = Math.max(depositCollected - depositRefunded, 0);
  const paymentStatus: PaymentStatus = rentalBalance <= 0 ? 'Paid' : rentalPaid > 0 ? 'Partially Paid' : 'Unpaid';

  return {
    grossRentalAmount,
    discount,
    netRentalAmount,
    rentalPaid,
    rentalBalance,
    paymentStatus,
    depositRequired,
    depositCollected,
    depositRefunded,
    depositHeld,
    depositOutstanding: Math.max(depositRequired - depositHeld, 0),
    penaltiesCollected: Math.max(penaltiesCollected, 0),
    totalRefunds,
  };
}
