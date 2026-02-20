-- ============================================================
-- DUAL DECODER ARCHITECTURE
-- Migration: 20260220100000_dual_decoder_architecture.sql
--
-- Adds repo-sourced and user-override decoder columns to
-- sensor_catalog, enabling a dual-decoder system:
--
--   repo_decoder_js    -- canonical decoder from lorawan-devices repo
--   user_decoder_js    -- operator override (if repo decoder is wrong)
--   active_decoder_source -- which decoder is actually used at runtime
--
-- The existing decoder_js / decoder_code column is NOT modified
-- or dropped. It remains as the legacy/original column.
--
-- NOTE: Dragino LHT65N does not yet have a row in sensor_catalog.
-- When it is added, its repo_decoder_js should be populated then.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ADD NEW COLUMNS
-- ============================================================

ALTER TABLE sensor_catalog
  ADD COLUMN IF NOT EXISTS repo_decoder_js TEXT,
  ADD COLUMN IF NOT EXISTS repo_decoder_source TEXT,
  ADD COLUMN IF NOT EXISTS repo_decoder_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_decoder_js TEXT,
  ADD COLUMN IF NOT EXISTS user_decoder_notes TEXT,
  ADD COLUMN IF NOT EXISTS user_decoder_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS repo_test_fixtures JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS active_decoder_source TEXT DEFAULT 'repo'
    CHECK (active_decoder_source IN ('repo', 'user', 'ttn_only'));


-- ============================================================
-- 2. POPULATE repo_decoder_js FOR KNOWN SENSORS
-- ============================================================

-- ------------------------------------------------------------
-- 2a. Dragino LHT65
-- ------------------------------------------------------------
UPDATE sensor_catalog
SET
  repo_decoder_js = $decoder_lht65$
function str_pad(byte) {
  var zero = '00';
  var hex = byte.toString(16);
  var tmp = 2 - hex.length;
  return zero.substr(0, tmp) + hex + ' ';
}

function decodeUplink(input) {
  var port = input.fPort;
  var bytes = input.bytes;
  var Ext = bytes[6] & 0x0f;
  var poll_message_status = (bytes[6] & 0x40) >> 6;
  var Connect = (bytes[6] & 0x80) >> 7;
  var data = {};
  switch (input.fPort) {
    case 2:
      if (Ext == 0x09) {
        data.TempC_DS = parseFloat(((((bytes[0] << 24) >> 16) | bytes[1]) / 100).toFixed(2));
        data.Bat_status = bytes[4] >> 6;
      } else {
        data.BatV = (((bytes[0] << 8) | bytes[1]) & 0x3fff) / 1000;
        data.Bat_status = bytes[0] >> 6;
      }
      if (Ext != 0x0f) {
        data.TempC_SHT = parseFloat(((((bytes[2] << 24) >> 16) | bytes[3]) / 100).toFixed(2));
        data.Hum_SHT = parseFloat(((((bytes[4] << 8) | bytes[5]) & 0xfff) / 10).toFixed(1));
      }
      if (Connect == '1') { data.No_connect = 'Sensor no connection'; }
      if (Ext == '0') { data.Ext_sensor = 'No external sensor'; }
      else if (Ext == '1') {
        data.Ext_sensor = 'Temperature Sensor';
        data.TempC_DS = parseFloat(((((bytes[7] << 24) >> 16) | bytes[8]) / 100).toFixed(2));
      } else if (Ext == '4') {
        data.Work_mode = 'Interrupt Sensor send';
        data.Exti_pin_level = bytes[7] ? 'High' : 'Low';
        data.Exti_status = bytes[8] ? 'True' : 'False';
      } else if (Ext == '5') {
        data.Work_mode = 'Illumination Sensor';
        data.ILL_lx = (bytes[7] << 8) | bytes[8];
      } else if (Ext == '6') {
        data.Work_mode = 'ADC Sensor';
        data.ADC_V = ((bytes[7] << 8) | bytes[8]) / 1000;
      } else if (Ext == '7') {
        data.Work_mode = 'Interrupt Sensor count';
        data.Exit_count = (bytes[7] << 8) | bytes[8];
      } else if (Ext == '8') {
        data.Work_mode = 'Interrupt Sensor count';
        data.Exit_count = (bytes[7] << 24) | (bytes[8] << 16) | (bytes[9] << 8) | bytes[10];
      } else if (Ext == '9') {
        data.Work_mode = 'DS18B20 & timestamp';
        data.Systimestamp = (bytes[7] << 24) | (bytes[8] << 16) | (bytes[9] << 8) | bytes[10];
      } else if (Ext == '15') {
        data.Work_mode = 'DS18B20ID';
        data.ID = str_pad(bytes[2]) + str_pad(bytes[3]) + str_pad(bytes[4]) + str_pad(bytes[5]) + str_pad(bytes[7]) + str_pad(bytes[8]) + str_pad(bytes[9]) + str_pad(bytes[10]);
      }
      if (poll_message_status === 0) {
        if (bytes.length == 11) { return { data: data }; }
      }
      break;
    default:
      return { errors: ['unknown FPort'] };
  }
}
$decoder_lht65$,
  repo_decoder_source = 'TheThingsNetwork/lorawan-devices @ 0db7de316',
  repo_decoder_updated_at = now(),
  active_decoder_source = 'ttn_only',
  repo_test_fixtures = '[{"description":"Temperature","fPort":2,"bytes":"CBF60B0D037601 0ADD7FFF","expectedOutput":{"BatV":3.062,"Bat_status":3,"Ext_sensor":"Temperature Sensor","Hum_SHT":88.6,"TempC_DS":27.81,"TempC_SHT":28.29}}]'::jsonb
