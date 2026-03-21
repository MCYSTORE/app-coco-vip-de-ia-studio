import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Picks from './pages/Picks';
import Analysis from './pages/Analysis';
import History from './pages/History';
import Profile from './pages/Profile';
import { AuthProvider } from './contexts/AuthContext';
import AuthWrapper from './screens/AuthWrapper';

function AppContent() {
  const [activeTab, setActiveTab] = useState('picks');
  const [scannerMatchName, setScannerMatchName] = useState<string | null>(null);

  useEffect(() => {
    const handleNavigateToAnalysis = (e: CustomEvent) => {
      setScannerMatchName(e.detail);
      setActiveTab('analysis');
    };

    window.addEventListener('navigateToAnalysis', handleNavigateToAnalysis as EventListener);
    return () => {
      window.removeEventListener('navigateToAnalysis', handleNavigateToAnalysis as EventListener);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'analysis') {
      setTimeout(() => setScannerMatchName(null), 1000);
    }
  }, [activeTab]);

  const handleNavigate = (tab: string) => setActiveTab(tab);

  const handleAnalyzeMatch = (matchName: string) => {
    if (matchName) setScannerMatchName(matchName);
    setActiveTab('analysis');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'picks':
        return <Picks onNavigate={handleNavigate} onAnalyzeMatch={handleAnalyzeMatch} />;
      case 'analysis':
        return <Analysis initialMatchName={scannerMatchName} />;
      case 'history':
        return <History />;
      case 'profile':
        return <Profile />;
      default:
        return <Picks onNavigate={handleNavigate} onAnalyzeMatch={handleAnalyzeMatch} />;
    }
  };

  return (
    <AuthWrapper>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
    </AuthWrapper>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
