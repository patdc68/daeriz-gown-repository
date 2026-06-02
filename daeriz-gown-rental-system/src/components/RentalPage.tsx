import RentalList from './RentalList';
import { RENTAL_STATUSES } from '../services/RentalService';

export default function RentalsPage() {
  return <RentalList status={RENTAL_STATUSES.RENTING} title="Active Rentals" showCreateButton />;
}
