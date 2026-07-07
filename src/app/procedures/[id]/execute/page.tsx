import ExecuteProcedurePage from './ExecuteProcedureClient';

export async function generateStaticParams() {
  return [{ id: 'index' }];
}

export default function ExecuteProcedurePageRoute({ params }: { params: Promise<{ id: string }> }) {
  return <ExecuteProcedurePage params={params} />;
}
