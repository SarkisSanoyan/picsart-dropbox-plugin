import React from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AuthGuard } from '../router/AuthGuard'
import { Layout } from '../Layout'
import { SmartRedirect } from '../components/SmartRedirect'
import { LoginPage } from '../pages/LoginPage'
import { SelectionPage } from '../pages/SelectionPage'
import { ProcessingPage } from '../pages/ProcessingPage'
import { ResultsPage } from '../pages/ResultsPage'
import { OAuthCallbackPage } from '../pages/OAuthCallbackPage'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/auth',
    element: <OAuthCallbackPage />
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <Layout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <SmartRedirect />
      },
      {
        path: 'select',
        element: <SelectionPage />
      },
      {
        path: 'process',
        element: <ProcessingPage />
      },
      {
        path: 'process/:fileId',
        element: <ProcessingPage />
      },
      {
        path: 'results',
        element: <ResultsPage />
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/select" replace />
  }
])

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />
}