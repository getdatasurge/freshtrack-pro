/**
 * Layout Validation Tests
 * 
 * Tests for capability-based widget validation and layout validation.
 */

import { describe, it, expect } from 'vitest';
import { checkWidgetCompatibility, checkWidgetCompatibilityBySensorType } from '../utils/compatibilityMatrix';
import { WIDGET_REGISTRY } from '../registry/widgetRegistry';
import type { DeviceCapability } from '@/lib/registry/capabilityRegistry';

describe('Compatibility Matrix', () => {
  describe('checkWidgetCompatibility', () => {
    it('allows widget when all required capabilities present', () => {
      const result = checkWidgetCompatibility('door_activity', ['door', 'battery']);
      expect(result.compatible).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('blocks widget when required capability missing', () => {
      const result = checkWidgetCompatibility('door_activity', ['temperature', 'humidity']);
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('door');
    });

    it('allows widget with partial when optional capability missing', () => {
      const result = checkWidgetCompatibility('door_activity', ['door']);
      expect(result.compatible).toBe(true);
      expect(result.partial).toBe(true);
      expect(result.missingOptional).toContain('battery');
    });

    it('returns compatible for widgets with no requirements', () => {
      const result = checkWidgetCompatibility('alerts_banner', []);
      expect(result.compatible).toBe(true);
    });

    it('handles temperature chart requiring temperature', () => {
      const result = checkWidgetCompatibility('temperature_chart', ['temperature']);
      expect(result.compatible).toBe(true);
    });

    it('blocks humidity chart without humidity', () => {
      const result = checkWidgetCompatibility('humidity_chart', ['temperature']);
      expect(result.compatible).toBe(false);
      expect(result.missingRequired).toContain('humidity');
    });
  });

  describe('checkWidgetCompatibilityBySensorType', () => {
    it('maps door sensor type to door capability', () => {
      const result = checkWidgetCompatibilityBySensorType('door_activity', 'door');
      expect(result.compatible).toBe(true);
    });

    it('maps temperature sensor type to temperature capability', () => {
      const result = checkWidgetCompatibilityBySensorType('temperature_chart', 'temperature');
      expect(result.compatible).toBe(true);
    });

    it('returns incompatible when no sensor assigned', () => {
      const result = checkWidgetCompatibilityBySensorType('door_activity', undefined);
      expect(result.compatible).toBe(false);
      expect(result.reason).toBe('No sensor assigned');
    });
  });
});

describe('Widget Registry Contracts', () => {
  it('every widget MUST have requiredCapabilities defined', () => {
    Object.entries(WIDGET_REGISTRY).forEach(([id, widget]) => {
      expect(widget.requiredCapabilities).toBeDefined();
      expect(Array.isArray(widget.requiredCapabilities)).toBe(true);
    });
  });

  it('door_activity widget requires door capability', () => {
    const widget = WIDGET_REGISTRY['door_activity'];
    expect(widget.requiredCapabilities).toContain('door');
  });

  it('temperature_chart widget requires temperature capability', () => {
    const widget = WIDGET_REGISTRY['temperature_chart'];
    expect(widget.requiredCapabilities).toContain('temperature');
  });

  it('humidity_chart widget requires humidity capability', () => {
    const widget = WIDGET_REGISTRY['humidity_chart'];
    expect(widget.requiredCapabilities).toContain('humidity');
  });

  it('system widgets have no required capabilities', () => {
    const widget = WIDGET_REGISTRY['alerts_banner'];
    expect(widget.requiredCapabilities ?? []).toHaveLength(0);
  });
});
