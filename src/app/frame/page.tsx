import AuthGuard from '@/components/auth-guard';
import DatabaseGuard from '../database-guard';
import FrameClient from './frame-client';

export default function FramePage() {
  return (
    <AuthGuard>
      <DatabaseGuard>
        <FrameClient />
      </DatabaseGuard>
    </AuthGuard>
  );
}
