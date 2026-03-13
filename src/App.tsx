import React, { useState } from 'react';
import Layout from './components/Layout';
import Picks from './pages/Picks';
import Analysis from './pages/Analysis';
import History from './pages/History';
import Profile from './pages/Profile';

export default function App() {
  const [activeTab, setActiveTab] = useState('picks');

  const renderContent = () => {
    switch (activeTab) {
      case 'picks':
        return <Picks />;
      case 'analysis':
        return <Analysis />;
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
