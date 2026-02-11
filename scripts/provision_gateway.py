#!/usr/bin/env python3
"""
FrostGuard Gateway Provisioning Script
=======================================

Provisions LoRaWAN gateways on The Things Network (TTN) for FrostGuard.

Architecture ("Two Truths"):
  - EU1 hosts the global Identity Server (gateway registry)
  - NAM1 hosts the Gateway Server (radio plane, US region)
  - The gateway record on EU1 MUST point gateway_server_address to nam1

Steps:
  1. Register gateway on EU1 Identity Server (under user or org)
  2. Set gateway_server_address → nam1.cloud.thethings.network
  3. Create Gateway API Key with RIGHT_GATEWAY_LINK
  4. Set antenna location (optional)
  5. Generate LNS key file for Basics Station connection
  6. Optionally generate CUPS key file
  7. Store gateway config in FrostGuard Supabase DB

Usage:
  python provision_gateway.py --gateway-eui 00800000A00009EF --name "Walk-in Cooler GW" --org-id my-org-123
  python provision_gateway.py --interactive
  python provision_gateway.py --from-json gateway_config.json

Requirements:
  pip install requests supabase python-dotenv
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    print("Missing 'requests' package. Install with: pip install requests")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional

# =============================================================================
# THE TWO TRUTHS - Do not change without understanding the architecture
# =============================================================================

IDENTITY_BASE_URL = "https://eu1.cloud.thethings.network"    # Identity plane (global registry)
REGIONAL_BASE_URL = "https://nam1.cloud.thethings.network"   # Radio plane (US region)
NAM1_HOST = "nam1.cloud.thethings.network"                   # Gateway server address pointer

# =============================================================================
# DEFAULTS
# =============================================================================

DEFAULT_FREQUENCY_PLAN = "US_902_928_FSB_2"  # US 915 MHz, FSB2
SCRIPT_VERSION = "fg-provision-gateway-v1.0-20260211"

# =============================================================================
# COLORS FOR TERMINAL OUTPUT
# =============================================================================

class C:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"

def banner():
    print(f"""
{C.CYAN}{C.BOLD}╔══════════════════════════════════════════════════════╗
║         FrostGuard Gateway Provisioning              ║
║         {C.DIM}TTN Cross-Cluster • v1.0{C.RESET}{C.CYAN}{C.BOLD}                      ║
╚══════════════════════════════════════════════════════╝{C.RESET}
""")

def step_ok(step: str, msg: str):
    print(f"  {C.GREEN}✓{C.RESET} {C.BOLD}{step}{C.RESET}: {msg}")

def step_fail(step: str, msg: str):
    print(f"  {C.RED}✗{C.RESET} {C.BOLD}{step}{C.RESET}: {msg}")

def step_info(step: str, msg: str):
    print(f"  {C.CYAN}→{C.RESET} {C.BOLD}{step}{C.RESET}: {msg}")

def step_warn(step: str, msg: str):
    print(f"  {C.YELLOW}⚠{C.RESET} {C.BOLD}{step}{C.RESET}: {msg}")


# =============================================================================
# TTN HTTP HELPER
# =============================================================================

class TTNClient:
    """HTTP client for TTN v3 REST API with cross-cluster support."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": SCRIPT_VERSION,
        })

    def _request(self, method: str, url: str, payload: dict = None) -> dict:
        """Make an HTTP request and return parsed JSON response."""
        try:
            resp = self.session.request(method, url, json=payload, timeout=30)
            body = resp.json() if resp.text else {}
            return {"status": resp.status_code, "body": body, "ok": resp.ok}
        except requests.exceptions.RequestException as e:
            return {"status": 0, "body": {"error": str(e)}, "ok": False}
        except json.JSONDecodeError:
            return {"status": resp.status_code, "body": {"raw": resp.text}, "ok": False}

    # ── Identity Server (EU1) ────────────────────────────────────────────

    def get_gateway(self, gateway_id: str) -> dict:
        """Check if a gateway already exists on the Identity Server."""
        url = (
            f"{IDENTITY_BASE_URL}/api/v3/gateways/{gateway_id}"
            f"?field_mask=ids,name,frequency_plan_ids,gateway_server_address,"
            f"antennas,status_public,location_public,enforce_duty_cycle,"
            f"require_authenticated_connection"
        )
        return self._request("GET", url)

    def register_gateway_for_user(self, user_id: str, gateway: dict) -> dict:
        """Register a gateway under a user on the Identity Server (EU1)."""
        url = f"{IDENTITY_BASE_URL}/api/v3/users/{user_id}/gateways"
        return self._request("POST", url, {"gateway": gateway})

    def register_gateway_for_org(self, org_id: str, gateway: dict) -> dict:
        """Register a gateway under a TTN organization on the Identity Server (EU1)."""
        url = f"{IDENTITY_BASE_URL}/api/v3/organizations/{org_id}/gateways"
        return self._request("POST", url, {"gateway": gateway})

    def update_gateway(self, gateway_id: str, gateway: dict, field_mask: list) -> dict:
        """Update gateway fields on the Identity Server."""
        url = f"{IDENTITY_BASE_URL}/api/v3/gateways/{gateway_id}"
        payload = {
            "gateway": {**gateway, "ids": {"gateway_id": gateway_id}},
            "field_mask": {"paths": field_mask},
        }
        return self._request("PUT", url, payload)

    def delete_gateway(self, gateway_id: str) -> dict:
        """Delete a gateway from the Identity Server."""
        url = f"{IDENTITY_BASE_URL}/api/v3/gateways/{gateway_id}"
        return self._request("DELETE", url)

    def purge_gateway(self, gateway_id: str) -> dict:
        """Hard-delete (purge) a gateway from the Identity Server."""
        url = f"{IDENTITY_BASE_URL}/api/v3/gateways/{gateway_id}/purge"
        return self._request("DELETE", url)

    # ── Gateway API Keys ─────────────────────────────────────────────────

    def create_gateway_api_key(self, gateway_id: str, name: str, rights: list) -> dict:
        """Create an API key for a gateway (used for LNS/CUPS connection)."""
        url = f"{IDENTITY_BASE_URL}/api/v3/gateways/{gateway_id}/api-keys"
        payload = {
            "name": name,
            "rights": rights,
        }
        return self._request("POST", url, payload)

    def list_gateway_api_keys(self, gateway_id: str) -> dict:
        """List existing API keys for a gateway."""
        url = f"{IDENTITY_BASE_URL}/api/v3/gateways/{gateway_id}/api-keys"
        return self._request("GET", url)

    # ── Gateway Server (NAM1) ────────────────────────────────────────────

    def get_gateway_connection_stats(self, gateway_id: str) -> dict:
        """Get gateway connection stats from the Gateway Server (NAM1)."""
        url = f"{REGIONAL_BASE_URL}/api/v3/gs/gateways/{gateway_id}/connection/stats"
        return self._request("GET", url)


