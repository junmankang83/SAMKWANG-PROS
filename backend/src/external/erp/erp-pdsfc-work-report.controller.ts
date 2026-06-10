import { Controller, Get, Query } from '@nestjs/common';
import { PdsfcWorkReportQueryDto } from './dto/pdsfc-work-report.query.dto';
import { ErpPdsfcWorkReportService } from './erp-pdsfc-work-report.service';

/** 작업실적조회 — `dbo._TPDSFCWorkReport` */
@Controller('erp/pdsfc-work-report')
export class ErpPdsfcWorkReportController {
  constructor(private readonly workReport: ErpPdsfcWorkReportService) {}

  @Get()
  list(@Query() query: PdsfcWorkReportQueryDto) {
    return this.workReport.listByDateRange(query.from, query.to, query.limit, query.schemaMeta === true);
  }
}
