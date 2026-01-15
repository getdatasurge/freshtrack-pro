// Entity status configurations with tooltip explanations

export interface StatusTooltipInfo {
  meaning: string;
  systemState: string;
  userAction: string | null;
}

export interface EntityStatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
  tooltip: StatusTooltipInfo;
}

// SENSOR STATUS DEFINITIONS
export const SENSOR_STATUS_CONFIG: Record<string, EntityStatusConfig> = {
  pending: {
    label: "Pending Provisioning",
    variant: "secondary",
    tooltip: {
      meaning: "Sensor is registered but not yet provisioned to TTN",
      systemState: "Waiting for provisioning action",
      userAction: "Click the cloud upload icon to provision this sensor"
    }
  },
  joining: {
    label: "Awaiting Uplink",
    variant: "outline",
    className: "border-accent text-accent",
    tooltip: {
      meaning: "Device is provisioned in TTN but hasn't sent data yet",
      systemState: "Device is registered and ready to communicate",
      userAction: "Ensure device is powered and in range of a gateway"
    }
  },
  active: {
    label: "Active",
    variant: "default",
    className: "bg-green-600",
    tooltip: {
      meaning: "Device is connected and sending data successfully",
      systemState: "Normal operation",
      userAction: null
    }
  },
  offline: {
    label: "Offline",
    variant: "outline",
    className: "border-yellow-500 text-yellow-600",
    tooltip: {
      meaning: "Device was previously active but has stopped sending data",
      systemState: "No recent uplinks detected",
      userAction: "Check power, connectivity, or gateway availability"
    }
  },
  fault: {
    label: "Error",
    variant: "destructive",
    tooltip: {
      meaning: "Device encountered a configuration or network issue",
      systemState: "Failed join, invalid keys, or TTN error",
      userAction: "Review TTN configuration and re-sync if needed"
    }
  }
};

// GATEWAY STATUS DEFINITIONS
export const GATEWAY_STATUS_CONFIG: Record<string, EntityStatusConfig> = {
  online: {
    label: "Online",
    variant: "default",
    className: "bg-safe/15 text-safe border-safe/30",
    tooltip: {
      meaning: "Gateway is connected to TTN network",
      systemState: "Normal operation — receiving sensor data",
      userAction: null
    }
  },
  offline: {
    label: "Offline",
    variant: "outline",
    className: "bg-warning/15 text-warning border-warning/30",
    tooltip: {
      meaning: "Gateway is not responding to the network",
      systemState: "No heartbeat received from gateway",
      userAction: "Check power supply and internet connection"
    }
  },
  pending: {
    label: "Registered",
    variant: "secondary",
    tooltip: {
      meaning: "Gateway is registered but not yet connected",
      systemState: "Awaiting first connection to TTN",
      userAction: "Power on gateway and connect to network"
    }
  },
  maintenance: {
    label: "Maintenance",
    variant: "outline",
    className: "bg-muted text-muted-foreground border-border",
    tooltip: {
      meaning: "Gateway is temporarily disabled for maintenance",
      systemState: "Scheduled downtime or manual override",
      userAction: "Wait for maintenance to complete"
    }
  }
};

// COLUMN HEADER TOOLTIPS - SENSORS
export const SENSOR_COLUMN_TOOLTIPS = {
  name: "Friendly name used to identify this sensor in FrostGuard",
  devEui: "Unique identifier used by The Things Network to recognize this device",
  type: "Sensor category determines how data is interpreted and displayed",
  location: "Site where this sensor is installed",
  unit: "The specific equipment unit (refrigerator, freezer, etc.) this sensor is monitoring. Units must belong to the selected site.",
  status: "Current connectivity and provisioning state of the sensor",
  lastUplink: "The most recent time this sensor successfully sent data",
  ttnStatus: "Whether device exists in The Things Network"
};

// COLUMN HEADER TOOLTIPS - GATEWAYS
export const GATEWAY_COLUMN_TOOLTIPS = {
  name: "Friendly name used to identify this gateway",
  gatewayEui: "Unique identifier for the LoRaWAN gateway hardware",
  site: "Physical location where this gateway is installed",
  status: "Current connectivity state of the gateway"
};

// TTN PROVISIONING STATE DEFINITIONS
export interface TtnProvisioningStateConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
  tooltip: StatusTooltipInfo;
}

export const TTN_PROVISIONING_STATE_CONFIG: Record<string, TtnProvisioningStateConfig> = {
  exists_in_ttn: {
    label: "Provisioned",
    variant: "default",
    className: "bg-safe/15 text-safe border-safe/30",
    tooltip: {
      meaning: "Device exists in The Things Network",
      systemState: "Device is registered and can send/receive data",
      userAction: null
    }
  },
  missing_in_ttn: {
    label: "Not in TTN",
    variant: "outline",
    className: "bg-warning/15 text-warning border-warning/30",
    tooltip: {
      meaning: "Device not found in TTN application",
      systemState: "Device needs to be provisioned to TTN",
      userAction: "Click 'Provision' to register this device"
    }
  },
  unknown: {
    label: "Unknown",
    variant: "secondary",
    className: "bg-muted text-muted-foreground",
    tooltip: {
      meaning: "TTN status has not been checked",
      systemState: "Run 'Check TTN' to verify device status",
      userAction: "Click 'Check TTN' to detect if device exists"
    }
  },
  not_configured: {
    label: "Not Configured",
    variant: "outline",
    className: "bg-muted/50 text-muted-foreground border-border",
    tooltip: {
      meaning: "TTN is not configured or sensor is missing DevEUI",
      systemState: "Cannot check or provision without TTN configuration",
      userAction: "Configure TTN settings or add DevEUI to sensor"
    }
  },
  error: {
    label: "Check Failed",
    variant: "destructive",
    tooltip: {
      meaning: "Failed to check TTN status",
      systemState: "API error occurred during check",
      userAction: "Click 'Check TTN' to retry"
    }
  }
};

// Unit sensors card status config (simplified labels)
export const UNIT_SENSOR_STATUS_CONFIG: Record<string, { label: string; className: string; tooltip: StatusTooltipInfo }> = {
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
    tooltip: SENSOR_STATUS_CONFIG.pending.tooltip
  },
  joining: {
    label: "Joining",
    className: "bg-warning/20 text-warning",
    tooltip: SENSOR_STATUS_CONFIG.joining.tooltip
  },
  active: {
    label: "Active",
    className: "bg-safe/20 text-safe",
    tooltip: SENSOR_STATUS_CONFIG.active.tooltip
  },
  offline: {
    label: "Offline",
    className: "bg-warning/20 text-warning",
    tooltip: SENSOR_STATUS_CONFIG.offline.tooltip
  },
  fault: {
    label: "Fault",
    className: "bg-alarm/20 text-alarm",
    tooltip: SENSOR_STATUS_CONFIG.fault.tooltip
  }
};
