function Sidebar({ activePage, setActivePage, user, onLogout }) {
  const menuItems = [
    { name: "Dashboard", icon: "🏠" },
    { name: "Patients", icon: "👤" },
    { name: "Doctors", icon: "👨‍⚕️" },
    { name: "Appointments", icon: "📅" }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-icon">✚</div>
        <div>
          <h2>HealthCare</h2>
          <span>Front Desk</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.name}
            id={`nav-${item.name.toLowerCase()}`}
            className={
              activePage === item.name
                ? "sidebar-item active"
                : "sidebar-item"
            }
            onClick={() => setActivePage(item.name)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="user-avatar">👤</div>
          <div>
            <strong>{user?.name || "Pooja Verma"}</strong>
            <small style={{ display: "block", color: "#94a3b8" }}>Receptionist Staff</small>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: "rgba(239, 68, 68, 0.2)",
            color: "#fca5a5",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: "6px",
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "500",
            width: "100%",
            textAlign: "center"
          }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
