import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PipelinePage from './pages/PipelinePage';
import CustomersPage from './pages/CustomersPage';
import KRADashboard from './pages/KRADashboard';
import InquiriesPage from './pages/InquiriesPage';
import ReportsPage from './pages/ReportsPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PipelinePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/kra" element={<KRADashboard />} />
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