# =============================================================================
# PROVISIONING STEPS
# =============================================================================

class GatewayProvisioner:
    """Orchestrates the multi-step gateway provisioning process."""

    def __init__(self, api_key: str):
        self.client = TTNClient(api_key)
        self.results = []

    def _record(self, step: str, success: bool, msg: str, data: dict = None):
        self.results.append({
            "step": step,
            "success": success,
            "message": msg,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        if success:
            step_ok(step, msg)
        else:
            step_fail(step, msg)

    def provision(
        self,
        gateway_id: str,
        gateway_eui: str,
        name: str,
        owner_id: str,
        owner_type: str = "user",  # "user" or "org"
        frequency_plan: str = DEFAULT_FREQUENCY_PLAN,
        latitude: float = None,
        longitude: float = None,
        altitude: float = None,
        location_public: bool = False,
        status_public: bool = False,
        enforce_duty_cycle: bool = True,
        require_authenticated: bool = True,
        generate_lns_key: bool = True,
        generate_cups_key: bool = False,
        output_dir: str = ".",
        fg_org_id: str = None,
        fg_site_id: str = None,
    ) -> dict:
        """
        Full gateway provisioning flow.
        Returns dict with all provisioning results and generated credentials.
        """
        print(f"\n{C.BOLD}Provisioning gateway: {gateway_id}{C.RESET}")
        print(f"{C.DIM}  EUI: {gateway_eui} | Owner: {owner_type}/{owner_id}{C.RESET}")
        print(f"{C.DIM}  Frequency: {frequency_plan} | Region: NAM1{C.RESET}\n")

        credentials = {}

        # ── Step 1: Check if gateway already exists ──────────────────────
        step_info("Step 1", "Checking if gateway already exists on EU1 Identity Server...")
        existing = self.client.get_gateway(gateway_id)

        if existing["ok"]:
            step_warn("Step 1", f"Gateway '{gateway_id}' already exists. Skipping registration.")
            self._record("check_existing", True, "Gateway already registered", existing["body"])
        elif existing["status"] == 404:
            step_ok("Step 1", "Gateway not found — ready to register")
        else:
            # Could be permissions error, etc.
            step_warn("Step 1", f"Unexpected response ({existing['status']}): {existing['body']}")

        # ── Step 2: Register gateway on EU1 Identity Server ──────────────
        if not existing["ok"]:
            step_info("Step 2", f"Registering gateway under {owner_type} '{owner_id}' on EU1...")

            gateway_payload = {
                "ids": {
                    "gateway_id": gateway_id,
                    "eui": gateway_eui,
                },
                "name": name,
                "frequency_plan_ids": [frequency_plan],
                "gateway_server_address": NAM1_HOST,  # ← THE KEY CROSS-CLUSTER POINTER
                "enforce_duty_cycle": enforce_duty_cycle,
                "require_authenticated_connection": require_authenticated,
                "status_public": status_public,
                "location_public": location_public,
            }

            if owner_type == "org":
                result = self.client.register_gateway_for_org(owner_id, gateway_payload)
            else:
                result = self.client.register_gateway_for_user(owner_id, gateway_payload)

            if result["ok"]:
                self._record("register", True,
                             f"Gateway registered on EU1 → gateway_server_address: {NAM1_HOST}",
                             result["body"])
            else:
                self._record("register", False,
                             f"Registration failed ({result['status']}): {json.dumps(result['body'], indent=2)}")
                return self._summary(gateway_id, credentials)
        else:
            # Gateway exists — verify the gateway_server_address points to NAM1
            gw_data = existing["body"]
            gw_server = gw_data.get("gateway_server_address", "")
            if gw_server != NAM1_HOST:
                step_warn("Step 2", f"gateway_server_address is '{gw_server}', updating to '{NAM1_HOST}'...")
                update_result = self.client.update_gateway(
                    gateway_id,
                    {"gateway_server_address": NAM1_HOST},
                    ["gateway_server_address"],
                )
                if update_result["ok"]:
                    self._record("update_server_address", True,
                                 f"Updated gateway_server_address → {NAM1_HOST}")
                else:
                    self._record("update_server_address", False,
                                 f"Failed to update: {update_result['body']}")
            else:
                step_ok("Step 2", f"gateway_server_address already correct: {NAM1_HOST}")

        # ── Step 3: Set antenna location (optional) ──────────────────────
        if latitude is not None and longitude is not None:
            step_info("Step 3", "Setting antenna location...")
            location_payload = {
                "antennas": [{
                    "location": {
                        "latitude": latitude,
                        "longitude": longitude,
                        "altitude": altitude or 0,
                        "source": "SOURCE_REGISTRY",
                    }
                }]
            }
            loc_result = self.client.update_gateway(
                gateway_id, location_payload, ["antennas"]
            )
            if loc_result["ok"]:
                self._record("set_location", True,
                             f"Location set: {latitude}, {longitude}, alt {altitude or 0}m")
            else:
                self._record("set_location", False,
                             f"Failed: {loc_result['body']}")
        else:
            step_info("Step 3", "No location provided — skipping")

        # ── Step 4: Create LNS API Key ───────────────────────────────────
        if generate_lns_key:
            step_info("Step 4", "Creating LNS API key (RIGHT_GATEWAY_LINK)...")
            lns_result = self.client.create_gateway_api_key(
                gateway_id,
                f"FrostGuard LNS Key - {datetime.now(timezone.utc).strftime('%Y%m%d')}",
                ["RIGHT_GATEWAY_LINK"],
            )
            if lns_result["ok"]:
                lns_key = lns_result["body"].get("key", "")
                lns_key_id = lns_result["body"].get("id", "")
                credentials["lns_key"] = lns_key
                credentials["lns_key_id"] = lns_key_id
                self._record("create_lns_key", True,
                             f"LNS key created (ID: {lns_key_id})")

                # Generate lns.key file for Basics Station
                lns_key_path = Path(output_dir) / f"{gateway_id}_lns.key"
                lns_key_path.write_text(f"Authorization: Bearer {lns_key}\r\n")
                step_ok("Step 4b", f"LNS key file written: {lns_key_path}")
                credentials["lns_key_file"] = str(lns_key_path)
            else:
                self._record("create_lns_key", False,
                             f"Failed: {lns_result['body']}")

        # ── Step 5: Create CUPS API Key (optional) ───────────────────────
        if generate_cups_key:
            step_info("Step 5", "Creating CUPS API key...")
            cups_rights = [
                "RIGHT_GATEWAY_INFO",
                "RIGHT_GATEWAY_SETTINGS_BASIC",
                "RIGHT_GATEWAY_READ_SECRETS",
            ]
            cups_result = self.client.create_gateway_api_key(
                gateway_id,
                f"FrostGuard CUPS Key - {datetime.now(timezone.utc).strftime('%Y%m%d')}",
                cups_rights,
            )
            if cups_result["ok"]:
                cups_key = cups_result["body"].get("key", "")
                cups_key_id = cups_result["body"].get("id", "")
                credentials["cups_key"] = cups_key
                credentials["cups_key_id"] = cups_key_id
                self._record("create_cups_key", True,
                             f"CUPS key created (ID: {cups_key_id})")

                # Generate cups.key file
                cups_key_path = Path(output_dir) / f"{gateway_id}_cups.key"
                cups_key_path.write_text(f"Authorization: Bearer {cups_key}\r\n")
                step_ok("Step 5b", f"CUPS key file written: {cups_key_path}")
                credentials["cups_key_file"] = str(cups_key_path)
            else:
                self._record("create_cups_key", False,
                             f"Failed: {cups_result['body']}")
        else:
            step_info("Step 5", "CUPS key generation skipped (use --cups to enable)")

        # ── Step 6: Verify gateway is reachable on NAM1 ──────────────────
        step_info("Step 6", "Checking gateway status on NAM1 Gateway Server...")
        time.sleep(1)  # Brief pause for propagation
        stats = self.client.get_gateway_connection_stats(gateway_id)
        if stats["ok"]:
            self._record("verify_nam1", True, "Gateway is connected on NAM1!")
        elif stats["status"] == 404:
            self._record("verify_nam1", True,
                         "Gateway registered but not yet connected (expected — connect your hardware)")
        else:
            self._record("verify_nam1", False,
                         f"Could not verify on NAM1 ({stats['status']}): {stats['body']}")

        # ── Step 7: Store in FrostGuard DB (Supabase) ────────────────────
        if fg_org_id:
            step_info("Step 7", "Storing gateway config in FrostGuard database...")
            db_result = self._store_in_supabase(
                gateway_id=gateway_id,
                gateway_eui=gateway_eui,
                name=name,
                fg_org_id=fg_org_id,
                fg_site_id=fg_site_id,
                frequency_plan=frequency_plan,
            )
            if db_result:
                self._record("store_db", True, "Gateway stored in FrostGuard DB")
            else:
                self._record("store_db", False, "Failed to store in FrostGuard DB (check Supabase credentials)")
        else:
            step_info("Step 7", "No FrostGuard org_id provided — skipping DB storage")

        # ── Step 8: Generate connection instructions ─────────────────────
        self._print_connection_info(gateway_id, credentials, frequency_plan)

        return self._summary(gateway_id, credentials)

    def _store_in_supabase(self, **kwargs) -> bool:
        """Store gateway configuration in FrostGuard's Supabase database.

        Maps to the `gateways` table schema:
          - organization_id  UUID NOT NULL  (FK → organizations)
          - site_id          UUID           (FK → sites, nullable)
          - gateway_eui      TEXT NOT NULL
          - name             TEXT NOT NULL
          - description      TEXT
          - status           gateway_status (pending|online|degraded|offline|maintenance)
          - ttn_gateway_id   TEXT           (TTN gateway ID, e.g. "eui-<gateway_eui>")
          - ttn_registered_at TIMESTAMPTZ
          Unique constraint: (organization_id, gateway_eui)
        """
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            step_warn("DB", "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
            return False

        try:
            from supabase import create_client
            supabase = create_client(supabase_url, supabase_key)

            data = {
                "organization_id": kwargs["fg_org_id"],
                "gateway_eui": kwargs["gateway_eui"],
                "name": kwargs["name"],
                "ttn_gateway_id": kwargs["gateway_id"],
                "status": "pending",
                "ttn_registered_at": datetime.now(timezone.utc).isoformat(),
                "description": (
                    f"Provisioned via {SCRIPT_VERSION} | "
                    f"freq: {kwargs['frequency_plan']} | cluster: nam1"
                ),
            }

            # Only include site_id if provided
            if kwargs.get("fg_site_id"):
                data["site_id"] = kwargs["fg_site_id"]

            result = supabase.table("gateways").upsert(
                data, on_conflict="organization_id,gateway_eui"
            ).execute()

            return bool(result.data)
        except ImportError:
            step_warn("DB", "supabase package not installed. pip install supabase")
            return False
        except Exception as e:
            step_warn("DB", f"Supabase error: {e}")
            return False

    def _print_connection_info(self, gateway_id: str, credentials: dict, freq_plan: str):
        """Print gateway connection instructions for the user."""
        lns_key = credentials.get("lns_key", "N/A")
        print(f"""
{C.CYAN}{C.BOLD}═══════════════════════════════════════════════════════
  Gateway Connection Information
═══════════════════════════════════════════════════════{C.RESET}

{C.BOLD}Gateway ID:{C.RESET}     {gateway_id}
{C.BOLD}Freq Plan:{C.RESET}      {freq_plan}
{C.BOLD}Region:{C.RESET}         NAM1 (US)

{C.BOLD}── Basics Station (LNS) ──{C.RESET}
  Server URL:     wss://{NAM1_HOST}:8887
  LNS Key:        {lns_key[:30]}...{lns_key[-10:] if len(lns_key) > 40 else lns_key}

{C.BOLD}── Semtech UDP Packet Forwarder ──{C.RESET}
  Server:         {NAM1_HOST}
  Up Port:        1700
  Down Port:      1700

{C.BOLD}── CUPS (if enabled) ──{C.RESET}
  Server URL:     https://{NAM1_HOST}:443
  Trust:          Let's Encrypt ISRG Root X1
""")
        if credentials.get("cups_key"):
            cups_key = credentials["cups_key"]
            print(f"  CUPS Key:       {cups_key[:30]}...{cups_key[-10:] if len(cups_key) > 40 else cups_key}")

        print(f"""
{C.YELLOW}{C.BOLD}⚠ SAVE YOUR API KEYS NOW — they cannot be retrieved later.{C.RESET}
{C.DIM}  Key files have been written to the output directory.{C.RESET}
""")

    def _summary(self, gateway_id: str, credentials: dict) -> dict:
        """Build and print a summary of all provisioning steps."""
        success_count = sum(1 for r in self.results if r["success"])
        total_count = len(self.results)

        print(f"\n{C.BOLD}Summary: {success_count}/{total_count} steps succeeded{C.RESET}")

        # Write full provisioning log
        log = {
            "gateway_id": gateway_id,
            "script_version": SCRIPT_VERSION,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "architecture": {
                "identity_server": IDENTITY_BASE_URL,
                "gateway_server": REGIONAL_BASE_URL,
                "gateway_server_address": NAM1_HOST,
            },
            "steps": self.results,
            "credentials": {
                "lns_key_id": credentials.get("lns_key_id"),
                "cups_key_id": credentials.get("cups_key_id"),
                # Keys themselves NOT logged for security
            },
        }

        log_path = Path(f"{gateway_id}_provision_log.json")
        log_path.write_text(json.dumps(log, indent=2))
        step_info("Log", f"Provisioning log saved: {log_path}")

        return log


# =============================================================================
# DEPROVISIONING
# =============================================================================

def deprovision_gateway(api_key: str, gateway_id: str, purge: bool = False):
    """Remove a gateway from TTN. Follows safe deletion order."""
    client = TTNClient(api_key)

    print(f"\n{C.BOLD}{C.RED}Deprovisioning gateway: {gateway_id}{C.RESET}\n")

    # Step 1: Check it exists
    check = client.get_gateway(gateway_id)
    if not check["ok"]:
        step_fail("Check", f"Gateway not found: {check['body']}")
        return False

    step_ok("Check", f"Found gateway: {check['body'].get('name', gateway_id)}")

    # Step 2: Delete
    delete = client.delete_gateway(gateway_id)
    if delete["ok"] or delete["status"] == 200:
        step_ok("Delete", "Gateway soft-deleted from Identity Server")
    else:
        step_fail("Delete", f"Failed: {delete['body']}")
        return False

    # Step 3: Purge (hard delete, prevents orphan issues)
    if purge:
        time.sleep(1)
        purge_result = client.purge_gateway(gateway_id)
        if purge_result["ok"] or purge_result["status"] == 200:
            step_ok("Purge", "Gateway hard-deleted (EUI released for reuse)")
        else:
            step_fail("Purge", f"Failed: {purge_result['body']}")
            return False

    # Step 4: Verify
    verify = client.get_gateway(gateway_id)
    if verify["status"] == 404:
        step_ok("Verify", "Gateway confirmed removed")
    else:
        step_warn("Verify", f"Gateway may still exist (status: {verify['status']})")

    print(f"\n{C.GREEN}Gateway '{gateway_id}' deprovisioned successfully.{C.RESET}\n")
    return True


# =============================================================================
# STATUS CHECK
# =============================================================================

def check_gateway_status(api_key: str, gateway_id: str):
    """Check gateway registration and connection status across both clusters."""
    client = TTNClient(api_key)

    print(f"\n{C.BOLD}Gateway Status: {gateway_id}{C.RESET}\n")

    # Identity Server (EU1)
    step_info("EU1", "Checking Identity Server registration...")
    gw = client.get_gateway(gateway_id)
    if gw["ok"]:
        data = gw["body"]
        step_ok("EU1", f"Registered — Name: {data.get('name', 'N/A')}")
        step_info("EU1", f"  gateway_server_address: {data.get('gateway_server_address', 'NOT SET')}")
        step_info("EU1", f"  frequency_plan: {data.get('frequency_plan_ids', ['N/A'])}")
        step_info("EU1", f"  authenticated: {data.get('require_authenticated_connection', 'N/A')}")

        gw_server = data.get("gateway_server_address", "")
        if gw_server != NAM1_HOST:
            step_warn("EU1", f"⚠ gateway_server_address should be '{NAM1_HOST}' but is '{gw_server}'")
    else:
        step_fail("EU1", f"Not found ({gw['status']})")
        return

    # Gateway Server (NAM1)
    step_info("NAM1", "Checking Gateway Server connection...")
    stats = client.get_gateway_connection_stats(gateway_id)
    if stats["ok"]:
        data = stats["body"]
        step_ok("NAM1", "Gateway is CONNECTED")
        if "last_uplink_received_at" in data:
            step_info("NAM1", f"  Last uplink: {data['last_uplink_received_at']}")
        if "connected_at" in data:
            step_info("NAM1", f"  Connected since: {data['connected_at']}")
    elif stats["status"] == 404:
        step_warn("NAM1", "Gateway registered but NOT connected (hardware offline)")
    else:
        step_fail("NAM1", f"Could not check ({stats['status']}): {stats['body']}")

    # API Keys
    step_info("Keys", "Checking API keys...")
    keys = client.list_gateway_api_keys(gateway_id)
    if keys["ok"]:
        api_keys = keys["body"].get("api_keys", [])
        step_ok("Keys", f"{len(api_keys)} API key(s) found")
        for k in api_keys:
            rights = ", ".join(k.get("rights", []))
            step_info("Keys", f"  {k.get('name', 'unnamed')} [{rights}]")
    else:
        step_warn("Keys", f"Could not list keys ({keys['status']})")

    print()


# =============================================================================
# INTERACTIVE MODE
# =============================================================================

def interactive_provision(api_key: str = None):
    """Walk the user through gateway provisioning interactively."""
    print(f"{C.BOLD}Interactive Gateway Provisioning{C.RESET}\n")

    # ── API Key ──────────────────────────────────────────────────────────
    if not api_key:
        api_key = os.getenv("TTN_API_KEY", "").strip()

    if not api_key:
        print(f"{C.CYAN}You need a TTN API key with gateway registration rights.{C.RESET}")
        print(f"{C.DIM}  Get one from: https://eu1.cloud.thethings.network/console → Your profile → API Keys{C.RESET}")
        print(f"{C.DIM}  Grant: 'Grant all current and future rights' (recommended){C.RESET}\n")
        api_key = input("TTN API Key: ").strip()
        if not api_key:
            print(f"\n{C.RED}API key is required to continue.{C.RESET}")
            return

    print()

    # ── Action ───────────────────────────────────────────────────────────
    print(f"{C.BOLD}What would you like to do?{C.RESET}")
    print(f"  {C.CYAN}1{C.RESET}) Provision a new gateway")
    print(f"  {C.CYAN}2{C.RESET}) Check gateway status")
    print(f"  {C.CYAN}3{C.RESET}) Deprovision (remove) a gateway")
    print()
    action = input("Choose (1/2/3) [1]: ").strip() or "1"

    if action == "2":
        gw_id = input("\nGateway ID to check: ").strip()
        if gw_id:
            check_gateway_status(api_key, gw_id)
        return

    if action == "3":
        gw_id = input("\nGateway ID to remove: ").strip()
        if not gw_id:
            print(f"{C.RED}Gateway ID is required{C.RESET}")
            return
        purge = input("Hard-delete / purge? This releases the EUI for reuse (y/N): ").strip().lower() == "y"
        confirm = input(f"\n{C.YELLOW}Are you sure you want to delete '{gw_id}'? (yes/no): {C.RESET}").strip().lower()
        if confirm == "yes":
            deprovision_gateway(api_key, gw_id, purge=purge)
        else:
            print("Cancelled.")
        return

    # ── Provision flow ───────────────────────────────────────────────────
    print(f"\n{C.BOLD}── Gateway Details ──{C.RESET}\n")

    gateway_eui = input("Gateway EUI (16 hex chars, on the gateway label): ").strip().upper().replace(":", "").replace(" ", "")
    if len(gateway_eui) != 16 or not all(c in "0123456789ABCDEF" for c in gateway_eui):
        print(f"{C.RED}EUI must be exactly 16 hex characters (e.g. 00800000A00009EF){C.RESET}")
        return

    default_id = f"fg-gw-{gateway_eui[-8:].lower()}"
    gateway_id = input(f"Gateway ID [{default_id}]: ").strip() or default_id
    name = input("Gateway name [FrostGuard Gateway]: ").strip() or "FrostGuard Gateway"

    print(f"\n{C.BOLD}── TTN Owner ──{C.RESET}")
    print(f"{C.DIM}  This is the TTN user or organization the gateway will be registered under.{C.RESET}\n")
    owner_type = input("Owner type - user or org [user]: ").strip().lower() or "user"
    if owner_type not in ("user", "org"):
        owner_type = "user"
    owner_id = input(f"TTN {owner_type} ID: ").strip()
    if not owner_id:
        print(f"{C.RED}Owner ID is required{C.RESET}")
        return

    print(f"\n{C.BOLD}── Radio Configuration ──{C.RESET}\n")
    print(f"{C.DIM}  Common US plans: US_902_928_FSB_2 (most common), US_902_928_FSB_1{C.RESET}")
    freq_plan = input(f"Frequency plan [{DEFAULT_FREQUENCY_PLAN}]: ").strip() or DEFAULT_FREQUENCY_PLAN

    print(f"\n{C.BOLD}── Location (optional) ──{C.RESET}\n")
    lat_str = input("Latitude (press Enter to skip): ").strip()
    latitude = None
    longitude = None
    altitude = None
    if lat_str:
        try:
            latitude = float(lat_str)
            lon_str = input("Longitude: ").strip()
            longitude = float(lon_str) if lon_str else None
            alt_str = input("Altitude in meters [0]: ").strip()
            altitude = float(alt_str) if alt_str else 0
        except ValueError:
            print(f"{C.YELLOW}Invalid coordinates — skipping location{C.RESET}")
            latitude = longitude = altitude = None

    print(f"\n{C.BOLD}── API Keys ──{C.RESET}\n")
    print(f"{C.DIM}  LNS key: Required for Basics Station gateways (most modern gateways){C.RESET}")
    print(f"{C.DIM}  CUPS key: For gateways that support auto-config via CUPS protocol{C.RESET}\n")
    lns = input("Generate LNS key? (Y/n): ").strip().lower() != "n"
    cups = input("Generate CUPS key? (y/N): ").strip().lower() == "y"

    print(f"\n{C.BOLD}── FrostGuard Database (optional) ──{C.RESET}\n")
    print(f"{C.DIM}  Store this gateway in FrostGuard's database for monitoring.{C.RESET}")
    print(f"{C.DIM}  Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.{C.RESET}\n")
    fg_org_id = input("FrostGuard org_id (press Enter to skip): ").strip() or None
    fg_site_id = None
    if fg_org_id:
        fg_site_id = input("FrostGuard site_id (optional): ").strip() or None

    # ── Confirmation ─────────────────────────────────────────────────────
    print(f"\n{C.CYAN}{'─' * 50}{C.RESET}")
    print(f"{C.BOLD}  Review:{C.RESET}")
    print(f"    Gateway EUI:   {gateway_eui}")
    print(f"    Gateway ID:    {gateway_id}")
    print(f"    Name:          {name}")
    print(f"    Owner:         {owner_type}/{owner_id}")
    print(f"    Freq Plan:     {freq_plan}")
    print(f"    Identity:      EU1 (eu1.cloud.thethings.network)")
    print(f"    Gateway Svr:   NAM1 (nam1.cloud.thethings.network)")
    if latitude:
        print(f"    Location:      {latitude}, {longitude}, {altitude}m")
    print(f"    LNS Key:       {'Yes' if lns else 'No'}")
    print(f"    CUPS Key:      {'Yes' if cups else 'No'}")
    if fg_org_id:
        print(f"    FG Org:        {fg_org_id}")
    print(f"{C.CYAN}{'─' * 50}{C.RESET}")

    confirm = input(f"\nProceed with provisioning? (Y/n): ").strip().lower()
    if confirm == "n":
        print("Cancelled.")
        return

    print()
    provisioner = GatewayProvisioner(api_key)
    provisioner.provision(
        gateway_id=gateway_id,
        gateway_eui=gateway_eui,
        name=name,
        owner_id=owner_id,
        owner_type=owner_type,
        frequency_plan=freq_plan,
        latitude=latitude,
        longitude=longitude,
        altitude=altitude,
        generate_lns_key=lns,
        generate_cups_key=cups,
        fg_org_id=fg_org_id,
        fg_site_id=fg_site_id,
    )


# =============================================================================
# BATCH PROVISIONING FROM JSON
# =============================================================================

def batch_provision(api_key: str, json_path: str):
    """Provision multiple gateways from a JSON config file."""
    with open(json_path) as f:
        config = json.load(f)

    gateways = config.get("gateways", [config] if "gateway_eui" in config else [])

    print(f"{C.BOLD}Batch provisioning {len(gateways)} gateway(s)...{C.RESET}\n")

    for i, gw in enumerate(gateways, 1):
        print(f"\n{'='*60}")
        print(f"Gateway {i}/{len(gateways)}")
        print(f"{'='*60}")

        provisioner = GatewayProvisioner(api_key)
        provisioner.provision(
            gateway_id=gw.get("gateway_id", f"fg-gw-{gw['gateway_eui'][-8:].lower()}"),
            gateway_eui=gw["gateway_eui"],
            name=gw.get("name", "FrostGuard Gateway"),
            owner_id=gw.get("owner_id", config.get("owner_id", "")),
            owner_type=gw.get("owner_type", config.get("owner_type", "user")),
            frequency_plan=gw.get("frequency_plan", DEFAULT_FREQUENCY_PLAN),
            latitude=gw.get("latitude"),
            longitude=gw.get("longitude"),
            altitude=gw.get("altitude"),
            generate_lns_key=gw.get("generate_lns_key", True),
            generate_cups_key=gw.get("generate_cups_key", False),
            fg_org_id=gw.get("fg_org_id"),
            fg_site_id=gw.get("fg_site_id"),
        )


# =============================================================================
# MAIN
# =============================================================================

def main():
    banner()

    parser = argparse.ArgumentParser(
        description="FrostGuard Gateway Provisioning for TTN",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Provision a single gateway
  python provision_gateway.py \\
    --gateway-eui 00800000A00009EF \\
    --name "Walk-in Cooler GW" \\
    --owner-id my-ttn-user \\
    --fg-org-id org-abc123

  # Interactive mode
  python provision_gateway.py --interactive

  # Batch from JSON
  python provision_gateway.py --from-json gateways.json

  # Check gateway status
  python provision_gateway.py --status fg-gw-a00009ef

  # Deprovision + purge
  python provision_gateway.py --deprovision fg-gw-a00009ef --purge

Environment variables:
  TTN_API_KEY              TTN API key (or use --api-key)
  SUPABASE_URL             FrostGuard Supabase URL (for DB storage)
  SUPABASE_SERVICE_ROLE_KEY  Supabase service role key
""",
    )

    # Mode selection
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--interactive", action="store_true", help="Interactive provisioning wizard")
    mode.add_argument("--from-json", metavar="FILE", help="Batch provision from JSON config")
    mode.add_argument("--status", metavar="GW_ID", help="Check gateway status")
    mode.add_argument("--deprovision", metavar="GW_ID", help="Remove gateway from TTN")

    # Gateway parameters
    parser.add_argument("--gateway-eui", help="Gateway EUI (16 hex chars)")
    parser.add_argument("--gateway-id", help="Gateway ID (auto-generated from EUI if omitted)")
    parser.add_argument("--name", default="FrostGuard Gateway", help="Gateway display name")
    parser.add_argument("--owner-id", help="TTN user or org ID that owns the gateway")
    parser.add_argument("--owner-type", choices=["user", "org"], default="user",
                        help="Owner type (default: user)")
    parser.add_argument("--frequency-plan", default=DEFAULT_FREQUENCY_PLAN,
                        help=f"Frequency plan (default: {DEFAULT_FREQUENCY_PLAN})")

    # Location
    parser.add_argument("--lat", type=float, help="Gateway latitude")
    parser.add_argument("--lon", type=float, help="Gateway longitude")
    parser.add_argument("--alt", type=float, default=0, help="Gateway altitude (meters)")

    # Options
    parser.add_argument("--cups", action="store_true", help="Also generate CUPS API key")
    parser.add_argument("--purge", action="store_true", help="Hard-delete when deprovisioning")
    parser.add_argument("--output-dir", default=".", help="Directory for key files")
    parser.add_argument("--api-key", help="TTN API key (or set TTN_API_KEY env var)")

    # FrostGuard DB
    parser.add_argument("--fg-org-id", help="FrostGuard organization ID (for DB storage)")
    parser.add_argument("--fg-site-id", help="FrostGuard site ID (optional)")

    args = parser.parse_args()

    # Get API key (optional — interactive mode will prompt if missing)
    api_key = args.api_key or os.getenv("TTN_API_KEY")

    # Execute mode
    if args.interactive or (not args.from_json and not args.status and not args.deprovision and not args.gateway_eui):
        # Default to interactive mode when no args provided
        interactive_provision(api_key)
    elif args.from_json:
        if not api_key:
            print(f"{C.RED}Error: TTN API key required. Use --api-key or set TTN_API_KEY env var.{C.RESET}")
            sys.exit(1)
        batch_provision(api_key, args.from_json)
    elif args.status:
        if not api_key:
            print(f"{C.RED}Error: TTN API key required. Use --api-key or set TTN_API_KEY env var.{C.RESET}")
            sys.exit(1)
        check_gateway_status(api_key, args.status)
    elif args.deprovision:
        if not api_key:
            print(f"{C.RED}Error: TTN API key required. Use --api-key or set TTN_API_KEY env var.{C.RESET}")
            sys.exit(1)
        deprovision_gateway(api_key, args.deprovision, purge=args.purge)
    else:
        # Direct provisioning with flags
        if not api_key:
            print(f"{C.RED}Error: TTN API key required. Use --api-key or set TTN_API_KEY env var.{C.RESET}")
            sys.exit(1)
        if not args.gateway_eui:
            parser.error("--gateway-eui is required (or use --interactive)")
        if not args.owner_id:
            parser.error("--owner-id is required")

        gateway_id = args.gateway_id or f"fg-gw-{args.gateway_eui[-8:].lower()}"

        provisioner = GatewayProvisioner(api_key)
        provisioner.provision(
            gateway_id=gateway_id,
            gateway_eui=args.gateway_eui.upper(),
            name=args.name,
            owner_id=args.owner_id,
            owner_type=args.owner_type,
            frequency_plan=args.frequency_plan,
            latitude=args.lat,
            longitude=args.lon,
            altitude=args.alt,
            generate_cups_key=args.cups,
            output_dir=args.output_dir,
            fg_org_id=args.fg_org_id,
            fg_site_id=args.fg_site_id,
        )


if __name__ == "__main__":
    main()
