import PaymentProcessingModal from './PaymentProcessingModal';

/**
 * Mount once at app root (main.tsx) so private-pay progress
 * always paints above layout/sidebar/outlet stacking, survives
 * route changes, and reopens after reload while settle is in flight.
 */
export default function PaymentSessionHost() {
  return <PaymentProcessingModal />;
}
