
import AuthGuard from '@/components/auth-guard';
import DatabaseGuard from '../database-guard';
import BulkFusionClient from './bulk-fusion-client';

export default function BulkFusionPage() {
  return (
    <AuthGuard>
      <DatabaseGuard>
        <BulkFusionClient />
      </DatabaseGuard>
    </AuthGuard>
  );
}

    