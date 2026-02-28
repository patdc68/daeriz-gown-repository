import './App.css';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import CrudDashboard from './CrudDashboard';

function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <CrudDashboard />
    </LocalizationProvider>
  );
}

export default App;