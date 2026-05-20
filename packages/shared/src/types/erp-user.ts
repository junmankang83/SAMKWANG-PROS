/** ERP KN_View_TCAUser + KN_View_TDAEmp 조회 행 */
export interface ErpUserRow {
  userId: string;
  userSeq: number;
  userName: string;
  empid: string;
  empSeq: number;
  deptName: string | null;
}
