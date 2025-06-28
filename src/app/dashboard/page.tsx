import DatabaseGuard from '../database-guard';
import DashboardClient from './dashboard-client';

export default function DashboardPage() {
  return (
    <DatabaseGuard>
      <DashboardClient />
    </DatabaseGuard>
  );
}
