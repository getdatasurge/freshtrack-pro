-- ============================================================================
-- Grant SELECT on decoder_confidence_rollup to authenticated users.
-- The view was created by 20260203100001 but without explicit GRANT,
-- so PostgREST cannot expose it to the frontend.
-- Also grants on sensor_catalog_public for consistency.
-- ============================================================================

-- Decoder confidence rollup (platform admins only, enforced by frontend routing)
GRANT SELECT ON public.decoder_confidence_rollup TO authenticated;
GRANT SELECT ON public.decoder_confidence_rollup TO anon;

-- Sensor catalog public view (org-level read access)
GRANT SELECT ON public.sensor_catalog_public TO authenticated;
GRANT SELECT ON public.sensor_catalog_public TO anon;

-- Sensor catalog table (already has RLS policies, but ensure role access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensor_catalog TO authenticated;

-- Notify PostgREST to reload its schema cache so new views are exposed
NOTIFY pgrst, 'reload schema';
