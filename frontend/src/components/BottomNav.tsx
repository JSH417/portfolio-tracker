import { NavLink } from 'react-router-dom';
import { Home, BarChart2, RefreshCw } from 'lucide-react';

const tabs = [
  { to: '/', icon: Home, label: '대시보드' },
  { to: '/holdings', icon: BarChart2, label: '보유자산' },
  { to: '/rebalance', icon: RefreshCw, label: '리밸런싱' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-md mx-auto flex">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={22}
                  className={`mb-0.5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
