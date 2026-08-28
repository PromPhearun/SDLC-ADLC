import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import SpecGenerator from "./pages/SpecGenerator";
import OneShotBuilder from "./pages/OneShotBuilder";
import FeatureAdd from "./pages/FeatureAdd";
import BugScanner from "./pages/BugScanner";
import AuditReport from "./pages/AuditReport";
import Notifications from "./pages/Notifications";
import GitHub from "./pages/GitHub";
import Settings from "./pages/Settings";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/specs" element={<SpecGenerator />} />
        <Route path="/build" element={<OneShotBuilder />} />
        <Route path="/features" element={<FeatureAdd />} />
        <Route path="/bugs" element={<BugScanner />} />
        <Route path="/audit" element={<AuditReport />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/github" element={<GitHub />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default App;
