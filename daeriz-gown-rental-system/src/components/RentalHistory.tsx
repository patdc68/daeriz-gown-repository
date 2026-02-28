import React from 'react';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Box, Typography } from '@mui/material';
import { getCompletedRentals } from '../services/RentalService';

export default function RentalHistory() {
  const [rows, setRows] = React.useState<any[]>([]);

  const loadData = async () => {
    const data = await getCompletedRentals();

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

  const columns: GridColDef[] = [
    { field: 'itemName', headerName: 'Item', width: 160 },
    { field: 'branchName', headerName: 'Branch', width: 140 },
    { field: 'renter_name', headerName: 'Renter', width: 160 },
    { field: 'date_rented', headerName: 'Date Rented', width: 130 },
    { field: 'date_returned', headerName: 'Supposed Return', width: 150 },
    { field: 'actual_returned_date', headerName: 'Actual Return', width: 170 }
  ];

  return (
    <Box p={3}>
      <Typography variant="h5" mb={2}>
        Rental History
      </Typography>

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