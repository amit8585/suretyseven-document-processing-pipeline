import json
import time
import uuid

import requests

BASE = "http://localhost:3000"


def pdf_bytes(label):
    return (
        "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n"
        "trailer<</Root 1 0 R>>\n%%EOF\n"
        f"{label}-{uuid.uuid4()}\n"
    ).encode()


def upload(label, doc_type, scenario):
    files = {"file": (f"{label}.pdf", pdf_bytes(label), "application/pdf")}
    data = {
        "documentType": doc_type,
        "metadata": json.dumps({"simulateOutcome": scenario}),
    }
    res = requests.post(f"{BASE}/documents", files=files, data=data)
    print("UPLOAD", res.status_code, res.text)
    res.raise_for_status()
    return res.json(), files["file"][1]


def wait_status(doc_id, wanted, timeout=40):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = requests.get(f"{BASE}/documents/{doc_id}").json()
        if last.get("status") in wanted:
            return last
        time.sleep(0.4)
    return last


def main():
    print("=== health ===")
    health = requests.get(f"{BASE}/health").json()
    print(health)
    assert health["status"] == "ok"

    print("=== SUCCESS ===")
    created, raw = upload("success", "FINANCIAL_STATEMENT", "SUCCESS")
    assert created["status"] == "UPLOADED", created
    doc_id = created["documentId"]
    processed = wait_status(doc_id, {"PROCESSED", "FAILED"})
    print(processed)
    assert processed["status"] == "PROCESSED"
    assert processed["result"]["companyName"] == "ABC Construction Pvt Ltd"

    print("=== details/history ===")
    details = requests.get(f"{BASE}/documents/{doc_id}").json()
    history = requests.get(f"{BASE}/documents/{doc_id}/history").json()
    print(json.dumps(history, indent=2, default=str))
    assert details["documentId"] == doc_id
    assert history[0]["status"] == "UPLOADED"
    assert any(item["status"] == "PROCESSED" for item in history)

    print("=== list filters ===")
    listed = requests.get(
        f"{BASE}/documents",
        params={
            "page": 1,
            "limit": 10,
            "status": "PROCESSED",
            "documentType": "FINANCIAL_STATEMENT",
        },
    ).json()
    print(listed["pagination"])
    assert listed["pagination"]["page"] == 1
    assert listed["pagination"]["limit"] == 10
    assert "total" in listed["pagination"]
    assert "totalPages" in listed["pagination"]
    assert any(item["documentId"] == doc_id for item in listed["data"])

    print("=== duplicate ===")
    history_before = requests.get(f"{BASE}/documents/{doc_id}/history").json()
    files = {"file": ("dup.pdf", raw, "application/pdf")}
    data = {
        "documentType": "INVOICE",
        "metadata": json.dumps({"simulateOutcome": "SUCCESS"}),
    }
    dup = requests.post(f"{BASE}/documents", files=files, data=data)
    print(dup.status_code, dup.text)
    dupj = dup.json()
    assert dup.status_code == 200
    assert dupj["documentId"] == doc_id
    assert dupj.get("duplicate") is True
    history_after = requests.get(f"{BASE}/documents/{doc_id}/history").json()
    assert len(history_after) == len(history_before)

    print("=== pagination ===")
    extra, _ = upload("page2", "OTHER", "SUCCESS")
    extra_doc = wait_status(extra["documentId"], {"PROCESSED", "FAILED"})
    assert extra_doc["status"] == "PROCESSED"
    page1 = requests.get(f"{BASE}/documents", params={"page": 1, "limit": 1}).json()
    page2 = requests.get(f"{BASE}/documents", params={"page": 2, "limit": 1}).json()
    print(page1["pagination"], page2["pagination"])
    assert page1["pagination"]["limit"] == 1
    assert page1["pagination"]["page"] == 1
    assert page1["pagination"]["total"] >= 2
    assert page1["pagination"]["totalPages"] >= 2
    assert len(page1["data"]) == 1
    assert page2["data"][0]["documentId"] != page1["data"][0]["documentId"]

    print("=== status filter ===")
    failed_list = requests.get(f"{BASE}/documents", params={"status": "PROCESSED"}).json()
    assert all(item["status"] == "PROCESSED" for item in failed_list["data"])

    print("=== RETRY_THEN_SUCCESS ===")
    retry, _ = upload("retry", "BANK_STATEMENT", "RETRY_THEN_SUCCESS")
    retry_doc = wait_status(retry["documentId"], {"PROCESSED"}, timeout=40)
    retry_hist = requests.get(
        f"{BASE}/documents/{retry['documentId']}/history"
    ).json()
    print(retry_doc["status"], retry_doc.get("attemptCount"), retry_hist)
    assert retry_doc["status"] == "PROCESSED"
    assert any(item.get("reason") == "TIMEOUT" for item in retry_hist)

    print("=== VALIDATION_FAILED no retry ===")
    val, _ = upload("validation", "INVOICE", "VALIDATION_FAILED")
    val_doc = wait_status(val["documentId"], {"FAILED", "PROCESSED"})
    val_hist = requests.get(f"{BASE}/documents/{val['documentId']}/history").json()
    print(val_doc["status"], val_doc.get("error"), val_hist)
    assert val_doc["status"] == "FAILED"
    assert val_doc["error"]["code"] == "VALIDATION_FAILED"
    assert val_doc["error"]["attempt"] == 1
    assert any(err["field"] == "annualRevenue" for err in val_doc["error"]["errors"])
    assert sum(1 for item in val_hist if item["status"] == "PROCESSING") == 1

    print("=== INVALID_RESULT ===")
    inv, _ = upload("invalid", "INVOICE", "INVALID_RESULT")
    inv_doc = wait_status(inv["documentId"], {"FAILED", "PROCESSED"})
    print(inv_doc["status"], inv_doc.get("error"))
    assert inv_doc["status"] == "FAILED"
    assert inv_doc["error"]["code"] == "INVALID_RESULT"
    assert inv_doc["error"]["attempt"] == 1

    print("=== TIMEOUT exhausted ===")
    timeout_doc, _ = upload("timeout", "OTHER", "TIMEOUT")
    to_doc = wait_status(timeout_doc["documentId"], {"FAILED"}, timeout=45)
    to_hist = requests.get(
        f"{BASE}/documents/{timeout_doc['documentId']}/history"
    ).json()
    print(to_doc["status"], to_doc.get("error"), to_hist)
    assert to_doc["status"] == "FAILED"
    assert to_doc["error"]["code"] == "TIMEOUT"
    assert to_doc["error"]["attempt"] == 3

    print("=== status and type filters ===")
    by_status = requests.get(f"{BASE}/documents", params={"status": "FAILED"}).json()
    by_type = requests.get(
        f"{BASE}/documents", params={"documentType": "INVOICE"}
    ).json()
    print("failed", by_status["pagination"], "invoice", by_type["pagination"])
    assert by_status["pagination"]["total"] >= 1
    assert all(item["status"] == "FAILED" for item in by_status["data"])
    assert by_type["pagination"]["total"] >= 1
    assert all(item["documentType"] == "INVOICE" for item in by_type["data"])

    print("=== not found ===")
    missing = requests.get(f"{BASE}/documents/DOC-MISSING")
    print(missing.status_code, missing.text)
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "DOCUMENT_NOT_FOUND"
    assert "stack" not in missing.text.lower()

    print("=== frontend ===")
    frontend = requests.get("http://localhost:5173")
    assert frontend.status_code == 200
    assert "SuretySeven" in frontend.text

    print("E2E PASS")


if __name__ == "__main__":
    main()
