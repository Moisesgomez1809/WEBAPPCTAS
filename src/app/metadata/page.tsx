import DatabaseGuard from '../database-guard';
import MetadataClient from './metadata-client';

export default function MetadataPage() {
  return (
    <DatabaseGuard>
      <MetadataClient />
    </DatabaseGuard>
  );
}
