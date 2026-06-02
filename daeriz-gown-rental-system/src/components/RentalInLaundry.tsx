import RentalList from './RentalList';
import { RENTAL_STATUSES } from '../services/RentalService';

export default function RentalInLaundry() {
  return <RentalList status={RENTAL_STATUSES.IN_LAUNDRY} title="Rentals In Laundry" />;
}
