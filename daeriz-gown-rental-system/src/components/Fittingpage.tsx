// FittingsPage.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { Fitting, FittingInsert, Item, Branch } from '../data/fittingType';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    MenuItem,
    Stack,
    Typography,
} from '@mui/material';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import dayjs, { Dayjs } from 'dayjs';
import Autocomplete from '@mui/material/Autocomplete';

export default function FittingsPage() {
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedFitting, setSelectedFitting] = useState<Fitting | null>(null);
    const [selectedItemObj, setSelectedItemObj] = useState<Item | null>(null);
    const [selectedBranchObj, setSelectedBranchObj] = useState<Branch | null>(null);
    const [fittings, setFittings] = useState<Fitting[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    // Form state
    const [openForm, setOpenForm] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [fittingDate, setFittingDate] = useState<Dayjs | null>(dayjs());

    // Fetch data on mount
    useEffect(() => {
        const fetchData = async () => {
            const { data: fittingData } = await supabase
                .from('DBLG_FITTINGS')
                .select('*');
            if (fittingData) setFittings(fittingData as Fitting[]);

            const { data: itemData } = await supabase.from('DBLG_ITEMS').select('*');
            if (itemData) setItems(itemData as Item[]);


            const { data: branchData } = await supabase.from('DBLG_SHOP_BRANCH').select('*');
            if (branchData) setBranches(branchData as Branch[]);
        };
        fetchData();
    }, []);

    const handleCreateFitting = async () => {
        if (!customerName || !customerPhone || !selectedItem || !selectedBranch || !fittingDate) {
            return alert('Fill all fields');
        }

        const insertRow: FittingInsert = {
            customer_name: customerName,
            customer_phone: customerPhone,
            item_id: selectedItem?.id,
            branch_id: selectedBranch,
            fitting_date: fittingDate.toISOString(),
            status: 'Scheduled',
        };
        if (!selectedItem) return alert('Select an item');
        const { data, error } = await supabase
            .from('DBLG_FITTINGS')
            .insert([insertRow] as FittingInsert[])
            .select('*');

        if (error) return alert(error.message);

        if (data && data.length > 0) {
            setFittings(prev => [...prev, data[0]]);
        }

        setOpenForm(false);
    };

    const handleEventClick = (info: any) => {
        const fittingId = info.event.id;
        const fitting = fittings.find(f => f.id === fittingId);

        if (fitting) {
            const item = items.find(i => i.id === fitting.item_id) || null;
            const branch = branches.find(b => b.id === fitting.branch_id) || null;

            setSelectedFitting(fitting);
            setSelectedItemObj(item);
            setSelectedBranchObj(branch);
            setOpenDialog(true);
        }
    };
    const calendarEvents = fittings.map(f => ({
        id: f.id,
        title: f.customer_name,
        date: f.fitting_date,
    }));

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box p={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h5">Fittings Schedule</Typography>
                    <Button variant="contained" onClick={() => setOpenForm(true)}>
                        Schedule Fitting
                    </Button>
                </Stack>

                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    events={calendarEvents}
                    eventClick={handleEventClick}
                    height="auto"
                />

                <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Fitting Details</DialogTitle>
                    <DialogContent dividers>
                        {selectedFitting && (
                            <Box display="flex" flexDirection="column" gap={2}>
                                <Typography><strong>Customer Name:</strong> {selectedFitting.customer_name}</Typography>
                                <Typography><strong>Phone:</strong> {selectedFitting.customer_phone}</Typography>
                                {selectedBranchObj && (
                                    <Typography>
                                        <strong>Branch:</strong> {selectedBranchObj.name}
                                    </Typography>
                                )}
                                <Typography>
                                    <strong>Fitting Date:</strong> {dayjs(selectedFitting.fitting_date).format('YYYY-MM-DD HH:mm')}
                                </Typography>
                                <Typography><strong>Status:</strong> {selectedFitting.status}</Typography>

                                {selectedItemObj && (
                                    <>
                                        <Typography><strong>Item:</strong> {selectedItemObj.item_name}</Typography>
                                        {selectedItemObj.image_url && (
                                            <Box
                                                component="img"
                                                src={selectedItemObj.image_url}
                                                alt={selectedItemObj.item_name}
                                                sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 1 }}
                                            />
                                        )}
                                    </>
                                )}
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={async () => {
                                if (!selectedFitting) return;

                                const confirmDelete = window.confirm("Are you sure you want to delete this fitting?");
                                if (!confirmDelete) return;

                                const { error } = await supabase
                                    .from('DBLG_FITTINGS')
                                    .delete()
                                    .eq('id', selectedFitting.id);

                                if (error) {
                                    alert(`Failed to delete: ${error.message}`);
                                    return;
                                }

                                // Remove from local state
                                setFittings(prev => prev.filter(f => f.id !== selectedFitting.id));

                                // Close dialog
                                setOpenDialog(false);
                            }}
                        >
                            Delete
                        </Button>

                        <Button onClick={() => setOpenDialog(false)} variant="contained" color="primary">
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Create Fitting Dialog */}
                <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Create Fitting</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} mt={1}>
                            <TextField
                                label="Customer Name"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                fullWidth
                            />
                            <TextField
                                label="Customer Phone"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                fullWidth
                            />
                            <TextField
                                select
                                label="Branch"
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                                fullWidth
                            >
                                {branches.map(b => (
                                    <MenuItem key={b.id} value={b.id}>
                                        {b.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <Autocomplete
                                options={items} // your array of Item
                                getOptionLabel={(option) => option.item_name} // what to show in the dropdown
                                value={selectedItem} // full object
                                onChange={(_, newValue) => setSelectedItem(newValue)} // newValue is Item | null
                                isOptionEqualToValue={(option, value) => option.id === value.id} // important for proper selection
                                renderInput={(params) => <TextField {...params} label="Item" fullWidth />}
                                size="small"
                            />
                            <DateTimePicker
                                label="Fitting Date & Time"
                                value={fittingDate}
                                onChange={(newVal) => setFittingDate(newVal)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                            <Button variant="contained" onClick={handleCreateFitting}>
                                Save
                            </Button>
                        </Stack>
                    </DialogContent>
                </Dialog>
            </Box>
        </LocalizationProvider>
    );
}