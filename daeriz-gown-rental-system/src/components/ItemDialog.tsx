import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button
} from "@mui/material";
import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export default function ItemDialog({ open, onClose, refresh, item }: any) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState<number | string>("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setPrice(item.price);
    }
  }, [item]);

  const handleSubmit = async () => {
    let imageUrl = item?.image_url;

    if (file) {
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("item-images")
        .upload(fileName, file);

      if (!error) {
        const { data } = supabase.storage
          .from("item-images")
          .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }
    }

    if (item) {
      await supabase.from("items").update({
        name,
        category,
        price,
        image_url: imageUrl
      }).eq("id", item.id);
    } else {
      await supabase.from("items").insert({
        name,
        category,
        price,
        image_url: imageUrl
      });
    }

    refresh();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{item ? "Edit Item" : "Add Item"}</DialogTitle>
      <DialogContent>
        <TextField label="Name" fullWidth margin="dense" value={name} onChange={e => setName(e.target.value)} />
        <TextField label="Category" fullWidth margin="dense" value={category} onChange={e => setCategory(e.target.value)} />
        <TextField label="Price" fullWidth margin="dense" type="number" value={price} onChange={e => setPrice(e.target.value)} />
        <Button component="label" sx={{ mt: 2 }}>
          Upload Image
          <input type="file" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}