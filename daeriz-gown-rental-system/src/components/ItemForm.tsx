import * as React from 'react';
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router';
import Typography from '@mui/material/Typography';

export interface ItemFormState {
  values: {
    item_name?: string;
    branch_id?: string;
    category?: string;
    total_qty?: number;
    avail_qty?: number;
    size?: string;
    image_file?: File | null;
    image_url?: string;
  };
  errors: Partial<Record<string, string>>;
}

export type FormFieldValue =
  | string
  | number
  | boolean
  | File
  | null;

interface Props {
  formState: ItemFormState;
  branches: { id: string; name: string }[];
  onFieldChange: (
    name: keyof ItemFormState['values'],
    value: FormFieldValue,
  ) => void;
  onSubmit: () => Promise<void>;
  submitButtonLabel: string;
  backButtonPath: string;
}

export default function ItemForm({
  formState,
  branches,
  onFieldChange,
  onSubmit,
  submitButtonLabel,
}: Props) {
  const navigate = useNavigate();
  const { values } = formState;

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);

  const handleTextChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    onFieldChange(e.target.name as any, e.target.value);
  };

  const handleNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    onFieldChange(e.target.name as any, Number(e.target.value));
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];

      onFieldChange('image_file', file);

      setSelectedFileName(file.name);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  return (
    <Box component="form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>

      <Grid container spacing={2}>

        {/* Item Name */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            name="item_name"
            label="Item Name"
            value={values.item_name ?? ''}
            onChange={handleTextChange}
            fullWidth
          />
        </Grid>

        {/* Category */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            name="category"
            label="Category"
            value={values.category ?? ''}
            onChange={handleTextChange}
            fullWidth
          >
            <MenuItem value="Suit">Suit</MenuItem>
            <MenuItem value="Gown">Gown</MenuItem>
            <MenuItem value="Accessories">Accessories</MenuItem>
          </TextField>
        </Grid>

        {/* Branch Dropdown */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControl fullWidth>
            <InputLabel>Branch</InputLabel>
            <Select
              name="branch_id"
              value={values.branch_id ?? ''}
              label="Branch"
              onChange={(e) =>
                onFieldChange('branch_id', e.target.value)
              }
            >
              {branches.map((branch) => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText />
          </FormControl>
        </Grid>

        {/* Size */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            name="size"
            label="Size"
            value={values.size ?? ''}
            onChange={handleTextChange}
            fullWidth
          />
        </Grid>

        {/* Total Qty */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            type="number"
            name="total_qty"
            label="Total Quantity"
            value={values.total_qty ?? ''}
            onChange={handleNumberChange}
            fullWidth
          />
        </Grid>

        {/* Available Qty */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            type="number"
            name="avail_qty"
            label="Available Quantity"
            value={values.avail_qty ?? ''}
            onChange={handleNumberChange}
            fullWidth
          />
        </Grid>

        {/* Image Upload */}
        <Grid size={{ xs: 12 }}>
          <Button variant="outlined" component="label">
            Upload Image
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </Button>
          {selectedFileName && (
            <Typography color="success.main" sx={{ mt: 1 }}>
              {selectedFileName} selected successfully
              {previewUrl && (
                <Box mt={2}>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{
                      maxWidth: 200,
                      borderRadius: 12,
                      border: '1px solid #ddd',
                    }}
                  />
                </Box>
              )}
            </Typography>
          )}

        </Grid>
      </Grid>

      <Stack direction="row" spacing={2} mt={3} justifyContent="space-between">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/itemList')}
        >
          Back
        </Button>

        <Button type="submit" variant="contained">
          {submitButtonLabel}
        </Button>
      </Stack>
    </Box>
  );
}