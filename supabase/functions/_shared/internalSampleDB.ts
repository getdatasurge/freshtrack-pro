/**
 * Internal Sample Database
 * 
 * Known payload structures for model inference.
 * When a sensor sends a decoded payload, we can match it against these
 * samples to infer the device model.
 */

export const knownSamples: Record<string, { decoded_payload: Record<string, unknown> }> = {
  // Door/Contact Sensors
  "LDS02": {
    decoded_payload: {
      door_status: "closed",
      battery_level: 90
    }
  },
  "R311A": {
    decoded_payload: {
      door: true,
      battery_voltage: 3.0
    }
  },
  "DS3604": {
    decoded_payload: {
      open_close: 0,
      battery_level: 95
    }
  },
  
  // Temperature Sensors
  "EM300-TH": {
    decoded_payload: {
      temperature: 22.1,
      humidity: 45.3,
      battery_level: 95
    }
  },
  "ERS": {
    decoded_payload: {
      temperature: 21.5,
      humidity: 50.0,
      battery_level: 100
    }
  },
  "EM500-PT100": {
    decoded_payload: {
      temperature: 25.0
    }
  },
  
  // Motion Sensors
  "TBMS100": {
    decoded_payload: {
      motion: true,
      battery_level: 85
    }
  },
  
  // Leak Detection
  "LDDS75": {
    decoded_payload: {
      water_leak: true,
      battery_level: 80
    }
  },
  "R718WA2": {
    decoded_payload: {
      leak: true,
      battery_voltage: 3.2
    }
  },
  
  // Air Quality
  "AM319": {
    decoded_payload: {
      temperature: 23.5,
      humidity: 50,
      co2: 450,
      tvoc: 120
    }
  },
  "ERS-CO2": {
    decoded_payload: {
      temperature: 22.0,
      humidity: 45,
      co2: 500
    }
  },
  "AM103": {
    decoded_payload: {
      temperature: 24.0,
      humidity: 55,
      co2: 420
    }
  },
  
  // GPS/Location
  "LT-22222-L": {
    decoded_payload: {
      latitude: 40.7128,
      longitude: -74.0060,
      battery_level: 75
    }
  },
  "TBS220": {
    decoded_payload: {
      gps: { lat: 40.7128, lon: -74.0060 },
      battery_level: 80
    }
  },
  
  // Metering/Pulse Counter
  "KONA Pulse Counter": {
    decoded_payload: {
      pulse_count: 1234,
      total_count: 5678
    }
  },
  "EM500-PP": {
    decoded_payload: {
      counter: 100,
      battery_level: 90
    }
  },
  
  // Multi-Sensor
  "EM300-MCS": {
    decoded_payload: {
      temperature: 22.0,
      humidity: 50,
      door_status: "closed",
      battery_level: 85
    }
  },
};
