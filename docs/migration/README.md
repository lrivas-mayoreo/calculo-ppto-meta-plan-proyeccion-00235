# Migración a Supabase Externo

## Pasos para la migración

### 1. Configurar tu proyecto Supabase
- URL: `https://tubjjcfakjifgdeloaqu.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2. Ejecutar los scripts SQL

En el **SQL Editor** de tu Supabase Dashboard, ejecuta los scripts en orden:

1. **`01_schema.sql`** - Crea todas las tablas, funciones y políticas RLS
2. **`02_data_profiles.sql`** - Referencia de usuarios (deben registrarse primero)

### 3. Importar datos

Los datos de clientes, marcas, vendedores, ventas y budgets están en el proyecto actual.
Para exportarlos en formato CSV:

1. Accede al SQL Editor de Lovable Cloud
2. Ejecuta: `SELECT * FROM clientes` y exporta como CSV
3. Repite para: `marcas`, `vendedores`, `ventas_reales`, `budgets`
4. Importa los CSV en tu Supabase externo

### 4. Crear usuarios

Los usuarios deben registrarse en tu nuevo proyecto Supabase.
Después de que se registren, asígnales roles:

```sql
INSERT INTO public.user_roles (user_id, role) 
VALUES ('uuid-del-usuario', 'administrador');
```

### 5. Configurar Edge Functions

Copia las Edge Functions del directorio `supabase/functions/` a tu proyecto Supabase.

### 6. Estadísticas de datos actuales

| Tabla | Registros aproximados |
|-------|----------------------|
| clientes | ~500+ |
| marcas | ~80+ |
| vendedores | ~50+ |
| ventas_reales | ~10,000+ |
| budgets | ~50+ |
| profiles | 5 |
| user_roles | 5 |

### 7. Notas importantes

- Los UUIDs de usuarios cambiarán al registrarse en el nuevo proyecto
- Actualiza el `user_id` en los datos importados según corresponda
- Configura las variables de entorno en tu proyecto
