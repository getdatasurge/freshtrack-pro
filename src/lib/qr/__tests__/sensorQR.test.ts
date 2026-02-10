import { describe, it, expect } from 'vitest';
import {
  encodeCredentials,
  decodeCredentials,
  hexToBytes,
  bytesToBase45,
  base45ToBytes,
  isValidHex,
  cleanHex,
  formatEUI,
  buildModelKey,
  parseModelKey,
} from '../sensorQR';

describe('sensorQR', () => {
  const testCreds = {
    serial_number: 'LHT65N-001',
    dev_eui: 'A840415A61897757',
    app_eui: 'A840410000000107',
    app_key: '2B7E151628AED2A6ABF7158809CF4F3C',
    model_key: '',
  };

  const testCredsV2 = {
    ...testCreds,
    model_key: 'Dragino/LHT65',
  };

  describe('Base45 round-trip', () => {
    it('encodes and decodes 32 bytes correctly', () => {
      const bytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) bytes[i] = i * 7 + 3;
      const encoded = bytesToBase45(bytes);
      const decoded = base45ToBytes(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(bytes));
    });

    it('produces only QR-alphanumeric characters', () => {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const encoded = bytesToBase45(bytes);
      const validChars = /^[0-9A-Z $%*+\-.\/:]+$/;
      expect(encoded).toMatch(validChars);
    });
  });

  describe('V1 encodeCredentials / decodeCredentials (no model)', () => {
    it('round-trips credentials correctly', () => {
      const encoded = encodeCredentials(testCreds);
      const decoded = decodeCredentials(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded!.dev_eui).toBe(testCreds.dev_eui);
      expect(decoded!.app_eui).toBe(testCreds.app_eui);
      expect(decoded!.app_key).toBe(testCreds.app_key);
      expect(decoded!.model_key).toBe('');
    });

    it('produces compact output starting with F', () => {
      const encoded = encodeCredentials(testCreds);
      expect(encoded).toMatch(/^F/);
      expect(encoded.length).toBeLessThanOrEqual(55);
    });

    it('serial is NOT in the QR payload', () => {
      const encoded = encodeCredentials(testCreds);
      expect(encoded).not.toContain('LHT65N');
      expect(encoded).not.toContain('001');
    });
  });

  describe('V2 encodeCredentials / decodeCredentials (with model)', () => {
    it('round-trips credentials with model_key correctly', () => {
      const encoded = encodeCredentials(testCredsV2);
      const decoded = decodeCredentials(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded!.dev_eui).toBe(testCredsV2.dev_eui);
      expect(decoded!.app_eui).toBe(testCredsV2.app_eui);
      expect(decoded!.app_key).toBe(testCredsV2.app_key);
      expect(decoded!.model_key).toBe('Dragino/LHT65');
    });

    it('produces output starting with G prefix', () => {
      const encoded = encodeCredentials(testCredsV2);
      expect(encoded).toMatch(/^G/);
    });

    it('model_key is embedded in the QR payload', () => {
      const encoded = encodeCredentials(testCredsV2);
      const decoded = decodeCredentials(encoded);
      expect(decoded!.model_key).toBe('Dragino/LHT65');
    });

    it('serial is NOT in the V2 QR payload', () => {
      const encoded = encodeCredentials(testCredsV2);
      expect(encoded).not.toContain('LHT65N');
    });

    it('handles various model key lengths', () => {
      const short = { ...testCreds, model_key: 'X/Y' };
      const long = { ...testCreds, model_key: 'SomeManufacturer/SomeLongModelName' };

      const enc1 = encodeCredentials(short);
      const dec1 = decodeCredentials(enc1);
      expect(dec1!.model_key).toBe('X/Y');

      const enc2 = encodeCredentials(long);
      const dec2 = decodeCredentials(enc2);
      expect(dec2!.model_key).toBe('SomeManufacturer/SomeLongModelName');
    });
  });

  describe('model key helpers', () => {
    it('builds model key from manufacturer and model', () => {
      expect(buildModelKey('Dragino', 'LHT65')).toBe('Dragino/LHT65');
      expect(buildModelKey('Elsys', 'ERS CO2')).toBe('Elsys/ERS CO2');
    });

    it('parses model key into manufacturer and model', () => {
      const parsed = parseModelKey('Dragino/LHT65');
      expect(parsed).not.toBeNull();
      expect(parsed!.manufacturer).toBe('Dragino');
      expect(parsed!.model).toBe('LHT65');
    });

    it('handles model names with slashes', () => {
      const parsed = parseModelKey('Acme/Model/V2');
      expect(parsed).not.toBeNull();
      expect(parsed!.manufacturer).toBe('Acme');
      expect(parsed!.model).toBe('Model/V2');
    });

    it('returns null for invalid keys', () => {
      expect(parseModelKey('')).toBeNull();
      expect(parseModelKey('noSlash')).toBeNull();
      expect(parseModelKey('/noManufacturer')).toBeNull();
    });
  });

  describe('legacy format support', () => {
    it('decodes FG1 hex format', () => {
      const fg1 = 'FG1:LHT65N-001:A840415A61897757:A840410000000107:2B7E151628AED2A6ABF7158809CF4F3C';
      const decoded = decodeCredentials(fg1);
      expect(decoded).not.toBeNull();
      expect(decoded!.serial_number).toBe('LHT65N-001');
      expect(decoded!.dev_eui).toBe('A840415A61897757');
      expect(decoded!.model_key).toBe('');
    });

    it('decodes legacy JSON format', () => {
      const json = JSON.stringify({
        type: 'frostguard_sensor',
        serial: 'TEST-001',
        dev_eui: 'AABBCCDDEE001122',
        app_eui: '1122334455667788',
        app_key: 'AABBCCDDEE001122AABBCCDDEE001122',
      });
      const decoded = decodeCredentials(json);
      expect(decoded).not.toBeNull();
      expect(decoded!.serial_number).toBe('TEST-001');
      expect(decoded!.model_key).toBe('');
    });

    it('returns null for invalid data', () => {
      expect(decodeCredentials('random garbage')).toBeNull();
      expect(decodeCredentials('')).toBeNull();
      expect(decodeCredentials('FG1:incomplete')).toBeNull();
    });
  });

  describe('hex utilities', () => {
    it('validates hex strings correctly', () => {
      expect(isValidHex('A840415A61897757', 16)).toBe(true);
      expect(isValidHex('A8:40:41:5A:61:89:77:57', 16)).toBe(true);
      expect(isValidHex('A840', 16)).toBe(false);
      expect(isValidHex('ZZZZ415A61897757', 16)).toBe(false);
    });

    it('cleans hex input', () => {
      expect(cleanHex('a8:40:41:5a')).toBe('A840415A');
      expect(cleanHex('A8 40 41 5A')).toBe('A840415A');
    });

    it('formats EUI with colons', () => {
      expect(formatEUI('A840415A61897757')).toBe('A8:40:41:5A:61:89:77:57');
    });
  });
});
