/**
 * BookingService handles the complete booking lifecycle.
 *
 * Decision: Use event-driven architecture for booking state changes
 * to decouple the booking flow from downstream effects (notifications,
 * analytics, inventory updates).
 */

export interface BookingRequest {
  userId: string;
  chairId: string;
  date: string;
  startTime: string;
  endTime: string;
  addons?: string[];
}

export interface BookingResponse {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  totalAmount: number;
  currency: string;
  paymentIntentId?: string;
}

export interface AvailabilitySlot {
  chairId: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

// Pattern: Strategy pattern for pricing calculation
export interface PricingStrategy {
  calculate(request: BookingRequest): Promise<number>;
}

export class StandardPricing implements PricingStrategy {
  private baseRate: number;

  constructor(baseRate: number) {
    this.baseRate = baseRate;
  }

  async calculate(request: BookingRequest): Promise<number> {
    const hours = this.calculateHours(request.startTime, request.endTime);
    const addonCost = (request.addons?.length ?? 0) * 5;
    return this.baseRate * hours + addonCost;
  }

  private calculateHours(start: string, end: string): number {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return (endH! - startH!) + (endM! - startM!) / 60;
  }
}

// Dependency: Requires AvailabilityService and PaymentGateway
export class BookingService {
  private pricing: PricingStrategy;

  constructor(pricing: PricingStrategy) {
    this.pricing = pricing;
  }

  async createBooking(request: BookingRequest): Promise<BookingResponse> {
    const amount = await this.pricing.calculate(request);

    return {
      id: `booking_${Date.now()}`,
      status: 'pending',
      totalAmount: amount,
      currency: 'USD',
    };
  }

  async confirmBooking(bookingId: string): Promise<BookingResponse> {
    // Constraint: Must complete within 30 seconds
    // or release the hold automatically
    return {
      id: bookingId,
      status: 'confirmed',
      totalAmount: 0,
      currency: 'USD',
    };
  }
}
