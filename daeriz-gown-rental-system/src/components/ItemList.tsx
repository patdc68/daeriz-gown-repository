import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import {
  DataGrid,
  type GridColDef,
  GridActionsCellItem,
  gridClasses,
} from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import PageContainer from './PageContainer';
import { getItemsWithBranch } from '../services/getItems';
import type { Item } from '../data/ItemType';
import useNotifications from '../hooks/useNotifications/useNotifications';
import { useDialogs } from '../hooks/useDialogs/useDialogs';
import { supabase } from '../services/supabase';
import { useOutletContext } from 'react-router-dom';
import { ImagePreviewDialog, ImageThumbnail } from './ImagePreview';


interface DashboardUser {
  user: { name: string; role: string } | null;
}

export default function ItemList() {
  const { user } = useOutletContext<DashboardUser>();
  console.log('Logged in user:', user);

  const navigate = useNavigate();

  const dialogs = useDialogs();
  const notifications = useNotifications();


  const [rowsState, setRowsState] = React.useState<{ rows: Item[]; rowCount: number }>({
    rows: [],
    rowCount: 0,
  });

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const [selectedImage, setSelectedImage] = React.useState<{ url: string; alt: string } | null>(null);

  const loadData = React.useCallback(async () => {
  setIsLoading(true);
  setError(null);

  try {
    const data = await getItemsWithBranch();

    // Filter out undefined/null rows
    const filtered = data.filter((x): x is Item => !!x);

    // 🔥 Transform here (add branchName)
    const transformed = filtered.map((item) => ({
      ...item,
      branchName: item.branch?.name || 'N/A',
    }));

    setRowsState({
      rows: transformed,
      rowCount: transformed.length,
    });

  } catch (err) {
    setError(err as Error);
  }

  setIsLoading(false);
}, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    if (!isLoading) loadData();
  };

  const handleCreateClick = () => {
    navigate('/item/new');
  };

  const handleRowDelete = (row: Item) => async () => {
    const confirmed = await dialogs.confirm(
      `Do you want to delete ${row.item_name}?`,
      {
        title: 'Delete item?',
        severity: 'error',
        okText: 'Delete',
        cancelText: 'Cancel',
      }
    );

    if (!confirmed) return;

    setIsLoading(true);

    try {
      // 1️ Delete image from storage if exists
      if (row.image_url) {
        // extract file path from URL
        const filePath = row.image_url.split('/storage/v1/object/public/item-images/')[1];
        if (filePath) {
          const { error: storageError } = await supabase.storage
            .from('item-images')
            .remove([filePath]);

          if (storageError) {
            console.warn('Failed to delete image from storage:', storageError.message);
            // optional: you can continue even if image deletion fails
          }
        }
      }

      // Delete row from DB
      const { error } = await supabase
        .from('DBLG_ITEMS')
        .delete()
        .eq('id', row.id);

      if (error) throw error;

      notifications.show('Item deleted successfully.', { severity: 'success' });

      // refresh data
      loadData();
    } catch (err) {
      notifications.show(
        `Failed to delete item: ${(err as Error).message}`,
        { severity: 'error' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImagePreview = (url: string, alt: string) => {
    setSelectedImage({ url, alt });
  };

  const columns: GridColDef<Item>[] = [
    {
      field: 'image_url',
      headerName: 'Image',
      width: 120,
      renderCell: (params) =>
        <ImageThumbnail
          src={params.row?.image_url}
          alt={params.row?.item_name ?? 'Stock item'}
          fallback="No image"
          onPreview={handleImagePreview}
          size={40}
          variant="avatar"
        />,
    },
    { field: 'item_name', headerName: 'Item Name', width: 180 },

    {
      field: 'created_at',
      headerName: 'Created At',
      width: 180,
      renderCell: (params) => <span>{params.row.created_at?.split('T')[0] || 'N/A'}</span>,
    },

    {
      field: 'branchName',
      headerName: 'Branch',
      width: 200,
      
      filterable: true,

    },
    { field: 'category', headerName: 'Category', width: 150 },
    { field: 'total_qty', headerName: 'Total Qty', width: 120 },
    { field: 'avail_qty', headerName: 'Available Qty', width: 140 },
    { field: 'size', headerName: 'Size', width: 120 },
    {
      field: 'actions',
      type: 'actions',
      width: 120,
      getActions: (params) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label="Edit"
          onClick={() => navigate(`/itemEdit/${params.row.id}`)}
          disabled={user?.role === 'staff'}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete"
          onClick={handleRowDelete(params.row)}
          disabled={user?.role === 'staff'}
        />,
      ],
    },
  ];

  const pageTitle = 'Stocks';

  return (
    <PageContainer
      title={pageTitle}
      breadcrumbs={[{ title: pageTitle }]}
      actions={
        <Stack direction="row" alignItems="center" spacing={1}>
          <Tooltip title="Reload data">
            <IconButton size="small" onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateClick}>
            Create
          </Button>
        </Stack>
      }
    >
      <Box sx={{ flex: 1, width: '100%' }}>
        {error ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <DataGrid<Item>
            rows={rowsState.rows}
            rowCount={rowsState.rowCount}
            columns={columns}
            getRowId={(row) => row.id}
            pageSizeOptions={[5, 10, 25]}       // options user can select
            paginationMode="client"              // client-side pagination
            sortingMode="client"                 // client-side sorting
            filterMode='client'
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10, page: 0 }, // 10 rows per page
              },
            }}
            sx={{
              [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: {
                outline: 'transparent',
              },
              [`& .${gridClasses.row}:hover`]: {
                cursor: 'pointer',
              },
            }}
          />
        )}

        <ImagePreviewDialog
          imageUrl={selectedImage?.url ?? null}
          alt={selectedImage?.alt ?? 'Stock item'}
          title="Stock image preview"
          onClose={() => setSelectedImage(null)}
        />
      </Box>
    </PageContainer>
  );
}