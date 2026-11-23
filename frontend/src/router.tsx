/* eslint-disable react-refresh/only-export-components -- route table module: lazy page consts are not exported components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { PageSkeleton } from '@/layout/PageSkeleton';
import { ProtectedRoute } from '@/auth/ProtectedRoute';

// Route pages are code-split; AppShell wraps <Outlet/> in a Suspense with a skeleton.
const ExecutiveOverview = lazy(() => import('@/pages/ExecutiveOverview'));
const SupplierIntelligence = lazy(() => import('@/pages/SupplierIntelligence'));
const SupplierDetail = lazy(() => import('@/pages/SupplierDetail'));
const RiskCommandCenter = lazy(() => import('@/pages/RiskCommandCenter'));
const RiskCaseDetail = lazy(() => import('@/pages/RiskCaseDetail'));
const AiRecommendations = lazy(() => import('@/pages/AiRecommendations'));
const ApprovalCenter = lazy(() => import('@/pages/ApprovalCenter'));
const WhatIfSimulator = lazy(() => import('@/pages/WhatIfSimulator'));
const IntegrationCenter = lazy(() => import('@/pages/IntegrationCenter'));
const AuditCenter = lazy(() => import('@/pages/AuditCenter'));
const TenantSettings = lazy(() => import('@/pages/TenantSettings'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Login = lazy(() => import('@/pages/Login'));

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <ExecutiveOverview /> },
      { path: 'suppliers', element: <SupplierIntelligence /> },
      { path: 'suppliers/:id', element: <SupplierDetail /> },
      { path: 'risk', element: <RiskCommandCenter /> },
      { path: 'risk/:id', element: <RiskCaseDetail /> },
      { path: 'recommendations', element: <AiRecommendations /> },
      { path: 'approvals', element: <ApprovalCenter /> },
      { path: 'what-if', element: <WhatIfSimulator /> },
      { path: 'integrations', element: <IntegrationCenter /> },
      { path: 'audit', element: <AuditCenter /> },
      {
        path: 'settings',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <TenantSettings />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
