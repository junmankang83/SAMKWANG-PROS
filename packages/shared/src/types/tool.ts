export interface ToolRow {
  id: string;
  toolSeq: number;
  toolName: string;
  toolNo: string;
  spec: string | null;
  smStatus: number | null;
  smStatusNm: string | null;
  umToolKind: number | null;
  umToolKindName: string | null;
  assetSeq: number | null;
  asstName: string | null;
  asstNo: string | null;
  deptSeq: number | null;
  deptName: string | null;
  empSeq: number | null;
  empName: string | null;
  empid: string | null;
  lastUserName: string | null;
  lastDateTime: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ToolSummary {
  id: string;
  toolSeq: number;
  toolName: string;
  toolNo: string;
}

export interface ToolCreateRequest {
  toolSeq: number;
  toolName: string;
  toolNo: string;
  spec?: string | null;
  smStatus?: number | null;
  smStatusNm?: string | null;
  umToolKind?: number | null;
  umToolKindName?: string | null;
  assetSeq?: number | null;
  asstName?: string | null;
  asstNo?: string | null;
  deptSeq?: number | null;
  deptName?: string | null;
  empSeq?: number | null;
  empName?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ToolUpdateRequest {
  toolName?: string;
  toolNo?: string;
  spec?: string | null;
  smStatus?: number | null;
  smStatusNm?: string | null;
  umToolKind?: number | null;
  umToolKindName?: string | null;
  assetSeq?: number | null;
  asstName?: string | null;
  asstNo?: string | null;
  deptSeq?: number | null;
  deptName?: string | null;
  empSeq?: number | null;
  empName?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

/** ERP KN_View_TPDTool 미리보기 행 (동기화 상태 포함) */
export interface ErpToolRow {
  toolSeq: number;
  toolName: string;
  toolNo: string;
  spec: string | null;
  smStatus: number | null;
  smStatusNm: string | null;
  umToolKind: number | null;
  umToolKindName: string | null;
  assetSeq: number | null;
  asstName: string | null;
  asstNo: string | null;
  deptSeq: number | null;
  deptName: string | null;
  empSeq: number | null;
  empName: string | null;
  empid: string | null;
  lastUserName: string | null;
  lastDateTime: string | null;
  status: 'new' | 'update';
}

export interface ToolsSyncResult {
  total: number;
  inserted: number;
  updated: number;
}
