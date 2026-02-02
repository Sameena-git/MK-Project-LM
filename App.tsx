import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LeadDetail } from './pages/LeadDetail';
import { DatabaseView } from './pages/DatabaseView';
import { SearchProvider } from './contexts/SearchContext';
import { AuthProvider } from './contexts/AuthContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
        <SearchProvider>
        <HashRouter>
            <Layout>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/lead/:id" element={<LeadDetail />} />
                <Route path="/admin/db" element={<DatabaseView />} />
            </Routes>
            </Layout>
        </HashRouter>
        </SearchProvider>
    </AuthProvider>
  );
};

export default App;