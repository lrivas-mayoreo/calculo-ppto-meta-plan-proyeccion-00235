-- Asignar rol de administrador al primer usuario sin rol
-- Esta función se ejecutará una sola vez para inicializar el primer administrador

DO $$
DECLARE
  first_user_id uuid;
BEGIN
  -- Buscar el primer usuario que no tenga rol asignado
  SELECT u.id INTO first_user_id
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  WHERE ur.id IS NULL
  ORDER BY u.created_at ASC
  LIMIT 1;

  -- Si encontramos un usuario sin rol, asignarle el rol de administrador
  IF first_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (first_user_id, 'administrador'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Rol de administrador asignado al usuario: %', first_user_id;
  END IF;
END $$;