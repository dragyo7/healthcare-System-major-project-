import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Doctors from "./pages/Doctors";
import Appointments from "./pages/Appointments";

function App() {
  const [token, setToken] = useState(localStorage.getItem("receptionist_token"));
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("Dashboard");

  useEffect(() => {
    const storedUser = localStorage.getItem("receptionist_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        setUser(null);
      }
    }
  }, [token]);

  const handleLoginSuccess = (receptionistUser) => {
    setToken(localStorage.getItem("receptionist_token"));
    setUser(receptionistUser);
    setActivePage("Dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("receptionist_token");
    localStorage.removeItem("receptionist_user");
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const renderPage = () => {
    switch (activePage) {
      case "Patients":
        return <Patients />;
      case "Doctors":
        return <Doctors />;
      case "Appointments":
        return <Appointments />;
      case "Dashboard":
      default:
        return <Dashboard setActivePage={setActivePage} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        user={user}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>{activePage}</h2>
            <p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>
              Receptionist Administrative Desk (Express Port 5000)
            </p>
          </div>

          <div className="user-profile" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span>👤</span>
            <div>
              <span style={{ fontWeight: "600", fontSize: "14px" }}>{user?.name || "Pooja Verma"}</span>
              <small style={{ display: "block", color: "#64748b", fontSize: "12px" }}>Front Desk Staff</small>
            </div>
          </div>
        </header>

        <div className="page-content" style={{ padding: "24px" }}>
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
