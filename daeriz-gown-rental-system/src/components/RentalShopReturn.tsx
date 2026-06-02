import RentalList from './RentalList';
import { RENTAL_STATUSES } from '../services/RentalService';

export default function RentalShopReturn() {
  return <RentalList status={RENTAL_STATUSES.SHOP_RETURN} title="Shop Return Rentals" />;
}
