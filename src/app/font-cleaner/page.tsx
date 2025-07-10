import DatabaseGuard from '../database-guard';
import FontCleanerClient from './font-cleaner-client';

export default function FontCleanerPage() {
  return (
    <DatabaseGuard>
      <FontCleanerClient />
    </DatabaseGuard>
  );
}
