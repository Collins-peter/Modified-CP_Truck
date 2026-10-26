import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './DashboardLayout.module.css';
import cp_logo from '../../assets/CP_Truck Logo.png';
import { getNavIcon, LogoutIcon } from './SidebarIcons';

// Shared shell for all three  (customer/admin/rider).
// Each role passes its own nav items, so this one component handles
// the sidebar, active-link highlighting, topbar, and logout for all of them.
//
// Usage:
// <DashboardLayout navItems={[{ label: 'Overview', path: '/customer/dashboard' }, ...]}>
//   <PageContent />
// </DashboardLayout>
const DashboardLayout = ({ navItems = [], children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div>CP <span>Truck</span></div>
          <img src={cp_logo} alt="cp-logo" />
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`${styles.navItem} ${
                  isActive ? styles.navItemActive : ''
                }`}
              >
                <span className={styles.navIcon}>{getNavIcon(item)}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          title="Log Out"
        >
          <span className={styles.navIcon}>
            <LogoutIcon />
          </span>
          <span className={styles.logoutLabel}>Log Out</span>
        </button>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.role}>{user?.role}</p>
            <p className={styles.name}>{user?.full_name}</p>
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
};

export default DashboardLayout;
