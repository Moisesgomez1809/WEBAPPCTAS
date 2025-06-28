import DatabaseGuard from '../database-guard';
import FolioClient from './folio-client';

export default function FolioPage() {
  return (
    <DatabaseGuard>
      <FolioClient />
    </DatabaseGuard>
  );
}
