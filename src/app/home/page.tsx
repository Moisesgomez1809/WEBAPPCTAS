import AuthGuard from '@/components/auth-guard';
import DatabaseGuard from '../database-guard';
import ActaFusionClient from '../acta-fusion-client';

export default function HomePage() {
  return (
    <AuthGuard>
      <DatabaseGuard>
        <ActaFusionClient />
      </DatabaseGuard>
    </AuthGuard>
  );
}
