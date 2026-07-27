-- FAM Website Supabase Schema
-- Converts Mongoose models to PostgreSQL tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========== ENUMS ==========

CREATE TYPE user_role AS ENUM ('guest', 'admin');
CREATE TYPE room_status AS ENUM ('available', 'booked', 'occupied', 'cleaning', 'maintenance', 'out_of_service');
CREATE TYPE booking_status AS ENUM ('draft', 'pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show', 'expired');
CREATE TYPE booking_payment_status AS ENUM ('pending', 'partial', 'paid', 'refunded', 'failed');
CREATE TYPE payment_txn_status AS ENUM ('created', 'attempted', 'paid', 'failed', 'refunded');
CREATE TYPE notification_type AS ENUM ('booking_submitted', 'booking_confirmed', 'booking_cancelled', 'booking_modified', 'booking_expired', 'payment_received', 'check_in_reminder', 'check_out_reminder', 'review_approved', 'promo', 'system');

-- ========== 1. PROFILES (extends auth.users) ==========

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 50),
  email TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  role user_role DEFAULT 'guest',
  is_verified BOOLEAN DEFAULT false,
  avatar JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ========== 2. ROOMS ==========

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  slug TEXT UNIQUE,
  description TEXT NOT NULL CHECK (char_length(description) <= 2000),
  short_description TEXT DEFAULT '' CHECK (char_length(short_description) <= 300),
  price_per_night NUMERIC(10,2) NOT NULL CHECK (price_per_night >= 0),
  discount_price NUMERIC(10,2) DEFAULT NULL CHECK (discount_price IS NULL OR discount_price >= 0),
  currency TEXT DEFAULT 'INR' CHECK (currency IN ('INR', 'USD')),
  capacity JSONB NOT NULL DEFAULT '{"adults": 2, "children": 0, "maxGuests": 2}'::jsonb,
  size NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'sq ft',
  bed_type TEXT DEFAULT 'King',
  amenities TEXT[] DEFAULT '{}',
  images JSONB DEFAULT '[]'::jsonb,
  thumbnail JSONB DEFAULT '{}'::jsonb,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  total_rooms INTEGER NOT NULL DEFAULT 1 CHECK (total_rooms >= 1),
  status room_status DEFAULT 'available',
  booked_dates JSONB DEFAULT '[]'::jsonb,
  maintenance_blocks JSONB DEFAULT '[]'::jsonb,
  min_stay INTEGER DEFAULT 1 CHECK (min_stay >= 1),
  max_stay INTEGER DEFAULT 30 CHECK (max_stay >= 1),
  cancellation_policy TEXT DEFAULT 'Free cancellation up to 48 hours before check-in',
  check_in_time TEXT DEFAULT '14:00',
  check_out_time TEXT DEFAULT '11:00',
  rating NUMERIC(2,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  num_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rooms_slug ON rooms(slug);
CREATE INDEX idx_rooms_available_featured ON rooms(is_available, is_featured);
CREATE INDEX idx_rooms_price ON rooms(price_per_night);
CREATE INDEX idx_rooms_status ON rooms(status);

-- Slug auto-generation trigger
CREATE OR REPLACE FUNCTION generate_room_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-z0-9]+', '-', 'g'));
    NEW.slug := trim(BOTH '-' FROM NEW.slug);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rooms_slug
  BEFORE INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION generate_room_slug();

-- ========== 3. BOOKINGS (without payment FK initially) ==========

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests JSONB NOT NULL DEFAULT '{"adults": 1, "children": 0}'::jsonb,
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_paid >= 0),
  currency TEXT DEFAULT 'INR',
  status booking_status DEFAULT 'pending',
  payment_status booking_payment_status DEFAULT 'pending',
  special_requests TEXT DEFAULT '' CHECK (char_length(special_requests) <= 500),
  nights INTEGER NOT NULL CHECK (nights >= 1),
  cancellation_reason TEXT DEFAULT '',
  cancelled_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  previous_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  status_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_user_status ON bookings(user_id, status);
