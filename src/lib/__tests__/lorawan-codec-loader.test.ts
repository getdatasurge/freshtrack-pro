import { describe, it, expect, beforeEach } from 'vitest';
import {
  decodeUplink,
  encodeDownlink,
  getSupportedDevices,
  clearCodecCache,
} from '../lorawan-codec-loader';

describe('lorawan-codec-loader', () => {
  beforeEach(() => {
    clearCodecCache();
  });

  describe('decodeUplink', () => {
    it('decodes Dragino LHT65 temperature/humidity payload', () => {
      const bytes = [0xcb, 0xf6, 0x0b, 0x0d, 0x03, 0x76, 0x01, 0x0a, 0xdd, 0x7f, 0xff];
      const result = decodeUplink('DRAGINO_LHT65', bytes, 2);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data!.BatV).toBeCloseTo(3.062, 2);
      expect(result.data!.TempC_SHT).toBeCloseTo(28.29, 1);
      expect(result.data!.Hum_SHT).toBeCloseTo(88.6, 0);
      expect(result.data!.TempC_DS).toBeCloseTo(27.81, 1);
    });

    it('decodes Elsys ERS CO2 payload', () => {
      const bytes = [0x01, 0x00, 0xe2, 0x02, 0x29, 0x04, 0x00, 0x27, 0x05, 0x06, 0x06, 0x03, 0x08];
      const result = decodeUplink('ELSYS_ERS_CO2', bytes, 1);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data!.temperature).toBeCloseTo(22.6, 1);
      expect(result.data!.humidity).toBe(41);
      expect(result.data!.co2).toBe(776);
    });

    it('decodes Netvox R311A door/window payload', () => {
      const bytes = [0x01, 0x02, 0x01, 0x1e, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
      const result = decodeUplink('NETVOX_R311A', bytes, 6);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data!.Device).toBe('R311A');
      expect(result.data!.Volt).toBe(3);
      expect(result.data!.OnOff).toBe(1);
    });
  });

  describe('error handling', () => {
    it('throws for unknown sensor model', () => {
      expect(() => decodeUplink('UNKNOWN_SENSOR', [0x00], 1)).toThrowError(
        /Unknown sensor model.*UNKNOWN_SENSOR/
      );
    });
  });

  describe('getSupportedDevices', () => {
    it('returns the expected list of supported devices', () => {
      const devices = getSupportedDevices();
      expect(devices).toEqual([
        'DRAGINO_LHT65',
        'DRAGINO_LHT65N',
        'DRAGINO_LDS02',
        'NETVOX_R311A',
        'ELSYS_ERS_CO2',
      ]);
    });
  });

  describe('encodeDownlink', () => {
    it('returns null for codecs without encodeDownlink support', () => {
      const result = encodeDownlink('DRAGINO_LHT65', { command: 'test' });
      expect(result).toBeNull();
    });

    it('encodes downlink for Netvox R311A', () => {
      const result = encodeDownlink('NETVOX_R311A', {
        Cmd: 'ConfigReportReq',
        Device: 'R311A',
        MinTime: 10,
        MaxTime: 3600,
        BatteryChange: 1,
      });
      expect(result).not.toBeNull();
      expect(result!.fPort).toBe(7);
      expect(Array.isArray(result!.bytes)).toBe(true);
    });
  });
});
