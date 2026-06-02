import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  getAnalyticsDateRange,
  getRentalAnalytics,
  type AnalyticsScope,
  type RentalAnalytics,
} from '../services/RentalAnalyticsService';
import { ImagePreviewDialog, ImageThumbnail } from './ImagePreview';

const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

interface BarDatum {
  key: string;
  label: string;
  value: number;
  tooltip: string;
}

function BarChart({ data, ariaLabel }: { data: BarDatum[]; ariaLabel: string }) {
  const maximum = Math.max(...data.map((item) => item.value), 1);

  return (
    <Box role="img" aria-label={ariaLabel} sx={{ display: 'flex', gap: 1.5, alignItems: 'end', height: 240, mt: 3, mb: 2 }}>
      {data.map((item) => (
        <Tooltip key={item.key} title={item.tooltip} arrow>
          <Stack alignItems="center" justifyContent="flex-end" spacing={0.75} sx={{ flex: 1, height: '100%', minWidth: 52 }}>
            <Typography variant="caption" fontWeight={700}>{item.value}</Typography>
            <Box
              sx={{
                width: 'min(100%, 64px)',
                height: `${Math.max((item.value / maximum) * 170, 8)}px`,
                bgcolor: 'text.primary',
                borderRadius: '6px 6px 0 0',
              }}
            />
            <Typography variant="caption" textAlign="center" sx={{ lineHeight: 1.1, minHeight: 28 }}>
              {item.label}
            </Typography>
          </Stack>
        </Tooltip>
      ))}
    </Box>
  );
}

function AnalyticsCard({ children, title, subtitle }: React.PropsWithChildren<{ title: string; subtitle: string }>) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}

export default function RentalAnalyticsPage() {
  const [scope, setScope] = React.useState<AnalyticsScope>('today');
  const [analytics, setAnalytics] = React.useState<RentalAnalytics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedImage, setSelectedImage] = React.useState<{ url: string; alt: string } | null>(null);
  const dateRange = getAnalyticsDateRange(scope);

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    getRentalAnalytics(scope)
      .then((data) => active && setAnalytics(data))
      .catch((loadError: Error) => active && setError(loadError.message))
      .finally(() => active && setIsLoading(false));

    return () => { active = false; };
  }, [scope]);

  const emptyMessage = scope === 'today'
    ? 'No rental data for today.'
    : 'No rental data for the selected date range.';

  return (
    <Box p={{ xs: 2, sm: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2} mb={3}>
        <Box>
          <Typography variant="h5">Analytics</Typography>
          <Typography variant="body2" color="text.secondary">Rental performance by branch and item.</Typography>
        </Box>
        <ButtonGroup aria-label="Analytics date scope">
          <Button variant={scope === 'today' ? 'contained' : 'outlined'} onClick={() => setScope('today')}>Today</Button>
          <Button variant={scope === 'yearToDate' ? 'contained' : 'outlined'} onClick={() => setScope('yearToDate')}>Year to Date</Button>
        </ButtonGroup>
      </Stack>

      {isLoading && <Stack alignItems="center" py={8}><CircularProgress aria-label="Loading analytics" /></Stack>}
      {error && <Alert severity="error">Failed to load analytics: {error}</Alert>}
      {!isLoading && !error && analytics?.totalRentals === 0 && <Alert severity="info">{emptyMessage}</Alert>}

      {!isLoading && !error && analytics && analytics.totalRentals > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
          <AnalyticsCard title="Total Rentals per Branch" subtitle={dateRange.label}>
            <Typography variant="body2" sx={{ mt: 1 }}>Overall rentals: <strong>{analytics.totalRentals}</strong></Typography>
            <BarChart
              ariaLabel="Bar chart showing total rentals per branch"
              data={analytics.branches.map((branch) => ({
                key: branch.branchId,
                label: branch.branchName,
                value: branch.rentalCount,
                tooltip: `${branch.branchName}: ${branch.rentalCount} rentals (${formatPercentage(branch.percentage)} of total)`,
              }))}
            />
            <TableContainer>
              <Table size="small" aria-label="Total rentals per branch summary">
                <TableHead><TableRow><TableCell>Branch</TableCell><TableCell align="right">Total Rentals</TableCell><TableCell align="right">Percentage</TableCell></TableRow></TableHead>
                <TableBody>{analytics.branches.map((branch) => (
                  <TableRow key={branch.branchId}><TableCell>{branch.branchName}</TableCell><TableCell align="right">{branch.rentalCount}</TableCell><TableCell align="right">{formatPercentage(branch.percentage)}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </TableContainer>
          </AnalyticsCard>

          <AnalyticsCard title="Most Rented Item per Branch" subtitle={dateRange.label}>
            <BarChart
              ariaLabel="Bar chart showing the most rented item per branch"
              data={analytics.topItems.map((item) => ({
                key: item.branchId,
                label: item.branchName,
                value: item.rentalCount,
                tooltip: `${item.branchName}: ${item.itemName}, ${item.rentalCount} rentals (${formatPercentage(item.branchShare)} of branch rentals)`,
              }))}
            />
            <TableContainer>
              <Table size="small" aria-label="Most rented item per branch summary">
                <TableHead><TableRow><TableCell>Branch</TableCell><TableCell>Most Rented Item</TableCell><TableCell align="right">Rentals</TableCell><TableCell align="right">Branch Share</TableCell></TableRow></TableHead>
                <TableBody>{analytics.topItems.map((item) => (
                  <TableRow key={item.branchId}>
                    <TableCell>{item.branchName}</TableCell>
                    <TableCell><Stack direction="row" alignItems="center" spacing={1}><ImageThumbnail src={item.imageUrl} alt={item.itemName} fallback="No image" size={32} onPreview={(url, alt) => setSelectedImage({ url, alt })} /><span>{item.itemName}</span></Stack></TableCell>
                    <TableCell align="right">{item.rentalCount}</TableCell><TableCell align="right">{formatPercentage(item.branchShare)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </TableContainer>
          </AnalyticsCard>
        </Box>
      )}

      <ImagePreviewDialog imageUrl={selectedImage?.url ?? null} alt={selectedImage?.alt ?? 'Rental item'} title="Item image preview" onClose={() => setSelectedImage(null)} />
    </Box>
  );
}
