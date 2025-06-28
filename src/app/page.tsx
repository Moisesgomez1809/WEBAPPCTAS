import DatabaseGuard from './database-guard';
import ActaFusionClient from './acta-fusion-client';

export default function Home() {
  return (
    <DatabaseGuard>
      <ActaFusionClient />
    </DatabaseGuard>
  );
}
