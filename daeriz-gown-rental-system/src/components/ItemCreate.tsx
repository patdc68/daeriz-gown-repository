import * as React from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../services/supabase';
import ItemForm, {
  type ItemFormState,
  type FormFieldValue,
} from './ItemForm';
import PageContainer from './PageContainer';
import useNotifications from '../hooks/useNotifications/useNotifications';

export default function ItemCreate() {
  const navigate = useNavigate();
  const notifications = useNotifications();

  const [branches, setBranches] = React.useState<
    { id: string; name: string }[]
  >([]);

  const [formState, setFormState] = React.useState<ItemFormState>({
    values: {},
    errors: {},
  });

  // 🔹 Fetch branches from DBLG_SHOP_BRANCH
  React.useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from('DBLG_SHOP_BRANCH')
        .select('id, name');

      if (!error && data) {
        setBranches(data);
      }
    };

    fetchBranches();
  }, []);

  const handleFieldChange = (
    name: keyof ItemFormState['values'],
    value: FormFieldValue,
  ) => {
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, [name]: value },
    }));
  };

  const handleSubmit = async () => {
    try {
      const { image_file, ...otherValues } = formState.values;

      let imageUrl = '';

      // 🔹 Upload image to Supabase Storage
      
      if (image_file instanceof File) {
        const fileName = `${Date.now()}-${image_file.name}`;

       
        const { error: uploadError } = await supabase.storage
          .from('item-images') // your bucket name
          .upload(fileName, image_file);

        
        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('item-images')
          .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }

      // 🔹 Insert into DBLG_ITEMS
      const { error } = await supabase.from('DBLG_ITEMS').insert([
        {
          ...otherValues,
          image_url: imageUrl,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      notifications.show('Item created successfully!', {
        severity: 'success',
      });

      navigate('/itemList');
    } catch (error) {
      notifications.show(
        `Failed to create item: ${(error as Error).message}`,
        { severity: 'error' },
      );
    }
  };

  return (
    <PageContainer
      title="New Item"
      breadcrumbs={[
        { title: 'Items', path: '/itemList' },
        { title: 'New' },
      ]}
    >
      <ItemForm
        formState={formState}
        branches={branches}
        onFieldChange={handleFieldChange}
        onSubmit={handleSubmit}
        submitButtonLabel="Create"
        backButtonPath = "/itemList"
      />
    </PageContainer>
  );
}