WHERE manufacturer = 'Dragino' AND model = 'LHT65';


-- ------------------------------------------------------------
-- 2b. Dragino LDS02
-- ------------------------------------------------------------
UPDATE sensor_catalog
SET
  repo_decoder_js = $decoder_lds02$
function decodeUplink(input) {
  var port = input.fPort;
  var bytes = input.bytes;
  var value = ((bytes[0] << 8) | bytes[1]) & 0x3fff;
  var bat = value / 1000;
  var door_open_status = bytes[0] & 0x80 ? 1 : 0;
  var water_leak_status = bytes[0] & 0x40 ? 1 : 0;
  var mod = bytes[2];
  var alarm = bytes[9] & 0x01;
  var data = {};
  switch (input.fPort) {
    case 10:
      if (mod == 1) {
        var open_times = (bytes[3] << 16) | (bytes[4] << 8) | bytes[5];
        var open_duration = (bytes[6] << 16) | (bytes[7] << 8) | bytes[8];
        (data.BAT_V = bat), (data.MOD = mod), (data.DOOR_OPEN_STATUS = door_open_status), (data.DOOR_OPEN_TIMES = open_times), (data.LAST_DOOR_OPEN_DURATION = open_duration), (data.ALARM = alarm);
      } else if (mod == 2) {
        var leak_times = (bytes[3] << 16) | (bytes[4] << 8) | bytes[5];
        var leak_duration = (bytes[6] << 16) | (bytes[7] << 8) | bytes[8];
        (data.BAT_V = bat), (data.MOD = mod), (data.WATER_LEAK_STATUS = water_leak_status), (data.WATER_LEAK_TIMES = leak_times), (data.LAST_WATER_LEAK_DURATION = leak_duration);
      } else if (mod == 3) {
        (data.BAT_V = bat), (data.MOD = mod), (data.DOOR_OPEN_STATUS = door_open_status), (data.WATER_LEAK_STATUS = water_leak_status), (data.ALARM = alarm);
      } else {
        (data.BAT_V = bat), (data.MOD = mod);
      }
      return { data: data };
    default:
      return { errors: ['unknown FPort'] };
  }
}
$decoder_lds02$,
  repo_decoder_source = 'TheThingsNetwork/lorawan-devices @ 0db7de316',
  repo_decoder_updated_at = now(),
  active_decoder_source = 'ttn_only',
  repo_test_fixtures = '[{"description":"Distance Detection","fPort":10,"bytes":"0B8801002500 01","expectedOutput":{"ALARM":0,"BAT_V":2.952,"DOOR_OPEN_STATUS":0,"DOOR_OPEN_TIMES":9472,"LAST_DOOR_OPEN_DURATION":65536,"MOD":1}}]'::jsonb
WHERE manufacturer = 'Dragino' AND model = 'LDS02';


