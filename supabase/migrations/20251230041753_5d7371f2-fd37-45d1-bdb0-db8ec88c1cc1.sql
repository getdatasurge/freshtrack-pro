-- Add soft delete columns to areas table (missing is_active, deleted_at, deleted_by)
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add soft delete columns to devices table (missing deleted_at, deleted_by - already has is_active via status)
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Add deleted_at and deleted_by to units (already has is_active)
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Add deleted_at and deleted_by to sites (already has is_active)
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Create indexes for efficient querying of deleted items
CREATE INDEX IF NOT EXISTS idx_units_deleted ON public.units(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_areas_deleted ON public.areas(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sites_deleted ON public.sites(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_deleted ON public.devices(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create composite index for recently deleted queries
CREATE INDEX IF NOT EXISTS idx_units_org_deleted ON public.units(area_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_areas_site_deleted ON public.areas(site_id, deleted_at) WHERE deleted_at IS NOT NULL;