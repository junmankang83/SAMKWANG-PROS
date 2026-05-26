/**
 * 기준정보관리 MoldCodeGroup의 `code` **또는** `name`이 이 문자열과 같으면
 * 점검항목관리에서 설비구분·설비유형 상위 그룹으로 인식합니다.
 */
export const MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION = '설비구분' as const;
export const MOLD_PARENT_CODE_GROUP_EQUIPMENT_TYPE = '설비유형' as const;

/** 기준정보 상위 그룹(코드 또는 명이 일치) — 점검항목관리「점검구분」드롭다운 옵션의 하위 코드 출처 */
export const MOLD_PARENT_CODE_GROUP_INSPECTION_DIVISION = '점검구분' as const;

/** 상위 그룹이 위 키(코드/명)와 일치하는지 (공백 trim) */
export function moldParentGroupMatchesKey(group: { code: string; name: string }, key: string): boolean {
  const k = key.trim();
  return group.code.trim() === k || group.name.trim() === k;
}