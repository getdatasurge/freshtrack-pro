

# Fix: TTN Send Downlink Base64 Decoding Error

## Problem

When sending a downlink command, the edge function fails with:
```
InvalidCharacterError: Failed to decode base64
```

The error occurs at line 181 in `deobfuscateKey()`:
```typescript
const decoded = atob(encrypted);  // "b64:somedata" is not valid base64!
```

## Root Cause

The `ttn-send-downlink` function has its own local `deobfuscateKey` implementation that only handles the legacy XOR format:

| Stored Format | Local Function | Shared Function |
|---------------|----------------|-----------------|
| `b64:abc...`  | Fails - tries `atob("b64:...")` | Works - strips prefix, decodes |
| `v2:xyz...`   | Fails - tries `atob("v2:...")` | Works - strips prefix, XOR decodes |
| Plain base64  | Works | Works |

The TTN API keys in your database use the `b64:` prefix format (introduced to bypass XOR corruption issues), but the local function doesn't recognize this prefix.

## Fix

Replace the local `deobfuscateKey` function with an import from the shared module `_shared/ttnConfig.ts`, which correctly handles all obfuscation formats.

### File: supabase/functions/ttn-send-downlink/index.ts

**Remove lines 180-191** (local deobfuscateKey function):
```typescript
// DELETE THIS:
function deobfuscateKey(encrypted: string, salt: string): string {
  const decoded = atob(encrypted);
  const result: string[] = [];
  for (let i = 0; i < decoded.length; i++) {
    result.push(
      String.fromCharCode(
        decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length)
      )
    );
  }
  return result.join("");
}
```

**Add import at line 26** (with other ttnConfig imports):
```typescript
import {
  hexToBase64,
  buildCommand,
  type BuiltCommand,
} from "../_shared/downlinkCommands.ts";
import { deobfuscateKey } from "../_shared/ttnConfig.ts";  // ADD THIS
```

## Technical Details

### Shared deobfuscateKey Flow

The shared function (lines 293-319 in ttnConfig.ts) handles all formats:

```text
Input: "b64:TlJOUy5aMjRE..."
       ↓
Detects "b64:" prefix
       ↓
Strips prefix → "TlJOUy5aMjRE..."
       ↓
Base64 decode → raw bytes
       ↓
TextDecoder → API key string
```

### Why This Happened

The `ttn-send-downlink` function was created before the versioned obfuscation system was finalized. It copied an early version of the deobfuscation logic instead of importing from the shared module.

### No Database Changes Required

The fix is purely in the edge function code. The stored TTN API keys are valid and don't need updating.

## After Fix

Clicking preset buttons (Power Saver, Standard, Debug) will successfully:
1. Decode the TTN API key using the correct format
2. Build the downlink command hex payload
3. Send the REPLACE downlink to TTN
4. Record the pending change for tracking

