import { NavLink } from 'react-router-dom';

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">S7</div>
          <div>
            SuretySeven
            <div style={{ fontSize: 12, fontWeight: 400, color: '#bcccdc' }}>
              Document Processing
            </div>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/upload">Upload</NavLink>
          <NavLink to="/documents">Documents</NavLink>
        </nav>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
