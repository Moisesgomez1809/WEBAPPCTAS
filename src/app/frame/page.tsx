import DatabaseGuard from '../database-guard';
import FrameClient from './frame-client';

export default function FramePage() {
  return (
    <DatabaseGuard>
      <FrameClient />
    </DatabaseGuard>
  );
}
