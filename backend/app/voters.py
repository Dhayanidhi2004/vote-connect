"""Voter lookup helpers.

Primary source is a local Excel workbook exported from the voter roll. If that
file is unavailable, the code falls back to the older Supabase-backed flow.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import requests

from .config import settings

_XML_NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg": "http://schemas.openxmlformats.org/package/2006/relationships",
}


class VoterConfigError(RuntimeError):
    """Raised when no voter data source is configured."""


class VoterLookupError(RuntimeError):
    """Raised when voter lookup fails."""


def _headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _normalize_phone(value: str | None) -> str | None:
    text = _normalize_text(value)
    if not text:
        return None
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    return digits or text


def _parse_int(value: str | None) -> int | None:
    text = _normalize_text(value)
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _column_letters(cell_ref: str) -> str:
    letters: list[str] = []
    for ch in cell_ref:
        if ch.isalpha():
            letters.append(ch)
        else:
            break
    return "".join(letters)


def _load_shared_strings(zf: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for string_item in root.findall("main:si", _XML_NS):
        text = "".join(node.text or "" for node in string_item.iterfind(".//main:t", _XML_NS))
        values.append(text)
    return values


def _sheet_targets(zf: ZipFile) -> list[tuple[str, str]]:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_map = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall("pkg:Relationship", _XML_NS)
    }
    targets: list[tuple[str, str]] = []
    for sheet in workbook.findall("main:sheets/main:sheet", _XML_NS):
        rel_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        targets.append((sheet.attrib.get("name", "Sheet1"), rel_map[rel_id]))
    return targets


def _read_sheet_rows(path: Path) -> list[dict[str, str]]:
    with ZipFile(path) as zf:
        shared_strings = _load_shared_strings(zf)
        sheets = _sheet_targets(zf)
        if not sheets:
            return []

        _, target = sheets[0]
        root = ET.fromstring(zf.read(f"xl/{target}"))
        rows: list[dict[str, str]] = []
        headers: dict[str, str] = {}

        for row in root.findall("main:sheetData/main:row", _XML_NS):
            values_by_header: dict[str, str] = {}
            pending_by_letter: dict[str, str] = {}

            for cell in row.findall("main:c", _XML_NS):
                cell_ref = cell.attrib.get("r", "")
                letter = _column_letters(cell_ref)
                cell_type = cell.attrib.get("t")
                value_node = cell.find("main:v", _XML_NS)
                value = ""
                if value_node is not None and value_node.text is not None:
                    if cell_type == "s":
                        value = shared_strings[int(value_node.text)]
                    else:
                        value = value_node.text
                pending_by_letter[letter] = value

            if not headers:
                headers = {
                    letter: value.strip()
                    for letter, value in pending_by_letter.items()
                    if value.strip()
                }
                continue

            for letter, header in headers.items():
                values_by_header[header] = pending_by_letter.get(letter, "")

            if any(str(value).strip() for value in values_by_header.values()):
                rows.append(values_by_header)

        return rows


def _excel_path() -> Path | None:
    configured = _normalize_text(settings.voter_excel_path)
    if not configured:
        return None
    path = Path(configured)
    return path if path.exists() else None


def _map_excel_row(row: dict[str, str], index: int) -> dict[str, Any]:
    epic = (_normalize_text(row.get("EPIC")) or "").upper()
    name = _normalize_text(row.get("NAME_T")) or _normalize_text(row.get("NAME_EN")) or epic
    relative_name = _normalize_text(row.get("R_Name")) or _normalize_text(row.get("REL_EN"))
    section_name = _normalize_text(row.get("SECTION_NAME"))
    section_number = _normalize_text(row.get("SECTION"))
    booth_name = _normalize_text(row.get("BOOTH NAME"))

    division = section_name
    ward = None
    village = None
    if section_name:
        parts = [part.strip() for part in section_name.split(",", 1)]
        if parts:
            village = parts[0] or None
        if len(parts) > 1:
            ward = parts[1] or None

    return {
        "id": index,
        "id_code": epic,
        "name": name,
        "relation_type": _normalize_text(row.get("R_TYPE")),
        "relative_name": relative_name,
        "house_no": _normalize_text(row.get("HOUSE")),
        "age": _parse_int(row.get("AGE")),
        "gender": _normalize_text(row.get("GENDER")),
        "phone": _normalize_phone(row.get("MOBILE")),
        "constituency": _normalize_text(row.get("AC_NAME")),
        "division": division,
        "village": village,
        "ward": ward or section_number,
        "part": _parse_int(row.get("SECTION")),
        "booth_number": _normalize_text(row.get("BOOTH")),
        "confirmed": str(row.get("IS_DELETED", "")).strip().upper() != "TRUE",
        "party": None,
        "agent": booth_name,
        "notes": booth_name,
    }


@lru_cache(maxsize=1)
def _excel_voters_by_epic() -> dict[str, dict[str, Any]]:
    path = _excel_path()
    if path is None:
        return {}

    try:
        rows = _read_sheet_rows(path)
    except Exception as exc:  # pragma: no cover - defensive parser wrapper
        raise VoterLookupError(f"Voter Excel parse failed: {exc}") from exc

    voters: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(rows, start=1):
        epic = (_normalize_text(row.get("EPIC")) or "").upper()
        if not epic:
            continue
        if epic not in voters:
            voters[epic] = _map_excel_row(row, index)
    return voters


def _find_voter_from_excel(id_code: str) -> dict[str, Any] | None:
    normalized = id_code.strip().upper()
    if not normalized:
        return None
    voters = _excel_voters_by_epic()
    return voters.get(normalized)


def _require_supabase_config() -> tuple[str, str]:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise VoterConfigError(
            "No voter data source is configured. Set voter_excel_path or Supabase credentials."
        )
    return settings.supabase_url.rstrip("/"), settings.supabase_service_role_key


def _find_voter_from_supabase(id_code: str) -> dict[str, Any] | None:
    base_url, key = _require_supabase_config()
    normalized = id_code.strip().upper()
    if not normalized:
        return None

    try:
        response = requests.get(
            f"{base_url}/rest/v1/voters",
            headers=_headers(key),
            params={
                "id_code": f"eq.{normalized}",
                "select": (
                    "id,id_code,name,relation_type,relative_name,house_no,age,gender,"
                    "phone,constituency,division,village,ward,part,booth_number,"
                    "confirmed,party,agent,notes"
                ),
                "limit": "1",
            },
            timeout=20,
            verify=settings.supabase_verify_ssl,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise VoterLookupError(f"Voter lookup failed: {exc}") from exc

    rows = response.json()
    return rows[0] if rows else None


def find_voter_by_id_code(id_code: str) -> dict[str, Any] | None:
    if _excel_path() is not None:
        return _find_voter_from_excel(id_code)
    return _find_voter_from_supabase(id_code)


def list_sample_voters(limit: int = 5) -> list[dict[str, Any]]:
    if _excel_path() is not None:
        return list(_excel_voters_by_epic().values())[:limit]

    base_url, key = _require_supabase_config()
    try:
        response = requests.get(
            f"{base_url}/rest/v1/voters",
            headers=_headers(key),
            params={
                "select": (
                    "id,id_code,name,relation_type,relative_name,house_no,age,gender,"
                    "phone,constituency,division,village,ward,part,booth_number,"
                    "confirmed,party,agent,notes"
                ),
                "id_code": "not.is.null",
                "name": "not.is.null",
                "order": "confirmed.desc,id.asc",
                "limit": str(limit),
            },
            timeout=20,
            verify=settings.supabase_verify_ssl,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise VoterLookupError(f"Voter sample fetch failed: {exc}") from exc

    rows = response.json()
    return [row for row in rows if row.get("id_code") and row.get("name")]
