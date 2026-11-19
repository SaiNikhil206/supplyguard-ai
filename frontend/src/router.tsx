import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import ExecutiveOverview from '@/pages/ExecutiveOverview';
import SupplierIntelligence from '@/pages/SupplierIntelligence';
import RiskCommandCenter from '@/pages/RiskCommandCenter';
import AiRecommendations from '@/pages/AiRecommendations';
import ApprovalCenter from '@/pages/ApprovalCenter';
import WhatIfSimulator from '@/pages/WhatIfSimulator';
import IntegrationCenter from '@/pages/IntegrationCenter';
import AuditCenter from '@/pages/AuditCenter';
import TenantSettings from '@/pages/TenantSettings';
import NotFound from '@/pages/NotFound';

// TODO(auth subtask): add a public `/login` route here (outside AppShell) and wrap
// the AppShell layout route element in <ProtectedRoute>.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <ExecutiveOverview /> },
      { path: 'suppliers', element: <SupplierIntelligence /> },
      { path: 'risk', element: <RiskCommandCenter /> },
      { path: 'recommendations', element: <AiRecommendations /> },
      { path: 'approvals', element: <ApprovalCenter /> },
      { path: 'what-if', element: <WhatIfSimulator /> },
      { path: 'integrations', element: <IntegrationCenter /> },
      { path: 'audit', element: <AuditCenter /> },
      { path: 'settings', element: <TenantSettings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
