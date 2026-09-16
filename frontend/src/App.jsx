import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import DocumentDetailsPage from './pages/DocumentDetailsPage.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:documentId" element={<DocumentDetailsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
