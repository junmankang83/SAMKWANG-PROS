import { TslSalesDailyAnalysisInquiry } from '@/components/TslSalesDailyAnalysisInquiry';

export default function TslSalesDailyAnalysisPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold text-app-text">일자별판매실적분석</h1>
      <p className="text-sm text-app-muted">
        ERP `_TSLInvoiceItem`·`_TSLSalesItem`·`_TSLBillItem` 조인. 업체일자(거래명세 일자) 구간으로 조회합니다. 기본
        기간은 이번 달 1일부터 오늘까지입니다.
      </p>
      <TslSalesDailyAnalysisInquiry />
    </div>
  );
}
