import * as React from 'react';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import {
  Box,
  Button,
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
import { ImagePreviewDialog, ImageThumbnail } from './ImagePreview';

interface RentalListProps {
  status: RentalStatus;
  title: string;
  allowStatusUpdate?: boolean;
  showCreateButton?: boolean;
  showActualReturn?: boolean;
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
  const [selectedImage, setSelectedImage] = React.useState<{ url: string; alt: string; title: string } | null>(null);

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
        renderCell: ({ row }) => (
          <ImageThumbnail
            src={row.item?.image_url}
            alt={row.item?.item_name ?? 'Rental item'}
            fallback="No image"
            onPreview={(url, alt) => setSelectedImage({ url, alt, title: 'Item image preview' })}
          />
        ),
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
        renderCell: ({ row }) => (
          <ImageThumbnail
            src={row.receipt_img}
            alt={`receipt for ${row.renter_name}`}
            fallback="No receipt"
            onPreview={(url, alt) => setSelectedImage({ url, alt, title: 'Receipt image preview' })}
          />
        ),
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

      <ImagePreviewDialog
        imageUrl={selectedImage?.url ?? null}
        alt={selectedImage?.alt ?? 'Rental image'}
        title={selectedImage?.title}
        onClose={() => setSelectedImage(null)}
      />
    </Box>
  );
}
