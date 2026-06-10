import { IsObject } from 'class-validator';

/** 키: `master-data` | `production` | `mold` | `mail`, 값: 표시 여부 */
export class UpdateNavDomainsVisibilityDto {
  @IsObject()
  domains!: Record<string, boolean>;
}
