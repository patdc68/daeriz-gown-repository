import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Grid,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { createRental, uploadRentalReceipt, type CreateRentalValues } from '../services/RentalService';

const initialValues: CreateRentalValues = {
    branch_id: '',
    item_rented_id: '',
    date_rented: '',
    date_returned: '',
    renter_name: '',
    renter_contact_no: '',
};

export default function CreateRental() {
    const navigate = useNavigate();
    const [items, setItems] = React.useState<{ id: string; item_name: string }[]>([]);
    const [branches, setBranches] = React.useState<{ id: string; name: string }[]>([]);
    const [values, setValues] = React.useState<CreateRentalValues>(initialValues);
    const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadDropdowns = async () => {
            const { data: itemData, error: itemError } = await supabase
                .from('DBLG_ITEMS')
                .select('id, item_name');
            const { data: branchData, error: branchError } = await supabase
                .from('DBLG_SHOP_BRANCH')
                .select('id, name');

            if (itemError || branchError) {
                setErrorMessage(itemError?.message ?? branchError?.message ?? 'Failed to load form options.');
                return;
            }

            setItems(itemData ?? []);
            setBranches(branchData ?? []);
        };

        loadDropdowns();
    }, []);

    React.useEffect(() => () => {
        if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    }, [receiptPreview]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setValues((previousValues) => ({ ...previousValues, [event.target.name]: event.target.value }));
    };

    const handleReceiptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setErrorMessage(null);

        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setReceiptFile(null);
            setErrorMessage('Receipt image must be an image file.');
            event.target.value = '';
            return;
        }

        setReceiptFile(file);
        setReceiptPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async () => {
        setErrorMessage(null);
        setIsSubmitting(true);
        try {
            const receiptImg = receiptFile ? await uploadRentalReceipt(receiptFile) : undefined;
            await createRental({ ...values, receipt_img: receiptImg });
            navigate('/reports/rentals');
        } catch (error) {
            setErrorMessage(`Failed to save rental: ${(error as Error).message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box component="form" p={3} onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
            <Typography variant="h5" mb={2}>Create Rental</Typography>
            {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField select required fullWidth label="Branch" name="branch_id" value={values.branch_id} onChange={handleChange}>
                        {branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}
                    </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField select required fullWidth label="Item" name="item_rented_id" value={values.item_rented_id} onChange={handleChange}>
                        {items.map((item) => <MenuItem key={item.id} value={item.id}>{item.item_name}</MenuItem>)}
                    </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker label="Date Rented" value={values.date_rented ? dayjs(values.date_rented) : null} onChange={(date) => setValues((current) => ({ ...current, date_rented: date ? date.format('YYYY-MM-DD') : '' }))} slotProps={{ textField: { fullWidth: true, required: true } }} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker label="Return Date" value={values.date_returned ? dayjs(values.date_returned) : null} onChange={(date) => setValues((current) => ({ ...current, date_returned: date ? date.format('YYYY-MM-DD') : '' }))} slotProps={{ textField: { fullWidth: true, required: true } }} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField required fullWidth label="Renter Name" name="renter_name" value={values.renter_name} onChange={handleChange} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField required fullWidth label="Contact Number" name="renter_contact_no" value={values.renter_contact_no} onChange={handleChange} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" mb={1}>Receipt Image</Typography>
                    <Button variant="outlined" component="label" disabled={isSubmitting}>
                        Upload Receipt Image
                        <input hidden type="file" accept="image/*" onChange={handleReceiptChange} />
                    </Button>
                    {receiptFile && <Typography variant="body2" color="success.main" mt={1}>{receiptFile.name} selected</Typography>}
                    {receiptPreview && <Box component="img" src={receiptPreview} alt="Receipt preview" sx={{ display: 'block', mt: 2, width: 180, height: 180, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', objectFit: 'contain' }} />}
                </Grid>
            </Grid>

            <Button type="submit" variant="contained" sx={{ mt: 3 }} disabled={isSubmitting} startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined}>
                {isSubmitting ? 'Saving Rental...' : 'Save Rental'}
            </Button>
        </Box>
    );
}
