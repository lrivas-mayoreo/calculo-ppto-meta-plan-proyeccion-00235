-- Drop dependent policies and function first
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Update app_role enum to match new requirements
ALTER TYPE app_role RENAME TO app_role_old;
CREATE TYPE app_role AS ENUM ('administrador', 'gerente', 'admin_ventas');

-- Update user_roles table to use new enum
ALTER TABLE user_roles 
  ALTER COLUMN role TYPE app_role USING 
    CASE 
      WHEN role::text = 'administrador' THEN 'administrador'::app_role
      WHEN role::text = 'ventas' THEN 'admin_ventas'::app_role
      WHEN role::text = 'compras' THEN 'gerente'::app_role
      ELSE 'gerente'::app_role
    END;

-- Update budgets table role column
ALTER TABLE budgets 
  ALTER COLUMN role TYPE app_role USING 
    CASE 
      WHEN role::text = 'administrador' THEN 'administrador'::app_role
      WHEN role::text = 'ventas' THEN 'admin_ventas'::app_role
      WHEN role::text = 'compras' THEN 'gerente'::app_role
      ELSE 'gerente'::app_role
    END;

DROP TYPE app_role_old;

-- Recreate has_role function with new enum
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Recreate RLS policies
CREATE POLICY "Admins can view all roles" 
ON user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can insert roles" 
ON user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can update roles" 
ON user_roles 
FOR UPDATE 
USING (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can delete roles" 
ON user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'administrador'::app_role));