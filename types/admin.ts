export interface AdminPageQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  restaurantId?: string;
  provider?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface AdminPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface AdminFinanceSummary {
  attemptedVolumeTzs: number;
  capturedVolumeTzs: number;
  refundedVolumeTzs: number;

  pendingPayments: number;
  failedPayments: number;

  pendingRefunds: number;
  openDisputes: number;

  calculatedSettlements: number;
  approvedSettlements: number;

  queuedPayouts: number;
  failedPayouts: number;

  settlementGrossTzs: number;
  platformCommissionTzs: number;
  merchantNetPayableTzs: number;
  paidOutTzs: number;
}