CREATE INDEX idx_bookings_room_dates ON bookings(room_id, check_in, check_out);
CREATE INDEX idx_bookings_status_created ON bookings(status, created_at DESC);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);

-- Status tracking trigger
CREATE OR REPLACE FUNCTION track_booking_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD IS NULL OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb) || jsonb_build_object(
      'status', NEW.status,
      'changedAt', now(),
      'changedBy', 'system'
    );
    CASE NEW.status
      WHEN 'confirmed' THEN
        IF NEW.confirmed_at IS NULL THEN NEW.confirmed_at := now(); END IF;
      WHEN 'cancelled' THEN
        IF NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;
      WHEN 'checked_in' THEN
        IF NEW.checked_in_at IS NULL THEN NEW.checked_in_at := now(); END IF;
      WHEN 'checked_out' THEN
        IF NEW.checked_out_at IS NULL THEN NEW.checked_out_at := now(); END IF;
      WHEN 'completed' THEN
        IF NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
      WHEN 'expired' THEN
        IF NEW.expired_at IS NULL THEN NEW.expired_at := now(); END IF;
      ELSE
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_status
  BEFORE INSERT OR UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION track_booking_status();

-- ========== 4. PAYMENTS ==========

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  razorpay_order_id TEXT DEFAULT NULL,
  razorpay_payment_id TEXT DEFAULT NULL,
  razorpay_signature TEXT DEFAULT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'INR',
  status payment_txn_status DEFAULT 'created',
  payment_method TEXT DEFAULT '',
  refund_id TEXT DEFAULT NULL,
  refund_amount NUMERIC(10,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_order ON payments(razorpay_order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Now add payment FK to bookings
ALTER TABLE bookings ADD COLUMN payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

-- ========== 5. REVIEWS ==========

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT DEFAULT '' CHECK (char_length(title) <= 100),
  comment TEXT NOT NULL CHECK (char_length(comment) <= 1000),
  is_verified BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reviews_room_approved ON reviews(room_id, is_approved);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- ========== 6. CONTACTS ==========

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  subject TEXT NOT NULL CHECK (char_length(subject) <= 200),
  message TEXT NOT NULL CHECK (char_length(message) <= 2000),
  is_read BOOLEAN DEFAULT false,
  is_replied BOOLEAN DEFAULT false,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contacts_read_created ON contacts(is_read, created_at DESC);
CREATE INDEX idx_contacts_email ON contacts(email);

-- ========== 7. NEWSLETTERS ==========

CREATE TABLE newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_newsletters_email ON newsletters(email);
CREATE INDEX idx_newsletters_active ON newsletters(is_active);

-- ========== 8. NOTIFICATIONS ==========

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  is_read BOOLEAN DEFAULT false,
  link TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);

-- ========== TRIGGERS: updated_at ==========

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_newsletters_updated_at BEFORE UPDATE ON newsletters FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========== AUTO-CREATE PROFILE ON SIGNUP ==========

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'guest')::user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ========== ROW LEVEL SECURITY ==========

-- Profiles: users can read/update own profile; admins can read all
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- Rooms: public read; admin write
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view available rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Admins can insert rooms" ON rooms FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);
CREATE POLICY "Admins can update rooms" ON rooms FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);
CREATE POLICY "Admins can delete rooms" ON rooms FOR DELETE USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- Bookings: users can view own; admins can view all
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings" ON bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all bookings" ON bookings FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- Payments: users can view own; admins can view all
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own payments" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all payments" ON payments FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- Reviews: public read approved; users create own; admin manage
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view approved reviews" ON reviews FOR SELECT USING (is_approved = true);
CREATE POLICY "Users can view own reviews" ON reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all reviews" ON reviews FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- Contacts: insert for anyone; read only for admins
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit contact" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage contacts" ON contacts FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- Newsletters: insert for anyone; read only for admins
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON newsletters FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own subscription" ON newsletters FOR UPDATE USING (true);
CREATE POLICY "Admins can manage newsletters" ON newsletters FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- Notifications: users can view own; admins can view all
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage notifications" ON notifications FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);
