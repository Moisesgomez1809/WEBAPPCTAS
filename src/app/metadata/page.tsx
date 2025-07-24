import AuthGuard from '@/components/auth-guard';
import DatabaseGuard from '../database-guard';
import MetadataClient from './metadata-client';

export default function MetadataPage() {
  return (
    <AuthGuard>
      <DatabaseGuard>
        <MetadataClient />
      </DatabaseGuard>
    </AuthGuard>
  );
}
