"""Pix: validação de chave, mascaramento e BR Code estático (EMV MPM) com CRC16.

Referência: Manual de Padrões para Iniciação do Pix (BCB) — campos 00, 26, 52,
53, 54, 58, 59, 60, 62/05, 63. Sem consulta bancária; nunca indica pagamento.
"""
import re
import unicodedata

_EMAIL = re.compile(r"^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
_PHONE = re.compile(r"^\+55\d{10,11}$")
_EVP = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class PixError(ValueError):
    pass


def _cpf_ok(d: str) -> bool:
    if len(d) != 11 or d == d[0] * 11:
        return False
    for n in (9, 10):
        s = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        if (s * 10 % 11) % 10 != int(d[n]):
            return False
    return True


def _cnpj_ok(d: str) -> bool:
    if len(d) != 14 or d == d[0] * 14:
        return False
    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6] + w1
    for w, n in ((w1, 12), (w2, 13)):
        s = sum(int(d[i]) * w[i] for i in range(n))
        dv = 0 if s % 11 < 2 else 11 - s % 11
        if dv != int(d[n]):
            return False
    return True


def normalize_key(raw: str) -> tuple[str, str]:
    """Retorna (tipo, chave_normalizada) ou lança PixError."""
    k = (raw or "").strip()
    if not k:
        raise PixError("chave Pix vazia")
    if _EVP.match(k.lower()):
        return "evp", k.lower()
    if "@" in k:
        if _EMAIL.match(k) and len(k) <= 77:
            return "email", k.lower()
        raise PixError("e-mail inválido")
    if k.startswith("+"):
        if _PHONE.match(k):
            return "phone", k
        raise PixError("telefone deve estar no formato +55DDDNUMERO")
    digits = re.sub(r"[.\-/ ]", "", k)
    if digits.isdigit():
        if len(digits) == 11 and _cpf_ok(digits):
            return "cpf", digits
        if len(digits) == 14 and _cnpj_ok(digits):
            return "cnpj", digits
    raise PixError("chave Pix inválida")


def mask_key(key_type: str, key: str) -> str:
    if key_type == "cpf":
        return f"***.{key[3:6]}.***-**"
    if key_type == "cnpj":
        return f"**.{key[2:5]}.***/****-**"
    if key_type == "email":
        user, _, dom = key.partition("@")
        return f"{user[:2]}***@{dom}"
    if key_type == "phone":
        return f"{key[:5]}*****{key[-4:]}"
    return f"{key[:8]}-****-****-****-{key[-4:]}"


def _ascii(text: str, maxlen: int) -> str:
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    t = re.sub(r"[^A-Za-z0-9 .\-]", "", t).strip()
    return t[:maxlen].strip()


def crc16_ccitt(data: bytes) -> int:
    crc = 0xFFFF
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if crc & 0x8000 else (crc << 1)
            crc &= 0xFFFF
    return crc


def _f(tag: str, value: str) -> str:
    if len(value) > 99:
        raise PixError(f"campo {tag} excede 99 caracteres")
    return f"{tag}{len(value):02d}{value}"


def build_brcode(*, key: str, holder_name: str, city: str, amount_cents: int | None, txid: str = "***") -> str:
    name = _ascii(holder_name, 25)
    cty = _ascii(city, 15)
    if not name or not cty:
        raise PixError("nome e cidade do recebedor são obrigatórios")
    if not re.fullmatch(r"\*\*\*|[A-Za-z0-9]{1,25}", txid):
        raise PixError("txid inválido")
    payload = _f("00", "01")
    payload += _f("26", _f("00", "br.gov.bcb.pix") + _f("01", key))
    payload += _f("52", "0000") + _f("53", "986")
    if amount_cents is not None:
        if amount_cents <= 0:
            raise PixError("valor deve ser positivo")
        payload += _f("54", f"{amount_cents // 100}.{amount_cents % 100:02d}")
    payload += _f("58", "BR") + _f("59", name) + _f("60", cty)
    payload += _f("62", _f("05", txid))
    payload += "6304"
    return payload + f"{crc16_ccitt(payload.encode()):04X}"


def parse_tlv(payload: str) -> dict[str, str]:
    out, i = {}, 0
    while i < len(payload):
        tag, ln = payload[i:i + 2], int(payload[i + 2:i + 4])
        out[tag] = payload[i + 4:i + 4 + ln]
        i += 4 + ln
    return out


def verify_crc(payload: str) -> bool:
    if len(payload) < 8 or payload[-8:-4] != "6304":
        return False
    return f"{crc16_ccitt(payload[:-4].encode()):04X}" == payload[-4:]
