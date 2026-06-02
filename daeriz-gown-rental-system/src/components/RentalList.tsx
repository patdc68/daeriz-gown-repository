import * as React from 'react';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useNotifications from '../hooks/useNotifications/useNotifications';
import {
  getRentalsByStatus,
  RENTAL_STATUS_OPTIONS,
  updateRentalStatus,
  type RentalRecord,
  type RentalStatus,
} from '../services/RentalService';

interface RentalListProps {
  status: RentalStatus;
  title: string;
  allowStatusUpdate?: boolean;
  showCreateButton?: boolean;
  showActualReturn?: boolean;
}

function Thumbnail({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) {
    return (
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 1,
          bgcolor: 'action.hover',
          color: 'text.secondary',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          textAlign: 'center',
        }}
      >
        No image
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      sx={{ width: 48, height: 48, borderRadius: 1, objectFit: 'cover' }}
    />
  );
}

export default function RentalList({
  status,
  title,
  allowStatusUpdate = true,
  showCreateButton = false,
  showActualReturn = false,
}: RentalListProps) {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [rows, setRows] = React.useState<RentalRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [updatingRentalId, setUpdatingRentalId] = React.useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setRows(await getRentalsByStatus(status));
    } catch (error) {
      notifications.show(`Failed to load rentals: ${(error as Error).message}`, {
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [notifications, status]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = React.useCallback(async (row: RentalRecord, value: RentalStatus) => {
    setUpdatingRentalId(row.id);
    try {
      await updateRentalStatus(row, value);
      notifications.show('Rental status updated successfully.', { severity: 'success' });
      await loadData();
    } catch (error) {
      notifications.show(`Failed to update rental: ${(error as Error).message}`, {
        severity: 'error',
      });
    } finally {
      setUpdatingRentalId(null);
    }
  }, [loadData, notifications]);

  const columns = React.useMemo<GridColDef<RentalRecord>[]>(() => {
    const reportColumns: GridColDef<RentalRecord>[] = [
      {
        field: 'itemImage',
        headerName: 'Image',
        width: 76,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => <Thumbnail src={row.item?.image_url} alt={row.item?.item_name ?? 'Rental item'} />,
      },
      {
        field: 'itemName',
        headerName: 'Item',
        width: 160,
        valueGetter: (_value, row) => row.item?.item_name ?? 'N/A',
      },
      {
        field: 'branchName',
        headerName: 'Branch',
        width: 140,
        valueGetter: (_value, row) => row.branch?.name ?? 'N/A',
      },
      { field: 'renter_name', headerName: 'Renter', width: 160 },
      { field: 'renter_contact_no', headerName: 'Contact', width: 150 },
      { field: 'date_rented', headerName: 'Date Rented', width: 130 },
      { field: 'date_returned', headerName: 'Supposed Return', width: 150 },
      {
        field: 'receipt_img',
        headerName: 'Receipt',
        width: 92,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => row.receipt_img ? (
          <Button
            onClick={() => setReceiptPreview(row.receipt_img ?? null)}
            sx={{ minWidth: 0, p: 0.5 }}
            aria-label={`Preview receipt for ${row.renter_name}`}
          >
            <Thumbnail src={row.receipt_img} alt={`Receipt for ${row.renter_name}`} />
          </Button>
        ) : <Typography variant="caption" color="text.secondary">No receipt</Typography>,
      },
    ];

    if (showActualReturn) {
      reportColumns.push({ field: 'actual_returned_date', headerName: 'Actual Return', width: 170 });
    }

    if (allowStatusUpdate) {
      reportColumns.push({
        field: 'status',
        headerName: 'Status',
        width: 180,
        renderCell: ({ row }) => (
          <Select
            size="small"
            value={row.status}
            disabled={updatingRentalId === row.id}
            onChange={(event) => handleStatusChange(row, event.target.value as RentalStatus)}
          >
            {RENTAL_STATUS_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>{option}</MenuItem>
            ))}
          </Select>
        ),
      });
    }

    return reportColumns;
  }, [allowStatusUpdate, handleStatusChange, showActualReturn, updatingRentalId]);

  return (
    <Box p={3}>
      <Typography variant="h5" mb={2}>{title}</Typography>

      {showCreateButton && (
        <Button variant="contained" onClick={() => navigate('/rentals/create')} sx={{ mb: 2 }}>
          Create Rental
        </Button>
      )}

      <DataGrid
        rows={rows}
        columns={columns}
        loading={isLoading}
        getRowId={(row) => row.id}
        getRowHeight={() => 64}
        pageSizeOptions={[10]}
        initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
        autoHeight
      />

      <Dialog open={Boolean(receiptPreview)} onClose={() => setReceiptPreview(null)} maxWidth="md">
        <DialogTitle>Receipt Image</DialogTitle>
        <DialogContent>
          {receiptPreview && (
            <Box
              component="img"
              src={receiptPreview}
              alt="Rental receipt preview"
              sx={{ display: 'block', maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
