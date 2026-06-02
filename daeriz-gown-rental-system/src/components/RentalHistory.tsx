import RentalList from './RentalList';
import { RENTAL_STATUSES } from '../services/RentalService';

export default function RentalHistory() {
  return (
    <RentalList
      status={RENTAL_STATUSES.COMPLETED}
      title="Rental History"
      allowStatusUpdate={false}
      showActualReturn
    />
  );
}
