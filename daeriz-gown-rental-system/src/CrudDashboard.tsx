import CssBaseline from '@mui/material/CssBaseline';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ItemList from './components/ItemList';
import ItemEdit from './components/ItemEdit';
import ItemCreate from './components/ItemCreate';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import RentalPage from './components/RentalPage'
import RentalCreate from './components/RentalCreate';
import RentalHistory from './components/RentalHistory';
import FittingPage from './components/Fittingpage';
import NotificationsProvider from './hooks/useNotifications/NotificationsProvider';
import DialogsProvider from './hooks/useDialogs/DialogsProvider';
import AppTheme from './theme/AppTheme';
import {
  dataGridCustomizations,
  datePickersCustomizations,
  sidebarCustomizations,
  formInputCustomizations,
} from './theme/customizations';

const router = createHashRouter([
  // 🔓 LOGIN (no dashboard layout)
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/register',
    Component: Register,
  },

  // 🔐 PROTECTED ROUTES
  {
    Component: ProtectedRoute,
    children: [
      {
        Component: DashboardLayout,
        children: [
          {
            path: '/itemList',
            Component: ItemList,
          },
          {
            path: '/item/new',
            Component: ItemCreate,
          },
          {
            path: '/itemEdit/:id',
            Component: ItemEdit,
          },
          {
            path: '/reports/rentals',
            Component: RentalPage,
          },
          {
            path: '/rentals/create',
            Component: RentalCreate,
          },
          {
            path: '/reports/history',
            Component: RentalHistory,
          },
          {
            path: '/fittings',
            Component: FittingPage,
          },
          {
            path: '*',
            Component: ItemList,
          },
        ],
      },
    ],
  },
]);

const themeComponents = {
  ...dataGridCustomizations,
  ...datePickersCustomizations,
  ...sidebarCustomizations,
  ...formInputCustomizations,
};

export default function CrudDashboard(props: { disableCustomTheme?: boolean }) {
  return (
    <AppTheme {...props} themeComponents={themeComponents}>
      <CssBaseline enableColorScheme />
      <NotificationsProvider>
        <DialogsProvider>
          <RouterProvider router={router} />
        </DialogsProvider>
      </NotificationsProvider>
    </AppTheme>
  );
}