
import AuthGuard from '@/components/auth-guard';
import DatabaseGuard from '../database-guard';
import DevelopOcrClient from './develop-ocr-client';

export default function DevelopOcrPage() {
  return (
    <AuthGuard>
      <DatabaseGuard>
        <DevelopOcrClient />
      </DatabaseGuard>
    </AuthGuard>
  );
}
