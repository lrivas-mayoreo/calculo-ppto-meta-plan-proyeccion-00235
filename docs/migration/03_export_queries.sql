-- ============================================
-- QUERIES PARA EXPORTAR DATOS A CSV
-- Ejecuta estas queries en el SQL Editor de Lovable Cloud
-- y exporta cada resultado como CSV
-- ============================================

-- ==========================================
-- 1. EXPORTAR CLIENTES (575 registros)
-- ==========================================
SELECT 
    codigo,
    nombre
FROM clientes
ORDER BY codigo;

-- ==========================================
-- 2. EXPORTAR MARCAS (87 registros)
-- ==========================================
SELECT 
    codigo,
    nombre
FROM marcas
ORDER BY codigo;

-- ==========================================
-- 3. EXPORTAR VENDEDORES (57 registros)
-- ==========================================
SELECT 
    codigo,
    nombre
FROM vendedores
ORDER BY codigo;

-- ==========================================
-- 4. EXPORTAR BUDGETS (53 registros)
-- ==========================================
SELECT 
    empresa,
    marca,
    fecha_destino,
    presupuesto,
    role,
    vendor_adjustments
FROM budgets
ORDER BY created_at;

-- ==========================================
-- 5. EXPORTAR VENTAS REALES (193,503 registros)
-- NOTA: Ejecutar en lotes si es muy grande
-- ==========================================
SELECT 
    codigo_cliente,
    codigo_marca,
    codigo_vendedor,
    mes,
    monto
FROM ventas_reales
ORDER BY mes, codigo_cliente;

-- ==========================================
-- Para importar en tu Supabase externo:
-- 1. Usa el Table Editor > Import CSV
-- 2. O ejecuta COPY commands si tienes acceso SSH
-- ============================================
