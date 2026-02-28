import React from 'react';
import {
    TextField,
    Button,
    Grid,
    Box,
    Typography,
    MenuItem
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { createRental } from '../services/RentalService';

export default function CreateRental() {
    const navigate = useNavigate();
    const [items, setItems] = React.useState<any[]>([]);
    const [branches, setBranches] = React.useState<any[]>([]);

    const [values, setValues] = React.useState({
        branch_id: '',
        item_rented_id: '',
        date_rented: '',
        date_returned: '',
        renter_name: '',
        renter_contact_no: ''
    });

    React.useEffect(() => {
        loadDropdowns();
    }, []);

    const loadDropdowns = async () => {
        const { data: items } = await supabase
            .from('DBLG_ITEMS')
            .select('id, item_name');

        const { data: branches } = await supabase
            .from('DBLG_SHOP_BRANCH')
            .select('id, name');

        setItems(items || []);
        setBranches(branches || []);
    };

    const handleChange = (e: any) => {
        setValues({ ...values, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        await createRental(values);
        navigate('/reports/rentals');
    };

    return (
        <Box p={3}>
            <Typography variant="h5" mb={2}>
                Create Rental
            </Typography>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                        select
                        fullWidth
                        label="Branch"
                        name="branch_id"
                        value={values.branch_id}
                        onChange={handleChange}
                    >
                        {branches.map((b) => (
                            <MenuItem key={b.id} value={b.id}>
                                {b.name}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                        select
                        fullWidth
                        label="Item"
                        name="item_rented_id"
                        value={values.item_rented_id}
                        onChange={handleChange}
                    >
                        {items.map((i) => (
                            <MenuItem key={i.id} value={i.id}>
                                {i.item_name}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker
                        label="Date Rented"
                        value={values.date_rented ? dayjs(values.date_rented) : null}
                        onChange={(newValue) =>
                            setValues({
                                ...values,
                                date_rented: newValue ? newValue.format('YYYY-MM-DD') : ''
                            })
                        }
                        slotProps={{
                            textField: { fullWidth: true }
                        }}
                    />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker
                        label="Return Date"
                        value={values.date_returned ? dayjs(values.date_returned) : null}
                        onChange={(newValue) =>
                            setValues({
                                ...values,
                                date_returned: newValue ? newValue.format('YYYY-MM-DD') : ''
                            })
                        }
                        slotProps={{
                            textField: { fullWidth: true }
                        }}
                    />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                        fullWidth
                        label="Renter Name"
                        name="renter_name"
                        onChange={handleChange}
                    />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                        fullWidth
                        label="Contact Number"
                        name="renter_contact_no"
                        onChange={handleChange}
                    />
                </Grid>
            </Grid>

            <Button
                variant="contained"
                sx={{ mt: 3 }}
                onClick={handleSubmit}
            >
                Save Rental
            </Button>
        </Box>
    );
}