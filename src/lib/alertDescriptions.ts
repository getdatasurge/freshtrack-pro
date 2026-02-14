/**
 * Alert Inline Documentation — Structured descriptions for each alert type.
 *
 * Used by AlertTypeInfoCard to provide contextual help explaining
 * what each alert means, what triggers it, and how to fix it.
 */

export interface AlertDescription {
  whatItMeans: string;
  triggeredWhen: string;
  howToFix: string[];
  autoResolvesWhen: string;
  severity: "Critical" | "Warning" | "Info";
  relatedSettings: string;
}

export const ALERT_DESCRIPTIONS: Record<string, AlertDescription> = {
  alarm_active: {
    whatItMeans:
      "The unit's temperature has exceeded its configured alarm limits. This typically indicates a hardware-level alarm triggered by the sensor or monitoring device itself.",
    triggeredWhen:
      "The sensor reports a temperature reading outside the configured high/low alarm limits, and the reading persists past the confirmation period (default 5 minutes with door closed, 15 minutes with door open).",
    howToFix: [
      "Check the unit immediately — verify the door is closed and sealed properly",
      "Inspect the cooling system: is the compressor running? Are fans operating?",
      "Check for obstructions blocking airflow inside the unit",
      "If the unit was recently opened for stocking, allow time for recovery",
      "Acknowledge the alert and log a corrective action once addressed",
    ],
    autoResolvesWhen:
      "The temperature returns within the configured range and stays there past the hysteresis period (default 2°F buffer).",
    severity: "Critical",
    relatedSettings: "Alert Rules > Temperature Alarm Limits",
  },

  temp_excursion: {
    whatItMeans:
      "The unit's temperature is outside its safe range but hasn't reached full alarm thresholds yet. This is an early warning that conditions are deteriorating.",
    triggeredWhen:
      "A temperature reading falls outside the configured safe range. With the door closed, the excursion is confirmed after the closed-door confirmation period. With the door open, a longer grace period applies.",
    howToFix: [
      "Verify the door is fully closed and the gasket is sealing properly",
      "Check if the unit was recently opened for stocking or cleaning",
      "Monitor the temperature trend — if it's rising, investigate the cooling system",
      "Ensure nothing is blocking the vents or condenser coils",
      "If the excursion persists beyond 30 minutes, treat it as urgent",
    ],
    autoResolvesWhen:
      "The temperature returns within the configured safe range.",
    severity: "Warning",
    relatedSettings: "Alert Rules > Excursion Confirmation Times",
  },

  monitoring_interrupted: {
    whatItMeans:
      "The sensor has stopped sending data. This could mean the sensor lost power, lost network connectivity, or experienced a hardware failure.",
    triggeredWhen:
      "The sensor misses its expected check-in interval. A warning fires after the configured missed check-in threshold (default: 1 missed), and escalates to critical after more misses (default: 5 missed).",
    howToFix: [
      "Check if the sensor is powered on and the LED is blinking",
      "Verify the LoRaWAN gateway is online and within range",
      "Check the sensor's battery level — it may need replacement",
      "Move the sensor closer to the gateway if signal is weak",
      "Restart the sensor by removing and reinserting the battery",
      "Check the TTN console for any device-level errors",
    ],
    autoResolvesWhen:
      "The sensor resumes sending data and a new reading is received.",
    severity: "Warning",
    relatedSettings: "Alert Rules > Offline Detection (Missed Check-ins)",
  },

  missed_manual_entry: {
    whatItMeans:
      "A manual temperature log is overdue for this unit. Manual logging is required when the unit doesn't have an automated sensor or when compliance policies require periodic manual verification.",
    triggeredWhen:
      "No manual temperature reading has been logged within the configured interval (default: 4 hours), AND the unit has missed enough automated check-ins to indicate it needs manual monitoring.",
    howToFix: [
      "Log a temperature reading using a calibrated thermometer",
      "Navigate to the unit page and click 'Log Temperature'",
      "If the unit has an automated sensor, investigate why it stopped reporting",
      "Review the manual logging schedule with your compliance officer",
    ],
    autoResolvesWhen:
      "A manual temperature reading is logged for the unit.",
    severity: "Critical",
    relatedSettings: "Alert Rules > Manual Check-in Interval",
  },

  low_battery: {
    whatItMeans:
      "The sensor's battery is running low and will need replacement soon. Continued low battery can lead to missed readings and monitoring gaps.",
    triggeredWhen:
      "The sensor reports a battery voltage below the low threshold (typically 2.5V) or a battery percentage at or below 10%. A warning fires at 20% or below.",
    howToFix: [
      "Order a replacement battery (check the sensor model for the correct type)",
      "Schedule a battery replacement during a maintenance window",
      "Monitor the battery trend — a rapid decline may indicate a sensor issue",
      "After replacing, verify the sensor resumes normal reporting",
    ],
    autoResolvesWhen:
      "The sensor reports a battery level above 20% (e.g., after battery replacement).",
    severity: "Warning",
    relatedSettings: "Alert Rules > Battery Thresholds",
  },

  sensor_fault: {
    whatItMeans:
      "The sensor is reporting erroneous or impossible data, indicating a hardware malfunction. Readings from this sensor should not be trusted until the issue is resolved.",
    triggeredWhen:
      "The sensor reports temperature values outside physically possible ranges (above 300°F or below -100°F), or the uplink payload contains decoder errors.",
    howToFix: [
      "Check the sensor probe connection — ensure it's firmly attached",
      "Inspect the probe for physical damage (kinks, breaks, corrosion)",
      "Try repositioning the sensor probe away from direct contact with heating/cooling elements",
      "Restart the sensor by power-cycling it",
      "If the issue persists, replace the sensor or probe",
    ],
    autoResolvesWhen:
      "The sensor resumes reporting readings within normal physical ranges without decoder errors.",
    severity: "Critical",
    relatedSettings: "Alert Rules > Sensor Fault Detection",
  },

  door_open: {
    whatItMeans:
      "The unit's door has been left open longer than the allowed threshold. Extended door-open periods cause temperature rises and can compromise food safety.",
    triggeredWhen:
      "The door sensor reports the door has been open continuously for longer than the configured warning threshold (default: 3 minutes). Escalates to critical at the critical threshold (default: 10 minutes).",
    howToFix: [
      "Close the door immediately",
      "Check if the door is being held open by obstructions or a faulty latch",
      "Verify the door gasket is sealing properly — replace if damaged",
      "If the unit is being stocked, plan for shorter, more frequent door openings",
      "Monitor the temperature after closing — it should begin recovering",
    ],
    autoResolvesWhen:
      "The door sensor reports the door has been closed.",
    severity: "Warning",
    relatedSettings: "Alert Rules > Door Open Thresholds",
  },

  calibration_due: {
    whatItMeans:
      "The sensor is overdue for calibration verification. Regular calibration ensures temperature readings are accurate and compliant with food safety regulations.",
    triggeredWhen:
      "The time since the sensor's last calibration check exceeds the configured calibration interval.",
    howToFix: [
      "Schedule a calibration check using an NIST-traceable reference thermometer",
      "Compare the sensor reading to the reference at a known temperature (e.g., ice bath at 32°F)",
      "If the offset is within acceptable range (±1°F), record the calibration",
      "If the offset exceeds tolerance, adjust or replace the sensor",
      "Update the calibration date in the system after verification",
    ],
    autoResolvesWhen:
      "A calibration record is logged for the sensor.",
    severity: "Info",
    relatedSettings: "Alert Rules > Calibration Schedule",
  },

  suspected_cooling_failure: {
    whatItMeans:
      "The unit's temperature has been steadily rising while the door remains closed, suggesting the cooling system may have failed. This is a serious condition that requires immediate attention.",
    triggeredWhen:
      "The temperature shows a consistent upward trend over 45+ minutes with the door closed, indicating the compressor or cooling system is not maintaining temperature.",
    howToFix: [
      "Check the compressor — is it running? Listen for unusual sounds",
      "Verify the condenser coils are clean and unobstructed",
      "Check the evaporator fan is operating",
      "Inspect the thermostat/controller settings",
      "If the compressor isn't running, check the power supply and circuit breaker",
      "Consider moving perishable items to a backup unit while repairs are made",
      "Call a refrigeration technician if the issue can't be resolved quickly",
    ],
    autoResolvesWhen:
      "The temperature begins decreasing and returns to the safe range, indicating the cooling system has recovered.",
    severity: "Critical",
    relatedSettings: "Alert Rules > Cooling Failure Detection",
  },
};

/**
 * Get description for an alert type with fallback
 */
export function getAlertDescription(alertType: string): AlertDescription | null {
  return ALERT_DESCRIPTIONS[alertType] || null;
}
