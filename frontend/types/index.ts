// ── Tipos compartidos de Beel ────────────────────────────────────────────────

export interface Property {
  id: string;
  title: string;
  description: string;
  property_type: PropertyType;
  status: PropertyStatus;

  // Ubicación
  address: string;
  neighborhood?: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  latitude_approx?: number;
  longitude_approx?: number;

  // Capacidad
  max_guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;

  // Precios
  price_per_night: number;
  currency: string;
  cleaning_fee: number;
  security_deposit?: number;
  min_stay_nights: number;
  max_stay_nights?: number;

  // Políticas
  cancellation_policy: CancellationPolicy;
  check_in_time?: string;
  check_out_time?: string;
  instant_booking: boolean;
  allows_pets: boolean;
  allows_smoking: boolean;
  allows_events: boolean;
  require_guest_identity: boolean;

  // Métricas
  total_reviews: number;
  avg_rating?: number;
  total_bookings: number;

  // Relaciones
  host: Host;
  photos: PropertyPhoto[];
  amenities: PropertyAmenity[];

  created_at: string;
  updated_at: string;
}

export type PropertyType =
  | "casa"
  | "departamento"
  | "cabaña"
  | "villa"
  | "habitacion"
  | "hostal"
  | "otro";

export type PropertyStatus =
  | "pending_review"
  | "active"
  | "inactive"
  | "suspended"
  | "deleted";

export type CancellationPolicy = "flexible" | "moderada" | "estricta";

export interface PropertyPhoto {
  id: string;
  url: string;
  thumbnail_url?: string;
  display_order: number;
  is_primary: boolean;
  caption?: string;
}

export interface PropertyAmenity {
  amenity: Amenity;
}

export interface Amenity {
  id: string;
  slug: string;
  name_es: string;
  icon?: string;
  category: string;
  is_highlight: boolean;
}

export interface Host {
  id: string;
  full_name: string;
  avatar_url?: string;
  is_identity_verified: boolean;
  host_since?: string;
  total_listings: number;
}

// ── Búsqueda ─────────────────────────────────────────────────────────────────

export interface SearchParams {
  destino?: string;
  check_in?: string;
  check_out?: string;
  huespedes?: number;
  tipo?: PropertyType;
  precio_min?: number;
  precio_max?: number;
  mascotas?: boolean;
  reserva_inmediata?: boolean;
  lat?: number;
  lng?: number;
  radio_km?: number;
}

export interface SearchResult {
  properties: Property[];
  total: number;
  page: number;
  per_page: number;
}

// ── Reservas ─────────────────────────────────────────────────────────────────

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled_guest"
  | "cancelled_host"
  | "completed"
  | "rejected";

export interface Reservation {
  id: string;
  reservation_property: Property;
  check_in: string;
  check_out: string;
  guests_count: number;
  nights: number;
  total_amount: number;
  status: ReservationStatus;
  created_at: string;
}
