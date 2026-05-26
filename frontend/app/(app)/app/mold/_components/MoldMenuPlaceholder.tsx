import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@samkwang/ui-kit';

type MoldMenuPlaceholderProps = {
  title: string;
};

export function MoldMenuPlaceholder({ title }: MoldMenuPlaceholderProps) {
  return (
    <Card className="max-w-2xl shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>추후 모듈이 이 영역에 연결됩니다.</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
