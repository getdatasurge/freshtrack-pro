-- Fix security definer view issue for sensor_catalog_public
-- Recreate with security_invoker = true (PostgreSQL 15+)
DROP VIEW IF EXISTS sensor_catalog_public;

CREATE VIEW sensor_catalog_public 
WITH (security_invoker = true) AS
SELECT
  id, manufacturer, model, model_variant, display_name, sensor_kind,
  description, frequency_bands, f_ports, decoded_fields, uplink_info,
  battery_info, is_supported, tags, decode_mode, temperature_unit
FROM sensor_catalog
WHERE is_visible = true AND deprecated_at IS NULL
ORDER BY sort_order, manufacturer, model;

-- Fix search_path for the new functions
CREATE OR REPLACE FUNCTION update_sensor_catalog_on_change()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.revision = OLD.revision + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION search_sensor_catalog(search_term text)
RETURNS SETOF sensor_catalog AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM sensor_catalog
  WHERE
    to_tsvector('english', coalesce(manufacturer,'') || ' ' || coalesce(model,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,''))
    @@ plainto_tsquery('english', search_term)
    OR manufacturer ILIKE '%' || search_term || '%'
    OR model ILIKE '%' || search_term || '%'
    OR search_term = ANY(tags)
  ORDER BY sort_order, manufacturer, model;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;