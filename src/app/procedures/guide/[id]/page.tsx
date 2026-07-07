import ProcedureGuidePage from './ProcedureGuidePageClient';

export async function generateStaticParams() {
  return [{ id: 'index' }];
}

export default function ProcedureGuidePageRoute({ params }: { params: Promise<{ id: string }> }) {
  return <ProcedureGuidePage params={params} />;
}
