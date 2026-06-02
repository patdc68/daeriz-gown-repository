-- Store the public URL for the receipt uploaded when a rental is created.
alter table "DBLG_RENTALS"
add column if not exists receipt_img text;
