import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Picks from './pages/Picks';
import Analysis from './pages/Analysis';
import History from './pages/History';
import Profile from './pages/Profile';

export default function App() {
  const [activeTab, setActiveTab] = useState('picks');
  const [scannerMatchName, setScannerMatchName] = useState<string | null>(null);

  // Listen for navigation from other components to Analysis
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

  // Clear scanner match name when leaving analysis
  useEffect(() => {
    if (activeTab !== 'analysis') {
      setTimeout(() => setScannerMatchName(null), 1000);
    }
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'picks':
        return <Picks />;
      case 'analysis':
        return <Analysis initialMatchName={scannerMatchName} />;
      case 'history':
        return <History />;
      case 'profile':
        return <Profile />;
      default:
        return <Picks />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}
