# ⚠️ Legacy SQL Migrations Directory

This directory contains **legacy SQL migration scripts** that are **deprecated**.

## Current Status

- ✅ **TypeORM migrations are now the standard** (see `src/migrations/`)
- ⚠️ **SQL scripts in this directory are deprecated**
- 🗑️ **These files may be removed in future versions**

## Files in This Directory

- `001_create_saga_tables.sql` - Legacy SQL script for creating saga tables

## What to Use Instead

Use TypeORM migrations:

```bash
cd backend/services/payment-service
npm run migration:run
```

The TypeORM migration file is located at:

- `src/migrations/1765030767039-CreateSagaTables.ts`

## Why This Directory Exists

This directory was created before TypeORM migrations were set up. It's kept for:

- Backward compatibility
- Emergency fallback
- Reference purposes

## Migration Path

**New developers:** Use TypeORM migrations only.  
**Existing setups:** Can continue using SQL scripts temporarily, but should migrate to TypeORM.

---

**See Also:**

- [Database Migrations Guide](../../../../docs/DATABASE_MIGRATIONS_GUIDE.md)
- [Legacy Files Documentation](../../../../docs/LEGACY_FILES.md)
