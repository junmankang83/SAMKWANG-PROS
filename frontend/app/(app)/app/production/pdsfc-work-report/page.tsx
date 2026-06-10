import { PdsfcWorkReportInquiry } from '@/components/PdsfcWorkReportInquiry';

export default function PdsfcWorkReportPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold text-app-text">작업실적조회</h1>
      <p className="text-sm text-app-muted">
        ERP <code className="rounded bg-app-muted/20 px-1">dbo._TPDSFCWorkReport</code> 단일 테이블 조회입니다. 실적일자·품목·수량·
        작업시간 등 컬럼은 스키마에서 자동 매칭합니다. 기본 조회 구간은 <strong className="text-app-text">2024-06-02</strong> ~{' '}
        <strong className="text-app-text">2024-06-09</strong> 입니다.
      </p>
      <PdsfcWorkReportInquiry />
    </div>
  );
}