-- ------------------------------------------------------------
-- 2c. Elsys ERS CO2
-- ------------------------------------------------------------
UPDATE sensor_catalog
SET
  repo_decoder_js = $decoder_elsys$
/*
    ______ _       _______     _______
    |  ____| |     / ____\ \   / / ____|
    | |__  | |    | (___  \ \_/ / (___
    |  __| | |     \___ \  \   / \___ \
    | |____| |____ ____) |  | |  ____) |
    |______|______|_____/   |_| |_____/

    ELSYS simple payload decoder.
    Use it as it is or remove the bugs :)

    www.elsys.se
    peter@elsys.se

    Good-to-have links:
    https://www.elsys.se/en/elsys-payload/
    https://github.com/TheThingsNetwork/lorawan-devices/blob/master/vendor/elsys/elsys.js
    https://elsys.se/public/documents/Sensor_payload.pdf
*/

// Constants for sensor data types
const SENSOR_DATA_TYPES = {
    TEMP: 0x01, // Temperature Sensor: 2 bytes, range -3276.8C to 3276.7C.
    RH: 0x02, // Humidity Sensor: 1 byte, percentage range 0-100%.
    ACC: 0x03, // Accelerometer: 3 bytes for X, Y, Z axes, range -128 to 127, where +/-63 equals 1G.
    LIGHT: 0x04, // Light Sensor: 2 bytes, luminosity range 0 to 65535 Lux.
    MOTION: 0x05, // Motion Sensor: 1 byte, counts the number of motions detected, range 0-255.
    CO2: 0x06, // CO2 Sensor: 2 bytes, CO2 concentration range 0-65535 ppm (parts per million).
    VDD: 0x07, // Battery Voltage: 2 bytes, voltage level range 0-65535mV.
    ANALOG1: 0x08, // Analog Input 1: 2 bytes, voltage measurement range 0-65535mV.
    GPS: 0x09, // GPS Location: 6 bytes, 3 bytes for latitude and 3 for longitude, stored in binary format.
    PULSE1: 0x0A, // Pulse Counter 1: 2 bytes, relative pulse count.
    PULSE1_ABS: 0x0B, // Pulse Counter 1 (Absolute Value): 4 bytes, absolute number of pulses, range 0 to 0xFFFFFFFF.
    EXT_TEMP1: 0x0C, // External Temperature Sensor 1: 2 bytes, range -3276.5C to 3276.5C.
    EXT_DIGITAL: 0x0D, // External Digital Input: 1 byte, value either 1 (high) or 0 (low).
    EXT_DISTANCE: 0x0E, // Distance Sensor: 2 bytes, measures distance in millimeters.
    ACC_MOTION: 0x0F, // Acceleration-based Motion Detection: 1 byte, number of detected movements.
    IR_TEMP: 0x10, // IR Temperature Sensor: 4 bytes, 2 for internal and 2 for external temperature, range -3276.5C to 3276.5C.
    OCCUPANCY: 0x11, // Occupancy Sensor: 1 byte, data indicating presence (not detailed).
    WATERLEAK: 0x12, // Water Leak Sensor: 1 byte, range 0-255 indicating leak strength or detection.
    GRIDEYE: 0x13, // Grid-Eye Sensor: 65 bytes, 1 byte for reference temperature and 64 bytes for external temperatures.
    PRESSURE: 0x14, // Pressure Sensor: 4 bytes, atmospheric pressure in hPa.
    SOUND: 0x15, // Sound Sensor: 2 bytes, capturing peak and average sound levels.
    PULSE2: 0x16, // Pulse Counter 2: 2 bytes, relative pulse count.
    PULSE2_ABS: 0x17, // Pulse Counter 2 (Absolute Value): 4 bytes, absolute number of pulses, range 0 to 0xFFFFFFFF.
    ANALOG2: 0x18, // Analog Input 2: 2 bytes, voltage measurement range 0-65535mV.
    EXT_TEMP2: 0x19, // External Temperature Sensor 2: 2 bytes, range -3276.5C to 3276.5C.
    EXT_DIGITAL2: 0x1A, // External Digital Input 2: 1 byte, value either 1 (high) or 0 (low).
    EXT_ANALOG_UV: 0x1B, // External Analog UV Sensor: 4 bytes, UV light intensity in signed integer (microvolts).
    TVOC: 0x1C, // Total Volatile Organic Compounds Sensor: 2 bytes, concentration in ppb (parts per billion).
    DEBUG: 0x3D, // Debug Information: 4 bytes, intended for diagnostics or debugging purposes.
};


