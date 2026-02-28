import * as React from 'react';
import { useNavigate, useParams } from 'react-router';
import useNotifications from '../hooks/useNotifications/useNotifications';
import ItemForm, { type FormFieldValue, type ItemFormState } from './ItemForm';
import PageContainer from './PageContainer';
import { supabase } from '../services/supabase';

export default function ItemEdit() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const notifications = useNotifications();

    const [formState, setFormState] = React.useState<ItemFormState>({
        values: {},
        errors: {},
    });
    const [isLoading, setIsLoading] = React.useState(true);
    const [branches, setBranches] = React.useState<{ id: string; name: string }[]>([]);

    // Load item + branches on mount
    React.useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);

            try {
                // Load branches
                const { data: branchData } = await supabase.from('DBLG_SHOP_BRANCH').select('id,name');
                setBranches(branchData ?? []);

                // Load item
                const { data: itemData, error: itemError } = await supabase
                    .from('DBLG_ITEMS')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (itemError) throw itemError;
                if (itemData) setFormState((prev) => ({ ...prev, values: itemData }));
            } catch (err) {
                notifications.show(
                    `Failed to load item: ${(err as Error).message}`,
                    { severity: 'error' }
                );
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [id, notifications]);

    const handleFieldChange = React.useCallback(
        (name: keyof ItemFormState['values'], value: FormFieldValue) => {
            setFormState((prev) => ({
                ...prev,
                values: { ...prev.values, [name]: value },
            }));
        },
        []
    );

    const handleSubmit = async () => {
        setIsLoading(true);

        try {
            const { values } = formState;
            let imageUrl = values.image_url ?? '';

            // If a new file is selected, upload it
            if (values.image_file instanceof File) {
                const fileName = `${Date.now()}-${values.image_file.name}`;

                const { error: uploadError } = await supabase.storage
                    .from('item-images')
                    .upload(fileName, values.image_file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('item-images')
                    .getPublicUrl(fileName);

                imageUrl = data.publicUrl;
            }

            // Update the row
            const { error: updateError } = await supabase
                .from('DBLG_ITEMS')
                .update({
                    item_name: values.item_name,
                    branch_id: values.branch_id,
                    category: values.category,
                    total_qty: values.total_qty,
                    avail_qty: values.avail_qty,
                    size: values.size,
                    image_url: imageUrl,
                })
                .eq('id', id);

            if (updateError) throw updateError;

            notifications.show('Item updated successfully.', { severity: 'success' });
            navigate('/itemList');
        } catch (err) {
            notifications.show(
                `Failed to update item: ${(err as Error).message}`,
                { severity: 'error' }
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <PageContainer
            title="Edit Item"
            breadcrumbs={[{ title: 'Items', path: '/itemList' }, { title: 'Edit' }]}
        >
            {!isLoading && Object.keys(formState.values).length > 0 && (
                <ItemForm
                    formState={formState}
                    branches={branches}
                    onFieldChange={handleFieldChange}
                    onSubmit={handleSubmit}
                    submitButtonLabel="Save Changes"
                    backButtonPath="/itemList"
                />
            )}
        </PageContainer>
    );
}