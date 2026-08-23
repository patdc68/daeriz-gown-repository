import * as React from 'react';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Box, Button, Chip, InputAdornment, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import useNotifications from '../hooks/useNotifications/useNotifications';
import {
  getRentalsByStatus,
  RENTAL_STATUS_OPTIONS,
  updateRentalStatus,
  type RentalRecord,
  type RentalStatus,
} from '../services/RentalService';
import { ImagePreviewDialog, ImageThumbnail } from './ImagePreview';
import PageContainer from './PageContainer';

interface RentalListProps {
  status: RentalStatus;
  title: string;
  allowStatusUpdate?: boolean;
  showCreateButton?: boolean;
  showActualReturn?: boolean;
}

const chipColor: Record<RentalStatus, 'primary' | 'warning' | 'secondary' | 'default'> = {
  Renting: 'primary',
  'In Laundry': 'warning',
  'Shop Return': 'secondary',
  Completed: 'default',
};

const formatDate = (value?: string | null, withTime = false) => value
  ? dayjs(value).format(withTime ? 'MMM D, YYYY h:mm A' : 'MMM D, YYYY')
  : '—';

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
  const [search, setSearch] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [updatingRentalId, setUpdatingRentalId] = React.useState<string | null>(null);
  const [selectedImage, setSelectedImage] = React.useState<{ url: string; alt: string; title: string } | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setRows(await getRentalsByStatus(status));
    } catch (error) {
      console.error('Rental list load failed:', error);
      notifications.show('Unable to load rentals.', { severity: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [notifications, status]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = React.useCallback(async (row: RentalRecord, value: RentalStatus) => {
    if (updatingRentalId) return;
    setUpdatingRentalId(row.id);
    try {
      await updateRentalStatus(row, value);
      notifications.show('Rental status updated successfully.', { severity: 'success' });
      await loadData();
    } catch (error) {
      console.error('Rental status update failed:', error);
      notifications.show('Unable to update rental status.', { severity: 'error' });
    } finally {
      setUpdatingRentalId(null);
    }
  }, [loadData, notifications, updatingRentalId]);

  const columns = React.useMemo<GridColDef<RentalRecord>[]>(() => {
    const reportColumns: GridColDef<RentalRecord>[] = [
      {
        field: 'item', headerName: 'Item', minWidth: 230, flex: 1, sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
            <ImageThumbnail src={row.item?.image_url} alt={row.item?.item_name ?? 'Rental item'} fallback="No image" size={42} onPreview={(url, alt) => setSelectedImage({ url, alt, title: 'Item image preview' })} />
            <Box minWidth={0}>
              <Typography variant="body2" fontWeight={600} noWrap>{row.item?.item_name ?? 'Unknown item'}</Typography>
              <Typography variant="caption" color="text.secondary">Size: {row.item?.size || '—'}</Typography>
            </Box>
          </Stack>
        ),
      },
      { field: 'branchName', headerName: 'Branch', minWidth: 130, flex: 0.7, valueGetter: (_value, row) => row.branch?.name ?? '—' },
      {
        field: 'renter', headerName: 'Renter', minWidth: 190, flex: 0.9,
        valueGetter: (_value, row) => `${row.renter_name} ${row.renter_contact_no}`,
        renderCell: ({ row }) => <Box><Typography variant="body2" fontWeight={600}>{row.renter_name}</Typography><Typography variant="caption" color="text.secondary">{row.renter_contact_no}</Typography></Box>,
      },
      {
        field: 'rentalRange', headerName: 'Rental range', minWidth: 210, flex: 0.9,
        valueGetter: (_value, row) => `${row.date_rented} ${row.date_returned}`,
        renderCell: ({ row }) => <Box><Typography variant="body2">{formatDate(row.date_rented)}</Typography><Typography variant="caption" color="text.secondary">to {formatDate(row.date_returned)}</Typography></Box>,
      },
      {
        field: 'receipt_img', headerName: 'Receipt', width: 84, sortable: false, filterable: false,
        renderCell: ({ row }) => <ImageThumbnail src={row.receipt_img} alt={`Receipt for ${row.renter_name}`} fallback="No receipt" size={42} onPreview={(url, alt) => setSelectedImage({ url, alt, title: 'Receipt image preview' })} />,
      },
    ];

    if (showActualReturn) reportColumns.push({
      field: 'actual_returned_date', headerName: 'Actual return', minWidth: 190,
      valueFormatter: (value) => formatDate(value, true),
    });

    reportColumns.push({
      field: 'status', headerName: 'Status', minWidth: allowStatusUpdate ? 180 : 130,
      renderCell: ({ row }) => allowStatusUpdate ? (
        <Select size="small" value={row.status} disabled={updatingRentalId === row.id} onChange={(event) => handleStatusChange(row, event.target.value as RentalStatus)} aria-label={`Status for ${row.renter_name}`}>
          {RENTAL_STATUS_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
        </Select>
      ) : <Chip size="small" label={row.status} color={chipColor[row.status]} variant={row.status === 'Completed' ? 'outlined' : 'filled'} />,
    });
    return reportColumns;
  }, [allowStatusUpdate, handleStatusChange, showActualReturn, updatingRentalId]);

  const visibleRows = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return rows;
    return rows.filter((row) => [row.renter_name, row.renter_contact_no, row.item?.item_name, row.item?.size, row.branch?.name]
      .some((value) => value?.toLocaleLowerCase().includes(query)));
  }, [rows, search]);

  return (
    <PageContainer
      title={title}
      breadcrumbs={[{ title: 'Rentals' }, { title }]}
      actions={showCreateButton ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/rentals/create')}>Create Rental</Button> : undefined}
    >
      <Stack spacing={2} minWidth={0}>
        <TextField
          size="small" label="Search rentals" value={search} onChange={(event) => setSearch(event.target.value)}
          sx={{ maxWidth: 360 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
        />
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <DataGrid
            rows={visibleRows}
            columns={columns}
            loading={isLoading}
            getRowId={(row) => row.id}
            getRowHeight={() => 64}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
            autoHeight
            disableRowSelectionOnClick
            localeText={{ noRowsLabel: search ? 'No rentals match your search.' : `No ${status.toLowerCase()} rentals.` }}
            sx={{ minWidth: 920 }}
          />
        </Box>
      </Stack>
      <ImagePreviewDialog imageUrl={selectedImage?.url ?? null} alt={selectedImage?.alt ?? 'Rental image'} title={selectedImage?.title} onClose={() => setSelectedImage(null)} />
    </PageContainer>
  );
}
