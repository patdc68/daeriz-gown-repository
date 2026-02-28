import React from 'react';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import {
  Button,
  MenuItem,
  Select,
  Box,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getActiveRentals, updateRentalStatus } from '../services/RentalService';

export default function RentalsPage() {
  const [rows, setRows] = React.useState<any[]>([]);
  const navigate = useNavigate();

  const loadData = async () => {
    const data = await getActiveRentals();

    const transformed = data.map((r: any) => ({
      ...r,
      itemName: r.item?.item_name ?? 'N/A',
      branchName: r.branch?.name ?? 'N/A'
    }));

    setRows(transformed);
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (row: any, value: string) => {
    await updateRentalStatus(row, value);
    loadData();
  };

  const columns: GridColDef[] = [
    { field: 'itemName', headerName: 'Item', width: 160 },
    { field: 'branchName', headerName: 'Branch', width: 140 },
    { field: 'renter_name', headerName: 'Renter', width: 160 },
    { field: 'renter_contact_no', headerName: 'Contact', width: 150 },
    { field: 'date_rented', headerName: 'Date Rented', width: 130 },
    { field: 'date_returned', headerName: 'Supposed Return', width: 150 },
    {
      field: 'status',
      headerName: 'Status',
      width: 180,
      renderCell: (params) => (
        <Select
          size="small"
          value={params.row.status}
          onChange={(e) =>
            handleStatusChange(params.row, e.target.value)
          }
        >
          <MenuItem value="Renting">Renting</MenuItem>
          <MenuItem value="In Laundry">In Laundry</MenuItem>
          <MenuItem value="Completed">Completed</MenuItem>
        </Select>
      )
    }
  ];

  return (
    <Box p={3}>
      <Typography variant="h5" mb={2}>
        Active Rentals
      </Typography>

      <Button
        variant="contained"
        onClick={() => navigate('/rentals/create')}
        sx={{ mb: 2 }}
      >
        Create Rental
      </Button>

      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        pageSizeOptions={[10]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10, page: 0 } }
        }}
        autoHeight
      />
    </Box>
  );
}