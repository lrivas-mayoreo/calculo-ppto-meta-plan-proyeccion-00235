# Migración a Supabase Externo

## Pasos para la migración

### 1. Configurar tu proyecto Supabase
- URL: `https://tubjjcfakjifgdeloaqu.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2. Ejecutar los scripts SQL

En el **SQL Editor** de tu Supabase Dashboard, ejecuta los scripts en orden:

1. **`01_schema.sql`** - Crea todas las tablas, funciones y políticas RLS
2. **`02_data_profiles.sql`** - Referencia de usuarios (deben registrarse primero)

### 3. Exportar e Importar datos

Los datos actuales están en Lovable Cloud. Usa `03_export_queries.sql` para exportar:

| Tabla | Registros | Campos a exportar |
|-------|-----------|-------------------|
| clientes | 575 | codigo, nombre |
| marcas | 87 | codigo, nombre |
| vendedores | 57 | codigo, nombre |
| budgets | 53 | empresa, marca, fecha_destino, presupuesto, role, vendor_adjustments |
| ventas_reales | 193,503 | codigo_cliente, codigo_marca, codigo_vendedor, mes, monto |

**Proceso de importación en tu Supabase externo:**
1. Primero ejecuta `01_schema.sql` para crear las tablas
2. Registra un usuario administrador
3. Importa los CSV usando el Table Editor de Supabase
4. Actualiza el `user_id` en los datos importados con:
   ```sql
   UPDATE clientes SET user_id = 'TU_USER_UUID';
   UPDATE marcas SET user_id = 'TU_USER_UUID';
   UPDATE vendedores SET user_id = 'TU_USER_UUID';
   UPDATE ventas_reales SET user_id = 'TU_USER_UUID';
   UPDATE budgets SET user_id = 'TU_USER_UUID';
   ```

### 4. Crear usuarios

Los usuarios deben registrarse en tu nuevo proyecto Supabase.
Después de que se registren, asígnales roles:

```sql
INSERT INTO public.user_roles (user_id, role) 
VALUES ('uuid-del-usuario', 'administrador');
```

### 5. Configurar Edge Functions

Copia las Edge Functions del directorio `supabase/functions/` a tu proyecto Supabase:
- `bulk-import/index.ts`
- `import-data-batch/index.ts`
- `process-import-batch/index.ts`

### 6. Estadísticas de datos actuales

| Tabla | Registros exactos |
|-------|-------------------|
| clientes | 575 |
| marcas | 87 |
| vendedores | 57 |
| ventas_reales | 193,503 |
| budgets | 53 |
| profiles | 5 |
| user_roles | 5 |

### 7. Notas importantes

- Los UUIDs de usuarios cambiarán al registrarse en el nuevo proyecto
- Actualiza el `user_id` en los datos importados según corresponda
- Para ventas_reales (193k registros), considera importar en lotes
- Configura las variables de entorno en tu proyecto