// Helper functions for decoding binary data
function bin16dec(bin) {
    let num = bin & 0xffff;
    if (0x8000 & num) num = -(0x010000 - num);
    return num;
}

function bin8dec(bin) {
    let num = bin & 0xff;
    if (0x80 & num) num = -(0x0100 - num);
    return num;
}

function hexToBytes(hex) {
    let bytes = [];
    for (let c = 0; c < hex.length; c += 2) {
        bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return bytes;
}

// Main function to decode the ELSYS payload
function DecodeElsysPayload(data) {
    let obj = {};
    for (let i = 0; i < data.length; i++) {
        switch (data[i]) {
            // Case handlers for each sensor data type
            case SENSOR_DATA_TYPES.TEMP: // Decode temperature from 2 bytes, convert to real value in C.
                var temp = (data[i + 1] << 8) | (data[i + 2]);
                temp = bin16dec(temp);
                obj.temperature = temp / 10; // Temperature is in tenths of a degree.
                i += 2;
                break;
            case SENSOR_DATA_TYPES.RH: // Decode relative humidity from 1 byte, value in percentage.
                var rh = data[i + 1];
                obj.humidity = rh; // Humidity percentage, 0 to 100%.
                i += 1;
                break;
            case SENSOR_DATA_TYPES.ACC: // Decode 3-axis acceleration, values in Gs, from 3 bytes.
                obj.x = bin8dec(data[i + 1]); // X-axis acceleration.
                obj.y = bin8dec(data[i + 2]); // Y-axis acceleration.
                obj.z = bin8dec(data[i + 3]); // Z-axis acceleration.
                i += 3;
                break;
            case SENSOR_DATA_TYPES.LIGHT: // Decode light intensity from 2 bytes, value in Lux.
                obj.light = (data[i + 1] << 8) | (data[i + 2]);
                i += 2;
                break;
            case SENSOR_DATA_TYPES.MOTION: // Decode motion count from 1 byte, number of detected movements.
                obj.motion = data[i + 1];
                i += 1;
                break;
            case SENSOR_DATA_TYPES.CO2: // Decode CO2 concentration from 2 bytes, value in ppm.
                obj.co2 = (data[i + 1] << 8) | (data[i + 2]);
                i += 2;
                break;
            case SENSOR_DATA_TYPES.VDD: // Decode battery voltage level from 2 bytes, value in mV.
                obj.vdd = (data[i + 1] << 8) | (data[i + 2]);
                i += 2;
                break;
            case SENSOR_DATA_TYPES.ANALOG1: // Decode analog input 1 from 2 bytes, value in mV.
                obj.analog1 = (data[i + 1] << 8) | (data[i + 2]);
                i += 2;
                break;
            case SENSOR_DATA_TYPES.GPS: // Decode GPS coordinates from 6 bytes, converted to decimal degrees.
                i++;
                obj.lat = (data[i + 0] | data[i + 1] << 8 | data[i + 2] << 16 | (data[i + 2] & 0x80 ? 0xFF << 24 : 0)) / 10000;
                obj.long = (data[i + 3] | data[i + 4] << 8 | data[i + 5] << 16 | (data[i + 5] & 0x80 ? 0xFF << 24 : 0)) / 10000;
                i += 5;
                break;
            case SENSOR_DATA_TYPES.PULSE1: // Decode pulse input 1 from 2 bytes, relative pulse count.
                obj.pulse1 = (data[i + 1] << 8) | (data[i + 2]);
                i += 2;
                break;
            case SENSOR_DATA_TYPES.PULSE1_ABS: // Decode absolute value of pulse input 1 from 4 bytes.
                var pulseAbs = (data[i + 1] << 24) | (data[i + 2] << 16) | (data[i + 3] << 8) | (data[i + 4]);
                obj.pulseAbs = pulseAbs;
                i += 4;
                break;
            case SENSOR_DATA_TYPES.EXT_TEMP1: // Decode external temperature from 2 bytes, convert to real value in C.
                var temp = (data[i + 1] << 8) | (data[i + 2]);
                temp = bin16dec(temp);
                obj.externalTemperature = temp / 10; // External temperature in tenths of a degree.
                i += 2;
                break;
            case SENSOR_DATA_TYPES.EXT_DIGITAL: // Decode external digital input from 1 byte, value 1 or 0.
                obj.digital = data[i + 1];
                i += 1;
                break;
            case SENSOR_DATA_TYPES.EXT_DISTANCE: // Decode distance sensor input from 2 bytes, value in mm.
                obj.distance = (data[i + 1] << 8) | (data[i + 2]);
                i += 2;
                break;
            case SENSOR_DATA_TYPES.ACC_MOTION: // Decode acceleration-based motion detection from 1 byte.
                obj.accMotion = data[i + 1]; // Number of detected movements via accelerometer.
                i += 1;
                break;
            case SENSOR_DATA_TYPES.IR_TEMP: // Decode IR temperatures: internal and external, from 4 bytes, convert to C.
                var iTemp = (data[i + 1] << 8) | (data[i + 2]);
                iTemp = bin16dec(iTemp); // Internal temperature.
                var eTemp = (data[i + 3] << 8) | (data[i + 4]);
                eTemp = bin16dec(eTemp); // External temperature.
                obj.irInternalTemperature = iTemp / 10; // Converted to real temperature value.
                obj.irExternalTemperature = eTemp / 10; // Converted to real temperature value.
                i += 4;
                break;
            case SENSOR_DATA_TYPES.OCCUPANCY: // Decode occupancy from 1 byte, presence detected or not.
                obj.occupancy = data[i + 1]; // Occupancy data, binary presence indication.
                i += 1;
                break;
            case SENSOR_DATA_TYPES.WATERLEAK: // Decode water leak detection from 1 byte.
                obj.waterleak = data[i + 1]; // Water leak data, 0-255 indicating the detection level.
                i += 1;
                break;
            case SENSOR_DATA_TYPES.GRIDEYE: // Decode Grid-Eye sensor data: 1 byte reference temperature + 64 bytes external temperatures.
                var ref = data[i + 1];
                i++;
                obj.grideye = []; // Array to store temperature data.
                for (var j = 0; j < 64; j++) {
                    obj.grideye[j] = ref + (data[1 + i + j] / 10.0); // Calculate each temperature point.
                }
                i += 64;
                break;
            case SENSOR_DATA_TYPES.PRESSURE: // Decode atmospheric pressure from 4 bytes, value in hPa.
                var temp = (data[i + 1] << 24) | (data[i + 2] << 16) | (data[i + 3] << 8) | (data[i + 4]);
                obj.pressure = temp / 1000; // Convert to hPa.
                i += 4;
                break;
            case SENSOR_DATA_TYPES.SOUND: // Decode sound levels from 2 bytes: peak and average sound levels.
                obj.soundPeak = data[i + 1]; // Peak sound level.
                obj.soundAvg = data[i + 2]; // Average sound level.
                i += 2;
                break;
            case SENSOR_DATA_TYPES.PULSE2: // Decode pulse input 2 from 2 bytes, relative pulse count.
                obj.pulse2 = (data[i + 1] << 8) | (data[i + 2]);
                i += 2;
                break;
            case SENSOR_DATA_TYPES.PULSE2_ABS: // Decode absolute value of pulse input 2 from 4 bytes.
                obj.pulseAbs2 = (data[i + 1] << 24) | (data[i + 2] << 16) | (data[i + 3] << 8) | (data[i + 4]);
                i += 4;
                break;
            case SENSOR_DATA_TYPES.ANALOG2: // Decode analog input 2 from 2 bytes, value in mV.
                obj.analog2 = (data[i + 1] << 8) | (data[i + 2]);
                i += 2;
                break;
            case SENSOR_DATA_TYPES.EXT_TEMP2: // Decode and manage external temperature 2 data from 2 bytes, convert to C.
                var temp = (data[i + 1] << 8) | (data[i + 2]);
                temp = bin16dec(temp); // Convert binary to decimal.
                // Ensure externalTemperature2 is properly handled as an array if multiple readings exist.
                if (typeof obj.externalTemperature2 === "number") {
                    obj.externalTemperature2 = [obj.externalTemperature2];
                }
                if (Array.isArray(obj.externalTemperature2)) {
                    obj.externalTemperature2.push(temp / 10);
                } else {
                    obj.externalTemperature2 = temp / 10;
                }
                i += 2;
                break;
            case SENSOR_DATA_TYPES.EXT_DIGITAL2: // Decode external digital input 2 from 1 byte, value 1 or 0.
                obj.digital2 = data[i + 1];
                i += 1;
                break;
            case SENSOR_DATA_TYPES.EXT_ANALOG_UV: // Decode load cell analog data in microvolts (uV) from 4 bytes.
                obj.analogUv = (data[i + 1] << 24) | (data[i + 2] << 16) | (data[i + 3] << 8) | (data[i + 4]);
                i += 4;
                break;
            case SENSOR_DATA_TYPES.TVOC: // Decode Total Volatile Organic Compounds (TVOC) from 2 bytes, value in parts per billion (ppb).
                obj.tvoc = (data[i + 1] << 8) | (data[i + 2]);
                i += 2; // Move past the bytes used for TVOC data.
                break;
            default: // Case to handle unknown or invalid sensor data types.
                i = data.length; // If an unrecognized type is encountered, skip to the end of the data array to avoid processing invalid data.
                break;

        }
    }
    return obj;
}

function decodeUplink(input) {
    return {
        "data": DecodeElsysPayload(input.bytes)
    }
}

function normalizeUplink(input) {
    var data = {};
    var air = {};
    var action = {};
    var motion = {};

    if (input.data.temperature) {
        air.temperature = input.data.temperature;
    }

    if (input.data.humidity) {
        air.relativeHumidity = input.data.humidity;
    }

    if (input.data.light) {
        air.lightIntensity = input.data.light;
    }

    if (input.data.motion) {
        motion.detected = input.data.motion > 0;
        motion.count = input.data.motion;
        action.motion = motion;
    }

    if (Object.keys(air).length > 0) {
        data.air = air;
    }

    if (Object.keys(action).length > 0) {
        data.action = action;
    }

    return { data: data };
}
$decoder_elsys$,
  repo_decoder_source = 'TheThingsNetwork/lorawan-devices @ 0db7de316',
  repo_decoder_updated_at = now(),
  active_decoder_source = 'repo',
  repo_test_fixtures = '[{"description":"ERS CO2 temperature, humidity, light, motion and co2","fPort":1,"bytes":"0100E202290400270506060308","expectedOutput":{"temperature":22.6,"humidity":41,"light":39,"motion":6,"co2":776}}]'::jsonb
WHERE manufacturer = 'Elsys' AND model = 'ERS CO2';


-- ------------------------------------------------------------
-- 2d. Netvox R311A
-- ------------------------------------------------------------
UPDATE sensor_catalog
SET
  repo_decoder_js = $decoder_r311a$
function getCfgCmd(cfgcmd){
  var cfgcmdlist = {
    1:   "ConfigReportReq",
    129: "ConfigReportRsp",
    2:   "ReadConfigReportReq",
    130: "ReadConfigReportRsp"
  };
  return cfgcmdlist[cfgcmd];
}

function getDeviceName(dev){
  var deviceName = {
	2:   "R311A",
    29:  "R718F",
	125: "R730F"
  };
  return deviceName[dev];
}

function getCmdToID(cmdtype){
  if (cmdtype == "ConfigReportReq")
	  return 1;
  else if (cmdtype == "ConfigReportRsp")
	  return 129;
  else if (cmdtype == "ReadConfigReportReq")
	  return 2;
  else if (cmdtype == "ReadConfigReportRsp")
	  return 130;
}

function getDeviceType(devName){
  if (devName == "R311A")
	  return 2;
  else if (devName == "R718F")
	  return 29;
  else if (devName == "R730F")
	  return 125;
}

function padLeft(str, len) {
    str = '' + str;
    if (str.length >= len) {
        return str;
    } else {
        return padLeft("0" + str, len);
    }
}

function decodeUplink(input) {
  var data = {};
  switch (input.fPort) {
    case 6:
		if (input.bytes[2] === 0x00)
		{
			data.Device = getDeviceName(input.bytes[1]);
			data.SWver =  input.bytes[3]/10;
			data.HWver =  input.bytes[4];
			data.Datecode = padLeft(input.bytes[5].toString(16), 2) + padLeft(input.bytes[6].toString(16), 2) + padLeft(input.bytes[7].toString(16), 2) + padLeft(input.bytes[8].toString(16), 2);

			return {
				data: data,
			};
		}
		data.Device = getDeviceName(input.bytes[1]);
		if (input.bytes[3] & 0x80)
		{
			var tmp_v = input.bytes[3] & 0x7F;
			data.Volt = (tmp_v / 10).toString() + '(low battery)';
		}
		else
			data.Volt = input.bytes[3]/10;

		data.OnOff = input.bytes[4];

		break;

	case 7:
		data.Device = getDeviceName(input.bytes[1]);
		if (input.bytes[0] === 0x81)
		{
			data.Cmd = getCfgCmd(input.bytes[0]);
			data.Status = (input.bytes[2] === 0x00) ? 'Success' : 'Failure';
		}
		else if (input.bytes[0] === 0x82)
		{
			data.Cmd = getCfgCmd(input.bytes[0]);
			data.MinTime = (input.bytes[2]<<8 | input.bytes[3]);
			data.MaxTime = (input.bytes[4]<<8 | input.bytes[5]);
			data.BatteryChange = input.bytes[6]/10;
		}
		break;

	default:
      return {
        errors: ['unknown FPort'],
      };

    }


	 return {
		data: data,
	};
 }

function encodeDownlink(input) {
  var ret = [];
  var devid;
  var port;
  var getCmdID;

  getCmdID = getCmdToID(input.data.Cmd);
  devid = getDeviceType(input.data.Device);

  if (input.data.Cmd == "ConfigReportReq")
  {
	  var mint = input.data.MinTime;
	  var maxt = input.data.MaxTime;
	  var batteryChg = input.data.BatteryChange * 10;

	  port = 7;
	  ret = ret.concat(getCmdID, devid, (mint >> 8), (mint & 0xFF), (maxt >> 8), (maxt & 0xFF), batteryChg, 0x00, 0x00, 0x00, 0x00);
  }
  else if (input.data.Cmd == "ReadConfigReportReq")
  {
	  port = 7;
	  ret = ret.concat(getCmdID, devid, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
  }

  return {
    fPort: port,
    bytes: ret
  };
}

function decodeDownlink(input) {
  var data = {};
  switch (input.fPort) {
    case 7:
		data.Device = getDeviceName(input.bytes[1]);
		if (input.bytes[0] === getCmdToID("ConfigReportReq"))
		{
			data.Cmd = getCfgCmd(input.bytes[0]);
			data.MinTime = (input.bytes[2]<<8 | input.bytes[3]);
			data.MaxTime = (input.bytes[4]<<8 | input.bytes[5]);
			data.BatteryChange = input.bytes[6]/10;
		}
		else if (input.bytes[0] === getCmdToID("ReadConfigReportReq"))
		{
			data.Cmd = getCfgCmd(input.bytes[0]);
		}
		break;

    default:
      return {
        errors: ['invalid FPort'],
      };
  }

  return {
		data: data,
	};
}
$decoder_r311a$,
  repo_decoder_source = 'TheThingsNetwork/lorawan-devices @ 0db7de316',
  repo_decoder_updated_at = now(),
  active_decoder_source = 'repo',
  repo_test_fixtures = '[{"description":"Startup version report","fPort":6,"bytes":"01020064 0B20200424 0000","expectedOutput":{"Device":"R311A","SWver":10,"HWver":11,"Datecode":"20200424"}},{"description":"Status report","fPort":6,"bytes":"0102011E01000000000000","expectedOutput":{"Device":"R311A","Volt":3,"OnOff":1}}]'::jsonb
WHERE manufacturer = 'Netvox' AND model = 'R311A';


-- ============================================================
-- 3. SET ttn_only FOR SENSORS WITHOUT A REPO DECODER
--
-- Any sensor that still has repo_decoder_js = NULL after the
-- updates above should fall back to ttn_only, since there is
-- no local decoder to execute. This covers LWL02 and any
-- future sensors added without a repo decoder.
-- ============================================================

UPDATE sensor_catalog
SET active_decoder_source = 'ttn_only'
WHERE repo_decoder_js IS NULL;


COMMIT;
