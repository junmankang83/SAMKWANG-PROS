import type { ToolSummary } from './tool';

export interface SparePartMasterRow {
  id: string;
  partCode: string;
  machineBrand: string;
  toolId: string | null;
  tool: ToolSummary | null;
  productName: string;
  spec: string | null;
  unit: string;
  optimalQty: string;
  manufacturer: string | null;
  storageLocation: string | null;
  leadTimeDays: number | null;
  remarks: string | null;
  isActive: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SparePartMasterCreateRequest {
  partCode: string;
  machineBrand?: string;
  toolId?: string | null;
  productName: string;
  spec?: string | null;
  unit?: string;
  optimalQty?: number;
  manufacturer?: string | null;
  storageLocation?: string | null;
  leadTimeDays?: number | null;
  remarks?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface SparePartMasterUpdateRequest {
  machineBrand?: string;
  toolId?: string | null;
  productName?: string;
  spec?: string | null;
  unit?: string;
  optimalQty?: number;
  manufacturer?: string | null;
  storageLocation?: string | null;
  leadTimeDays?: number | null;
  remarks?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}
