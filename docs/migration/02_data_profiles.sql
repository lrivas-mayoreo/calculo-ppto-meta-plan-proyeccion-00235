-- ============================================
-- DATA EXPORT: PROFILES
-- Note: Users must be created first via Supabase Auth
-- These INSERTs are for reference - actual profiles are created by trigger
-- ============================================

-- Profile: acolmenarez@mayoreo.biz (id: 8f11f86b-ed10-4f5c-9be1-76e9705aab0b)
-- Profile: nsegovia@febeca.com (id: b1a67b80-8c6c-42da-bd00-558b3a76c4c6)
-- Profile: mfoncesa@mayoreo.biz (id: b124892c-8f70-4da4-91b7-6526be7a0e00)
-- Profile: ftovar@mayoreo.biz (id: 817a32c0-01d0-49d1-a63b-ebb269689874)
-- Profile: rafaelaed09@gmail.com (id: be732334-8353-48ad-9581-a3e8dfe75fff)

-- After users register, insert their roles:
-- INSERT INTO public.user_roles (user_id, role) VALUES
-- ('USER_UUID_HERE', 'administrador');
