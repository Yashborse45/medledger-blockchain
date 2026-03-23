import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Navbar renders the top navigation bar with app branding,
 * logged-in user info, and a logout button.
 */
const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const dashboardPath = user?.role ? `/${user.role}` : '/login';
  const showWalletActions = user?.role === 'doctor' || user?.role === 'patient';

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">MedLedger</div>
      {user && (
        <div className="navbar-user">
          <span className="navbar-name">{user.name}</span>
          <span className="navbar-role badge">{user.role}</span>
          <button
            className={`btn btn-ghost btn-sm ${isActive(dashboardPath) ? 'btn-ghost-active' : ''}`}
            onClick={() => navigate(dashboardPath)}
          >
            Dashboard
          </button>
          <button
            className={`btn btn-ghost btn-sm ${isActive('/profile') ? 'btn-ghost-active' : ''}`}
            onClick={() => navigate('/profile')}
          >
            Profile
          </button>
          {showWalletActions && (
            <button
              className={`btn btn-ghost btn-sm ${isActive('/wallet') ? 'btn-ghost-active' : ''}`}
              onClick={() => navigate('/wallet')}
            >
              Wallet
            </button>
          )}
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
