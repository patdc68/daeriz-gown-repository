export type Item = {
  id: string;
  created_at: string;
  branch_id: string;
  item_name: string;
  category: string;
  image_url: string | null;
  total_qty: number;
  avail_qty: number;
  size: string;
  branch: {
    name: string;
  } | null;
  branchName?: string
};
