import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Review from "./pages/Review";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
          <NavLink to="/upload" className={({ isActive }) => (isActive ? "active" : "")}>
            Upload
          </NavLink>
        </nav>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/invoice/:id" element={<Review />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
