import { Target, CheckSquare, BarChart3, FileText, Users, ClipboardCheck, Eye, Settings, Shield, AlertTriangle, LogOut } from 'lucide-react';

type UserRole = 'employee' | 'manager' | 'admin';
type Page = 'my-goals' | 'check-ins' | 'analytics' | 'reports' | 'team-dashboard' | 'approval-queue' | 'checkin-reviews' | 'admin-overview' | 'users-roles' | 'goal-cycles' | 'shared-goals' | 'audit-log' | 'escalations';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { id: 'my-goals', label: 'My Goals', icon: Target, roles: ['employee', 'manager', 'admin'] },
  { id: 'check-ins', label: 'My Check-ins', icon: CheckSquare, roles: ['employee'] },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['employee', 'manager', 'admin'] },
  { id: 'reports', label: 'Reports', icon: FileText, roles: ['employee', 'manager', 'admin'] },
  { id: 'team-dashboard', label: 'Team Dashboard', icon: Users, roles: ['manager'] },
  { id: 'approval-queue', label: 'Approval Queue', icon: ClipboardCheck, roles: ['manager'] },
  { id: 'checkin-reviews', label: 'Check-in Reviews', icon: Eye, roles: ['manager'] },
  { id: 'admin-overview', label: 'Overview', icon: BarChart3, roles: ['admin'] },
  { id: 'users-roles', label: 'Users & Roles', icon: Users, roles: ['admin'] },
  { id: 'goal-cycles', label: 'Goal Cycles', icon: Settings, roles: ['admin'] },
  { id: 'shared-goals', label: 'Shared Goals', icon: Target, roles: ['admin'] },
  { id: 'audit-log', label: 'Audit Log', icon: FileText, roles: ['admin'] },
  { id: 'escalations', label: 'Escalations', icon: AlertTriangle, roles: ['admin'] },
];

import useAuthStore from '../../store/authStore';

interface AppSidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

export default function AppSidebar({
  currentPage,
  onNavigate,
  onLogout,
  userRole
}: AppSidebarProps) {
  const { user } = useAuthStore();
  const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userAvatar = user?.user_metadata?.avatar_url;
  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole));

  const getRoleBadgeColor = () => {
    switch (userRole) {
      case 'employee':
        return 'bg-[#1D9E75] text-white';
      case 'manager':
        return 'bg-blue-600 text-white';
      case 'admin':
        return 'bg-[#7F77DD] text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="w-60 bg-[#111827] text-white flex flex-col h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl">
          Atom<span className="text-[#1D9E75]">Quest</span>
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#1D9E75] text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#1D9E75] flex items-center justify-center text-white font-medium">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(userName)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <span className={`inline-block px-2 py-0.5 rounded text-xs ${getRoleBadgeColor()}`}>
              {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
            </span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-sm"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
