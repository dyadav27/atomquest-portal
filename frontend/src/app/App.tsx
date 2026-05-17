import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import EmployeeMyGoals from './components/EmployeeMyGoals';
import EmployeeCheckins from './components/EmployeeCheckins';
import ManagerDashboard from './components/ManagerDashboard';
import ManagerApproval from './components/ManagerApproval';
import ManagerCheckinReview from './components/ManagerCheckinReview';
import AdminDashboard from './components/AdminDashboard';
import AdminAuditLog from './components/AdminAuditLog';
import AdminEscalations from './components/AdminEscalations';
import AdminGoalCycles from './components/AdminGoalCycles';
import Analytics from './components/Analytics';
import Reports from './components/Reports';
import AdminUserManagement from './components/AdminUserManagement';
import type { UserRole, Page } from './types';

// Lazy-import the stores to avoid circular deps at module load time
// We call getState() after mount so we don't block the first render
let authStoreModule: any = null;
let cycleStoreModule: any = null;

export default function App() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('my-goals');
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize auth + cycle stores on first mount
  useEffect(() => {
    const init = async () => {
      try {
        // Dynamically import to avoid issues during SSR or fast-refresh
        if (!authStoreModule) authStoreModule = await import('../store/authStore');
        if (!cycleStoreModule) cycleStoreModule = await import('../store/cycleStore');

        const authStore = authStoreModule.default;
        const cycleStore = cycleStoreModule.default;

        await authStore.getState().initialize();
        await cycleStore.getState().fetchActiveCycle();

        // If there is already a Supabase session, restore role
        const existingRole = authStore.getState().role as UserRole | null;
        if (existingRole) {
          setUserRole(existingRole);
          setCurrentPage(
            existingRole === 'employee'
              ? 'my-goals'
              : existingRole === 'manager'
              ? 'team-dashboard'
              : 'admin-overview'
          );
        }
      } catch (err) {
        console.error('[App] Initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, []);

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
    setCurrentPage(
      role === 'employee' ? 'my-goals' : role === 'manager' ? 'team-dashboard' : 'admin-overview'
    );
  };

  const handleLogout = async () => {
    try {
      if (authStoreModule) await authStoreModule.default.getState().logout();
    } catch (_) {}
    setUserRole(null);
    setCurrentPage('my-goals');
  };

  const handlePageChange = (page: Page) => setCurrentPage(page);

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAF9]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1D9E75] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-sm">Loading AtomQuest…</p>
        </div>
      </div>
    );
  }

  if (!userRole) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const commonProps = { onNavigate: handlePageChange, onLogout: handleLogout, userRole };

  return (
    <div className="size-full">
      {currentPage === 'my-goals' && <EmployeeMyGoals {...commonProps} />}
      {currentPage === 'check-ins' && <EmployeeCheckins {...commonProps} />}
      {currentPage === 'team-dashboard' && <ManagerDashboard {...commonProps} />}
      {currentPage === 'approval-queue' && <ManagerApproval {...commonProps} />}
      {currentPage === 'checkin-reviews' && <ManagerCheckinReview {...commonProps} />}
      {currentPage === 'admin-overview' && <AdminDashboard {...commonProps} />}
      {currentPage === 'goal-cycles' && <AdminGoalCycles {...commonProps} />}
      {currentPage === 'users-roles' && <AdminUserManagement {...commonProps} />}
      {currentPage === 'audit-log' && <AdminAuditLog {...commonProps} />}
      {currentPage === 'escalations' && <AdminEscalations {...commonProps} />}
      {currentPage === 'analytics' && <Analytics {...commonProps} />}
      {currentPage === 'reports' && <Reports {...commonProps} />}
    </div>
  );
}