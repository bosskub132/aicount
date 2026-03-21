# Detailed Flowchart by Step — ระบบบัญชีอัตโนมัติ (OCR to GL for Express)

เอกสารนี้อธิบายแต่ละ Step ใน System Flowchart แบบละเอียด พร้อม Mermaid diagram และคำอธิบาย

**แผนภาพรวม (Overall Flowchart):** แผน master ชื่อ `greenfield_backend_design_6ed2da7c.plan.md` — ใน repo นี้ลอง [`../.cursor/plans/greenfield_backend_design_6ed2da7c.plan.md`](../.cursor/plans/greenfield_backend_design_6ed2da7c.plan.md) ก่อน (ถ้ายังไม่ได้ commit แผนไว้ใน repo จะเปิดไม่ได้) — ทางเลือก: **Cursor user plans** ที่ `%USERPROFILE%\.cursor\plans\` ชื่อไฟล์เดียวกัน — Section 1 ของแผน = System Flowchart รวม

### Background Process (กระบวนการพื้นหลัง)

หลาย Step สามารถรันเป็น **background process** ได้ — ไม่ block UI ผู้ใช้สามารถทำอย่างอื่นได้ระหว่างรอ


| Step  | รองรับ Background? | รายละเอียด                                                                                      |
| ----- | ------------------ | ----------------------------------------------------------------------------------------------- |
| **1** | ใช่                | Upload รับไฟล์ทันที → ประมวลผล (บันทึก storage, สร้าง record) ใน background → Notify เมื่อเสร็จ |
| **2** | ใช่                | OCR Engine ใช้เวลานาน → รันใน queue/job → อัปเดต status เมื่อเสร็จ → แจ้ง Frontend หลักทาง **SSE** (`GET /api/events/stream`); ทางเลือกสำรอง: polling ถ้า SSE ใช้ไม่ได้ |
| **3** | ใช่                | Classification + Validation รันหลัง OCR เสร็จ → background job                                  |
| **4** | ใช่                | Tax & GL Mapping รันต่อจาก Step 3 → background                                                  |
| **7** | ใช่                | Export Engine สำหรับข้อมูลจำนวนมาก → สร้างไฟล์ใน background → แจ้งเมื่อพร้อมดาวน์โหลด           |


**Implementation:** Job queue (Bull, BullMQ, Celery, Inngest ฯลฯ) + **SSE** เป็นช่องทางหลักสำหรับสถานะ real-time ไปยังเบราว์เซอร์; ทางเลือก: polling หรือ webhook callback เมื่อ job เสร็จ (กรณี client ไม่ใช้ browser)

### UX: UI Notify ควรใช้เมื่อไหร่ (Notification Matrix)

แต่ละกระบวนการที่ผู้ใช้รอหรือมีผลลัพธ์สำคัญ — ควรมี UI แจ้งเตือนเพื่อให้ผู้ใช้รู้สถานะและผลลัพธ์


| Step    | Process / Event                 | UI Notify                                             | Type     | Description              |
| ------- | ------------------------------- | ----------------------------------------------------- | -------- | ------------------------ |
| **0**   | สร้าง Workspace สำเร็จ          | Toast: "สร้าง Workspace สำเร็จ"                       | Success  | หลัง OB2                 |
| **0**   | นำเข้า COA / Master Data สำเร็จ | Toast: "นำเข้าข้อมูลสำเร็จ"                           | Success  | หลัง OB3a–OB3e           |
| **0**   | ตรวจสอบความพร้อมไม่ครบ          | Inline / Toast: "ยังไม่ครบ: โปรดเพิ่ม COA และแผนก"    | Warning  | หลัง OB6 → ไม่ครบ        |
| **0.1** | บันทึก Staff Assignment         | Toast: "บันทึกการมอบหมายแล้ว"                         | Success  | หลัง A7                  |
| **0.2** | เลือก Workspace                 | Toast (optional): "เลือก [ชื่อบริษัท] แล้ว"           | Info     | หลัง W7                  |
| **1**   | Upload สำเร็จ                   | Popup / Toast: "อัปโหลดสำเร็จ"                        | Success  | มีอยู่แล้ว               |
| **1**   | Upload ล้มเหลว                  | Popup / Toast: "อัปโหลดไม่สำเร็จ" + error message     | Error    | มีอยู่แล้ว               |
| **2**   | OCR กำลังประมวลผล               | Progress: "กำลังประมวลผล OCR..." (spinner/badge)      | Progress | ระหว่าง P2_3–P2_5        |
| **2**   | OCR เสร็จ                       | Toast: "ประมวลผลเสร็จ" + refetch                      | Success  | มีอยู่แล้ว (SSE)         |
| **2**   | OCR ล้มเหลว                     | Toast: "OCR ล้มเหลว กรุณาตรวจสอบไฟล์"                 | Error    | ถ้า job fail             |
| **3**   | Classification เสร็จ            | Toast (optional): "จัดประเภทเอกสารเสร็จ"              | Success  | หลัง C3_6                |
| **3**   | ข้อมูลไม่ครบ → QUERY            | Toast / Badge: "มี X เอกสารใน Query Tray ต้องตรวจสอบ" | Warning  | หลัง C3_5                |
| **3a**  | บันทึก extraction สำเร็จ        | Toast: "บันทึกสำเร็จ"                                 | Success  | หลัง Q7a (PATCH success) |
| **3a**  | บันทึก extraction ล้มเหลว       | Toast: "บันทึกไม่สำเร็จ" + error                      | Error    | PATCH 4xx/5xx            |
| **3a**  | Re-run Classification เสร็จ     | Toast: "จัดประเภทใหม่เสร็จแล้ว"                       | Success  | หลัง Q8                  |
| **4**   | Mapping เสร็จ + มี Suspense     | Toast: "มี X รายการต้องเลือก GL (Suspense)"           | Warning  | หลัง T4_9                |
| **5**   | Balance ไม่ตรง                  | Alert / Toast: "ยอด Dr/Cr ไม่ตรงกัน กรุณาแก้ไข"       | Error    | J5_16                    |
| **6**   | Maker ส่งขออนุมัติ              | Toast: "ส่งขออนุมัติแล้ว"                             | Success  | หลัง MC6                 |
| **6**   | Checker อนุมัติ                 | Toast: "อนุมัติแล้ว"                                  | Success  | หลัง MC11                |
| **6**   | Checker Reject                  | Toast: "ส่งกลับให้แก้ไข" + แจ้ง Maker                 | Warning  | หลัง MC10                |
| **6**   | Maker ได้รับ Reject             | In-app / Badge: "มีเอกสารถูกส่งกลับ"                  | Warning  | Maker ต้องเห็น           |
| **7**   | Export กำลังสร้างไฟล์           | Progress: "กำลังสร้างไฟล์..."                         | Progress | ระหว่าง E7_5–E7_10       |
| **7**   | Export เสร็จ                    | Toast: "ไฟล์พร้อมดาวน์โหลด" + Download button         | Success  | หลัง E7_12               |
| **7**   | Export ล้มเหลว                  | Toast: "สร้างไฟล์ไม่สำเร็จ" + error                   | Error    | ถ้า E7 fail              |
| **7a**  | ล็อกงวดสำเร็จ                   | Toast: "ล็อกงวด [YYYY-MM] แล้ว"                       | Success  | หลัง PL4                 |
| **7a**  | ยกเลิกล็อก                      | Toast: "ยกเลิกล็อกงวดแล้ว"                            | Success  | หลัง PL10                |
| **7b**  | สร้าง Reversal JV               | Toast: "สร้างรายการแก้ไขแล้ว ส่งขออนุมัติ"            | Success  | หลัง CR4                 |
| **7c**  | อัปโหลด Bank Statement          | Toast: "อัปโหลดสำเร็จ"                                | Success  | หลัง BR4                 |
| **7c**  | มีรายการไม่ตรงกัน               | Toast: "มี X รายการรอตรวจสอบ"                         | Warning  | หลัง BR9                 |


**หลักการ UX:**

- **Success:** แจ้งเมื่อ action สำเร็จ — ผู้ใช้มั่นใจว่าระบบรับงานแล้ว
- **Error:** แจ้งทันทีเมื่อล้มเหลว — พร้อมข้อความช่วยแก้ไข
- **Warning:** แจ้งเมื่อมีงานต้องทำ (Query Tray, Suspense, Reject, Unmatched)
- **Progress:** แสดงระหว่าง process ที่ใช้เวลา — ลดความกังวลว่าหยุดทำงาน

---

## Step 0: ก่อนใช้งาน (Onboarding)

### Flowchart

```mermaid
flowchart TD
    subgraph OB [Onboarding - ครั้งแรก]
        OB1([1. สมัคร/เข้าสู่ระบบ]) --> OB2([2. สร้าง Workspace])
        OB2 --> OB3([3. ตั้งค่า Master Data])
        OB3 --> OB3a[3.1 ผังบัญชี COA]
        OB3 --> OB3b[3.2 แผนก/สาขา]
        OB3 --> OB3c[3.3 ผู้จำหน่าย]
        OB3 --> OB3d[3.4 ลูกค้า]
        OB3 --> OB3e[3.5 สินค้า/บริการ]
        OB3a --> OB4
        OB3b --> OB4
        OB3c --> OB4
        OB3d --> OB4
        OB3e --> OB4
        OB4([4. กำหนด Maker/Checker]) --> OB5([5. ตั้งค่า Export Template])
        OB5 --> OB6{6. ตรวจสอบความพร้อม}
        OB6 -->|ไม่ครบ| OB3
        OB6 -->|ครบ| OB7([พร้อมใช้งาน])
    end
```



### Description


| Sub-step | Action                                            | Output                    |
| -------- | ------------------------------------------------- | ------------------------- |
| 1        | Admin สมัคร/เข้าสู่ระบบ                           | User account, JWT         |
| 2        | สร้าง Workspace (Tenant)                          | tenant_id, name, tax_id   |
| 3.1      | นำเข้า COA (Excel/CSV หรือ manual)                | chart_of_accounts records |
| 3.2      | เพิ่มแผนก/สาขา (Cost Center)                      | departments records       |
| 3.3–3.5  | นำเข้า Vendors, Customers, Products (optional)    | master data               |
| 4        | มอบหมาย User → Tenant ด้วย role maker/checker     | tenant_assignments        |
| 5        | ตั้งค่า Export Template (journal types, keywords) | express_templates         |
| 6        | ระบบเช็ค: COA + แผนกอย่างน้อย 1 รายการ            | Pass/Fail                 |


---

## Step 0.1: Staff Assignment

### Flowchart

```mermaid
flowchart TD
    subgraph SA [Staff Assignment]
        A1[Admin เข้าหน้า Tenant] --> A2[เลือก Tenant]
        A2 --> A3[กด Assign Users]
        A3 --> A4{เลือก User + Role}
        A4 --> A5[maker]
        A4 --> A6[checker]
        A5 --> A7[บันทึก tenant_assignments]
        A6 --> A7
        A7 --> A8[Maker เห็นเฉพาะ Tenant ที่มอบหมาย]
        A8 --> A9[Checker เห็นทั้งหมดหรือตามกำหนด]
    end
```



### Description

- **Purpose:** กำหนดว่า Maker/Checker คนไหนรับผิดชอบ Tenant ใด
- **Data:** `tenant_assignments(tenant_id, user_id, role)`
- **Effect:** Maker เห็นเฉพาะ Client ที่มอบหมาย; Checker อนุมัติได้ทุก Client (หรือตาม policy)

---

## Step 0.2: เลือกบริษัทลูกค้า (Workspace)

### Flowchart

```mermaid
flowchart TD
    subgraph WS [Workspace Selection]
        W1[User Login] --> W2[โหลดรายการ Tenants]
        W2 --> W3{มี Assignment?}
        W3 -->|Maker| W4[แสดงเฉพาะ Tenant ที่มอบหมาย]
        W3 -->|Checker/Admin| W5[แสดงทุก Tenant]
        W4 --> W6[User เลือก Tenant]
        W5 --> W6
        W6 --> W7[ตั้ง context: tenant_id]
        W7 --> W8[ทุก API ต่อไปใช้ tenant_id]
    end
```



### Description

- **Purpose:** ตั้งบริบทการทำงานให้ชัดเจน
- **Output:** `tenant_id` ใน session/context สำหรับ API ต่อไป

---

## Step 1: Document Intake

### Flowchart

```mermaid
flowchart TD
    subgraph DI [Document Intake - 2 ช่องทางเท่านั้น]
        D1[ช่องทาง 1: Upload via Frontend Menu]
        D2[ช่องทาง 2: LINE Webhook]
        D1 --> D3[POST /documents/upload multipart]
        D2 --> D4[POST /webhooks/line]
        D3 --> D5[รับไฟล์: image/PDF]
        D4 --> D5
        D5 --> D6[บันทึกไฟล์ storage]
        D6 --> D6a{บันทึก storage สำเร็จ?}
        D6a -->|สำเร็จ| D7[สร้าง document record]
        D7 --> D8[Notify: Popup Complete]
        D8 --> D9[intake_source = FRONTEND_UPLOAD หรือ LINE]
        D9 --> D10[จัดกลุ่ม Batch ตาม month + tenant]
        D10 --> D11([ส่งต่อ Step 2])
        D6a -->|ล้มเหลว| D12[Notify: Popup Failed]
        D12 --> D13[แสดงข้อความ error]
        D13 --> D14{Browse new file / upload same again?}
        D14 -->|ใช่| D1
        D14 -->|ไม่| D15[ติดต่อ support]
    end
```



### Notify Process (แจ้งเตือนผู้ใช้)


| Result       | UI Feedback                                            | Description                                                                    |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Complete** | Popup / Toast: "อัปโหลดสำเร็จ" หรือ "Upload complete"  | แสดงเมื่อบันทึกไฟล์และสร้าง document record สำเร็จ                             |
| **Failed**   | Popup / Toast: "อัปโหลดไม่สำเร็จ" หรือ "Upload failed" | แสดงเมื่อเกิด error (ไฟล์เสีย, storage ล้มเหลว, API error)                     |
| **Failed**   | แสดงข้อความ error เพิ่มเติม                            | เช่น "ไฟล์ขนาดเกินกำหนด", "รูปแบบไฟล์ไม่รองรับ", "เกิดข้อผิดพลาด กรุณาลองใหม่" |


**Implementation notes:**

- **Frontend Upload:** หลัง `POST /documents/upload` response → ถ้า 2xx แสดง popup success, ถ้า 4xx/5xx แสดง popup error พร้อม message
- **LINE:** Webhook response 200 = success; ถ้า fail อาจส่ง LINE reply กลับไปแจ้งผู้ใช้
- **Popup type:** Toast notification, Modal dialog, หรือ Inline message ตาม design system

### Description


| Channel         | API / Trigger                              | Data Stored                             |
| --------------- | ------------------------------------------ | --------------------------------------- |
| Frontend Upload | `POST /documents/upload`                   | file_url, intake_source=FRONTEND_UPLOAD |
| LINE            | `POST /webhooks/line` (LINE Messaging API) | file_url, intake_source=LINE            |


- **Batch:** จัดกลุ่มตาม `tenant_id` + `document_date` (month) เพื่อประมวลผลและอนุมัติเป็นชุด
- **Background:** รองรับการรันเป็น background process — รับไฟล์ทันที, ประมวลผลใน queue, แจ้ง popup เมื่อเสร็จ/ล้มเหลว

---

## Step 2: Pre-processing

### Flowchart

```mermaid
flowchart TD
    subgraph P2 [Pre-processing]
        P2_1([รับเอกสารจาก Step 1]) --> P2_2{2.1 แยกหน้า/จัดกลุ่ม}
        P2_2 --> P2_2a[Page Split: แยกหลายหน้า]
        P2_2 --> P2_2b[Document Merge: รวม Invoice เดียวกัน]
        P2_2a --> P2_3[2.2 OCR Engine]
        P2_2b --> P2_3
        P2_3 --> P2_4[2.3 ดึงฟิลด์จาก OCR]
        P2_4 --> P2_4a[issuer_tax_id]
        P2_4 --> P2_4b[issuer_name / company_name]
        P2_4 --> P2_4c[document_date]
        P2_4 --> P2_4d[grand_total / subtotal / vat_amount]
        P2_4 --> P2_4e[document_type]
        P2_4 --> P2_4f[line_items]
        P2_4a --> P2_5[บันทึก ocr_raw]
        P2_4b --> P2_5
        P2_4c --> P2_5
        P2_4d --> P2_5
        P2_4e --> P2_5
        P2_4f --> P2_5
        P2_5 --> P2_5a[2.4 Mathematical Validation]
        P2_5a --> P2_5b{Subtotal + VAT = Grand Total ±0.05?}
        P2_5b -->|ใช่| P2_5c[Confidence_Score = High สีเขียว]
        P2_5b -->|ไม่| P2_5d[Confidence_Score = Low สีแดง → แจ้ง Maker แก้]
        P2_5c --> P2_6[status = DRAFT / ACTION_REQUIRED]
        P2_5d --> P2_6
        P2_6 --> P2_7[SSE Notify → Frontend refetch]
        P2_7 --> P2_8([ส่งต่อ Step 3])
    end
```



### Notify from Backend & Auto Reload

เมื่อ OCR/Pre-processing เสร็จ Backend แจ้ง Frontend → หน้าเว็บ reload อัตโนมัติเพื่อแสดงผลลัพธ์

```mermaid
flowchart LR
    subgraph Backend [Backend]
        B1[OCR Job เสร็จ] --> B2[อัปเดต document status]
        B2 --> B3[ส่ง Notify]
    end

    subgraph Frontend [Frontend]
        F1[รับ Notify] --> F2[แสดง Toast: ประมวลผลเสร็จ]
        F2 --> F3[Auto Reload หน้า / Refetch data]
        F3 --> F4[แสดงเอกสารที่ OCR เสร็จแล้ว]
    end

    B3 -->|SSE| F1
```



### Chosen Solution: SSE (Server-Sent Events)

ใช้ **SSE** สำหรับ Backend → Frontend notification เมื่อ OCR/Pre-processing เสร็จ


| Aspect        | Details                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------- |
| **Backend**   | `GET /api/events/stream` — keep connection, ส่ง `{ documentId, status }` เมื่อ job เสร็จ |
| **Frontend**  | `EventSource('/api/events/stream')` — subscribe, `onmessage` → refetch + toast           |
| **Pros**      | ง่ายกว่า WebSocket, รองรับ auto reconnect, one-way (Backend → Frontend) เพียงพอ          |
| **Reconnect** | Browser reconnect อัตโนมัติเมื่อ connection หลุด                                         |


### Implementation (SSE)

**Backend — ตัวอย่าง Node.js/Express** (stack อื่นเทียบเท่าได้ เช่น Next.js App Router: `Route Handler` ที่ตั้ง `Content-Type: text/event-stream` และ stream `data: …\n\n` เหมือนกัน):

**Backend (Node.js/Express):**

```javascript
// GET /api/events/stream
app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // เมื่อ OCR job เสร็จ (จาก job queue callback)
  jobQueue.on('documentProcessed', (doc) => {
    sendEvent({ event: 'document_processed', documentId: doc.id, status: doc.status });
  });

  req.on('close', () => { /* cleanup */ });
});
```

**Frontend (React/Next.js):**

```javascript
useEffect(() => {
  const es = new EventSource('/api/events/stream');
  es.onmessage = (e) => {
    const { event, documentId, status } = JSON.parse(e.data);
    if (event === 'document_processed') {
      toast.success('ประมวลผลเสร็จ');
      refetch(); // React Query / SWR
      // หรือ router.refresh() สำหรับ Next.js
    }
  };
  return () => es.close();
}, []);
```

**Auto Reload behavior:** ใช้ `refetch()` (React Query/SWR) หรือ `router.refresh()` (Next.js) แทน `window.location.reload()` เพื่อ UX ที่ดีกว่า

### Description


| Sub-step           | Logic                                                     | Output                                    |
| ------------------ | --------------------------------------------------------- | ----------------------------------------- |
| 2.1 Page Split     | เช็ค "หน้า 1/2", Invoice No. → แยก 1 หน้า = 1 transaction | array of pages                            |
| 2.1 Document Merge | Tax ID เดียว + เดือนเดียวกัน → รวมเป็น 1 transaction      | merged doc                                |
| 2.2 OCR            | Claude / Google Vision / Tesseract                        | ocr_raw JSON                              |
| 2.3 Extract        | Regex Tax ID `\d{13}`, วันที่, Amount หลัง "รวมสุทธิ"     | issuer_tax_id, document_date, grand_total |
| 2.4 Mathematical Validation | Subtotal + VAT = Grand Total (Tolerance ±0.05) | Confidence_Score: ถูก = High (สีเขียว), ผิด = Low (สีแดง แจ้ง Maker แก้ตัวเลข) |


- **Background:** OCR ใช้เวลานาน — รันใน job queue, อัปเดต status (OCR_PROCESSING → DRAFT), แจ้งผู้ใช้เมื่อเสร็จผ่าน **SSE**
- **Notify + Reload:** Backend แจ้งเมื่อ job เสร็จ → Frontend แสดง toast และ refetch/reload เพื่อแสดงผลลัพธ์

### OCR Output / Fields Extracted (Step 2)

ฟิลด์ที่ Step 2 สกัดจาก OCR — เก็บใน `ocr_raw` และใช้ใน Step 3, 4


| OCR Field                          | Extraction                                                   | Used in Step 3                          | Used in Step 4                      |
| ---------------------------------- | ------------------------------------------------------------ | --------------------------------------- | ----------------------------------- |
| **issuer_tax_id**                  | Regex `\d{13}` ใกล้ "เลขประจำตัวผู้เสียภาษี"                 | Direction (REVENUE/EXPENSE), ข้อมูลครบ? | VAT Logic, Vendor lookup            |
| **issuer_name** / **company_name** | ใกล้ "ชื่อ", "ผู้ขาย", "ผู้ซื้อ"                             | ข้อมูลครบ? (ไม่มี → QUERY)              | Vendor lookup                       |
| **document_date**                  | Regex วันที่ ใกล้ "วันที่", "Date"                           | ข้อมูลครบ?                              | —                                   |
| **grand_total**                    | ตัวเลขหลัง "รวมสุทธิ", "Grand Total"                         | ข้อมูลครบ?                              | —                                   |
| **subtotal**                       | ตัวเลขหลัง "รวมก่อนภาษี", "Subtotal"                         | —                                       | WHT (ยอด ≥ 1000)                    |
| **vat_amount**                     | ตัวเลขหลัง "ภาษี", "VAT" หรือคำนวณจาก grand_total − subtotal | —                                       | Dr. ภาษีซื้อ                        |
| **document_type** / **document**   | คำในเอกสาร: "ใบกำกับภาษี", "ใบเสร็จ", "ใบแจ้งหนี้", "PO"     | doc_type, journal_type                  | VAT Logic (มีใบกำกับภาษี?)          |
| **line_items**                     | Array: description, amount ต่อรายการ                         | Keyword classification                  | WHT keywords, Product keyword match |


**Storage:** เก็บใน `document.ocr_raw` (JSON) — Extraction Detail UI แสดงและแก้ไขได้

---

## Step 3: Classification

### Flowchart

```mermaid
flowchart TD
    subgraph C3 [Classification]
        C3_1([รับจาก Step 2]) --> C3_2[3.1 ตรวจสอบข้อมูล]
        C3_2 --> C3_3[เทียบกับ Master Data]
        C3_3 --> C3_4{ข้อมูลครบ?}
        C3_4 -->|ไม่ครบ| C3_5[status = QUERY → Step 3a]
        C3_4 -->|ครบ| C3_6[3.2 แยกประเภท]
        C3_6 --> C3_7{direction?}
        C3_7 -->|issuer_tax_id == tenant_tax_id| C3_8[REVENUE]
        C3_7 -->|else| C3_9[EXPENSE]
        C3_8 --> C3_10{Revenue type?}
        C3_10 --> C3_11[RV ขายสด]
        C3_10 --> C3_12[SV ขายเชื่อ]
        C3_10 --> C3_13[OR รายได้อื่น]
        C3_9 --> C3_14{Expense type?}
        C3_14 -->|ใบเสร็จ/Receipt| C3_15[PV]
        C3_14 -->|ใบแจ้งหนี้/Invoice| C3_16[PurV]
        C3_14 -->|PO/ใบสั่งซื้อ| C3_17[PO → Step 3b]
        C3_14 -->|เงินทดรอง/Petty Cash| C3_18[JV]
        C3_14 -->|จ่ายมัดจำ| C3_19[PV]
        C3_14 -->|ใบลดหนี้/Credit Note| C3_19a[PurV Amount × -1]
        C3_14 -->|ใบเพิ่มหนี้/Debit Note| C3_19b[PurV ตามยอดเพิ่ม / นโยบายบัญชี]
        C3_19a --> C3_20
        C3_19b --> C3_20
        C3_11 --> C3_20([ส่ง Step 4])
        C3_12 --> C3_20
        C3_13 --> C3_20
        C3_15 --> C3_20
        C3_16 --> C3_20
        C3_18 --> C3_20
        C3_19 --> C3_20
    end
```



### Description


| Decision  | Condition                      | Result                     |
| --------- | ------------------------------ | -------------------------- |
| Direction | issuer_tax_id == tenant_tax_id | REVENUE                    |
| Direction | else                           | EXPENSE                    |
| Revenue   | รับเงินแล้ว                    | RV                         |
| Revenue   | ขายเชื่อ                       | SV                         |
| Revenue   | อื่นๆ                          | OR                         |
| Expense   | ใบเสร็จ/Receipt/บิลเงินสด      | PV                         |
| Expense   | ใบแจ้งหนี้/Invoice             | PurV                       |
| Expense   | PO/ใบสั่งซื้อ                  | PO (เก็บอ้างอิง, ไม่ลง GL) |
| Expense   | เงินทดรอง/Petty Cash           | JV                         |
| Expense   | จ่ายมัดจำ                      | PV                         |
| Expense   | ใบลดหนี้/Credit Note           | PurV (Amount × -1)          |
| Expense   | ใบเพิ่มหนี้/Debit Note          | PurV (Amount เพิ่ม / บันทึกตามนโยบายบัญชี) |


### OCR Info Used in Step 3


| OCR Field (from Step 2)            | Use in Step 3                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **issuer_tax_id**                  | เปรียบเทียบกับ tenant_tax_id → Direction (REVENUE/EXPENSE); ตรวจสอบ 13 หลัก → ข้อมูลครบ?                                                     |
| **tenant_tax_id**                  | จาก Master Data (Client) — ใช้เปรียบเทียบกับ issuer_tax_id                                                                                   |
| **document_date**                  | ตรวจสอบว่ามีค่า → ข้อมูลครบ?                                                                                                                 |
| **grand_total** / **subtotal**     | ตรวจสอบว่ามีค่า → ข้อมูลครบ?                                                                                                                 |
| **issuer_name** / **company_name** | ตรวจสอบว่ามีชื่อผู้ซื้อ/ผู้ขาย → ข้อมูลครบ? (ไม่มี → QUERY)                                                                                  |
| **document_type** / **document**   | คำว่า "ใบเสร็จ", "Receipt", "ใบแจ้งหนี้", "Invoice", "PO", "ใบสั่งซื้อ", "เงินทดรอง", "Petty Cash", "จ่ายมัดจำ", "ใบลดหนี้", "Credit Note", "ใบเพิ่มหนี้", "Debit Note" → แยก doc_type, journal_type |
| **line_items** (description)       | Keyword match สำหรับ classification (ใบเสร็จรับเงิน, ใบแจ้งหนี้ ฯลฯ)                                                                         |


- **Background:** Classification + Validation รันต่อจาก OCR — background job, อัปเดต direction, journal_type, doc_type
- **Petty Cash clearing (เคลียร์เงินทดรอง):** ชุดเอกสารมี "ใบเบิกเงินทดรอง", "ใบเบิกชดเชยเงินสดย่อย" + แนบบิลหลายใบ → ส่ง JV หรือ PV, Multiple Line Items: Dr. ค่าใช้จ่าย 1, Dr. ค่าใช้จ่าย 2, Dr. ภาษีซื้อ | Cr. เงินทดรองจ่าย/เงินสดย่อย
- **Duplicate Detection (บังคับใช้งาน production):** เมื่อพบบิลซ้ำตามกฎที่ตั้งค่า (เช่น Vendor + Amount + Date ±N วัน) — บล็อกหรือแจ้งเตือนให้ Maker ยืนยันก่อนดำเนินการต่อ; แสดง badge / toast / flag บนเอกสาร — **ความไว** ควรตั้งค่าได้ต่อ tenant

---

## Step 3a: Query Tray

### Flowchart

```mermaid
flowchart TD
    subgraph Q [Query Tray - ไม่ต้อง Re-upload]
        Q1([เอกสาร status = QUERY]) --> Q2[สาเหตุ: Tax ID อ่านไม่ได้ / บิลเบลอ / ไม่มีชื่อผู้ซื้อ]
        Q2 --> Q3[แสดงใน Query Tray UI]
        Q3 --> Q4[Maker เปิด Extraction Detail UI]
        Q4 --> Q5[View หรือ Edit OCR extraction data]
        Q5 --> Q6[แก้ไข Tax ID, วันที่, ยอด, ชื่อผู้ซื้อ ฯลฯ]
        Q6 --> Q7[บันทึก]
        Q7 --> Q7a[Call API: PATCH /documents/:id - update extraction data]
        Q7a --> Q8[Re-run Classification หรือส่งต่อ Step 4]
        Q8 --> Q9([ดำเนินการต่อ])
    end
```



### Description

- **Trigger:** ข้อมูลไม่ครบจาก Step 3.1 (Tax ID, วันที่, ยอด, ชื่อผู้ซื้อ)
- **Action:** ไม่ต้อง re-upload — Maker เปิด **Extraction Detail UI** (หน้าเดียวกับ Step 2) เพื่อ view หรือ edit รายละเอียด OCR โดยตรง
- **Extraction Detail UI:** แสดงและแก้ไขได้ — Tax ID, วันที่, ยอด, ชื่อบริษัท, line items, ฯลฯ
- **หลังแก้ไข:** บันทึก → Frontend เรียก `PATCH /documents/:id` เพื่อ persist ข้อมูลที่แก้ไขไปยัง Backend (อัปเดต ocr_raw และฟิลด์ที่เกี่ยวข้อง) → Re-run Classification (Step 3) หรือส่งต่อ Step 4 ตามข้อมูลที่แก้ไข

---

## Step 3b: PO Matching

### Flowchart

```mermaid
flowchart TD
    subgraph PO [PO Matching]
        PO1([เอกสารประเภท PO]) --> PO2[เก็บใน PO_STORE]
        PO2 --> PO3[ไม่มี Journal Entry]
        PO3 --> PO4[รอ Invoice มาถึง]
        PO4 --> PO5([Invoice มาผ่าน Step 2, 3])
        PO5 --> PO6{จับคู่ PO ได้?}
        PO6 -->|เปรียบเทียบ Vendor, จำนวนเงิน, รายการ| PO7[ได้]
        PO6 -->|ไม่ตรง| PO8[ไม่ได้]
        PO7 --> PO9[link invoice.linked_po_id = po.id]
        PO9 --> PO10[PurV + อ้างอิง PO]
        PO8 --> PO10
        PO10 --> PO11([ส่ง Step 4])
    end
```



### Description

- **PO:** เก็บเป็นอ้างอิง ไม่ลง GL
- **Match:** เมื่อมี Invoice → เปรียบเทียบ Vendor, จำนวนเงิน, รายการ
- **Result:** ถ้าจับคู่ได้ → ตั้ง `linked_po_id`; ถ้าไม่ได้ → ลง PurV ตามปกติ

---

## Step 4: Tax & GL Mapping

### Flowchart

```mermaid
flowchart TD
    subgraph T4 [Tax & GL Mapping]
        T4_1([รับจาก Step 3]) --> T4_2{4.1 VAT Logic}
        T4_2 --> T4_2a{มีใบกำกับภาษี?}
        T4_2a -->|ใช่| T4_2a1{วันที่ไม่เกิน 6 เดือน?}
        T4_2a1 -->|ใช่| T4_2b[แยก Dr. ภาษีซื้อ]
        T4_2a1 -->|ไม่| T4_2b2[ภาษีซื้อต้องห้าม/รอขอคืน]
        T4_2a -->|ไม่| T4_2c[รวม VAT เข้า expense]
        T4_2b --> T4_3{4.1 WHT Logic}
        T4_2b2 --> T4_3
        T4_2c --> T4_3
        T4_3 --> T4_3a{มีคำว่า ค่าบริการ/ค่าเช่า?}
        T4_3a -->|ใช่ + ยอด>=1000| T4_3b[คำนวณ WHT, Cr. ภาษีหัก ณ ที่จ่าย]
        T4_3b --> T4_3b1[Generate PDF หนังสือรับรอง 50 ทวิ]
        T4_3b1 --> T4_4[4.2 GL Mapping]
        T4_3a -->|ไม่| T4_4
        T4_4 --> T4_5{ค้นหา Vendor}
        T4_5 -->|เจอ| T4_6[ใช้ default_expense_gl]
        T4_5 -->|ไม่เจอ| T4_7{ค้นหา Keyword ใน Products}
        T4_7 -->|เจอ| T4_8[ใช้ expense_gl/income_gl]
        T4_7 -->|ไม่เจอ| T4_9[Suspense Account]
        T4_6 --> T4_10[สร้าง journal_lines]
        T4_8 --> T4_10
        T4_9 --> T4_10
        T4_10 --> T4_11([ส่ง Step 5])
    end
```



### Description


| Sub-step | Logic                                       | Output                            |
| -------- | ------------------------------------------- | --------------------------------- |
| 4.1 VAT  | ใบกำกับภาษี + Tax ID ครบ + **วันที่ไม่เกิน 6 เดือน** → แยก Dr. ภาษีซื้อ | vat_amount, journal line          |
| 4.1 VAT  | วันที่เกิน 6 เดือน → ภาษีซื้อต้องห้าม/รอขอคืน (ไม่แยก Dr. ภาษีซื้อ) | —                                 |
| 4.1 VAT  | บิลเงินสด → รวม VAT ใน expense              | ไม่มี Dr. ภาษีซื้อ                |
| 4.1 WHT  | ประเภทรายการที่เข้าข่ายหัก ณ ที่จ่าย (ดูคีย์เวิร์ดใน `line_items` เช่น ค่าบริการ, ค่าเช่า, ค่าขนส่ง, ค่าโฆษณา ฯลฯ) + เกณฑ์ยอด (เช่น ≥ 1,000 บ.) → **อัตราตามตารางกฎหมาย/ประเภทรายได้** (ไม่จำกัดแค่ 3%/5%) + **Generate PDF หนังสือรับรอง 50 ทวิ** | wht_amount, Cr. ภาษีหัก ณ ที่จ่าย, ไฟล์ 50 ทวิ |
| 4.2 GL   | Vendor match → default_expense_gl           | accountCode                       |
| 4.2 GL   | Product keyword match → expense_gl          | accountCode                       |
| 4.2 GL   | ไม่เจอ → Suspense                           | accountCode = suspense            |

- **VAT 6-month rule:** วันที่เอกสารไม่เกิน 6 เดือนนับจากเดือนปัจจุบัน — ถ้าเกินถือเป็นภาษีซื้อต้องห้าม/รอขอคืน
- **50 ทวิ PDF:** เมื่อมี WHT → สร้างไฟล์ PDF "หนังสือรับรองการหัก ณ ที่จ่าย" อัตโนมัติ เพื่อส่งให้ Vendor
- **AI Cross-Learning (optional):** แม้ Vendor แยกตาม Tenant — AI สามารถ Suggest GL ข้ามบริษัทได้ (เช่น 80% Map "การไฟฟ้า" → "ค่าไฟฟ้า" → Suggest ให้ลูกค้าใหม่)

### OCR Info Used in Step 4


| OCR Field (from Step 2)            | Use in Step 4                                                       |
| ---------------------------------- | ------------------------------------------------------------------- |
| **document_type** / **document**   | มีคำว่า "ใบกำกับภาษี" หรือไม่ → VAT Logic (แยกหรือรวม)              |
| **issuer_tax_id**                  | 13 หลัก ครบหรือไม่ → VAT (ต้องมีถึงจะแยก Dr. ภาษีซื้อได้)           |
| **vat_amount**                     | ยอดภาษีจาก OCR → สร้าง journal line Dr. ภาษีซื้อ                    |
| **subtotal** / **grand_total**     | ยอดก่อน VAT → ใช้คำนวณ WHT (ถ้า subtotal ≥ 1000)                    |
| **line_items** (description)       | Keyword: "ค่าบริการ", "ค่าเช่า", "ค่าขนส่ง", "ค่าโฆษณา" → WHT Logic |
| **issuer_tax_id**                  | ค้นหา Vendors.tax_id → Vendor match → default_expense_gl            |
| **issuer_name** / **company_name** | ใช้ร่วมกับ tax_id สำหรับ Vendor lookup                              |
| **line_items** (description)       | Keyword match กับ Products.keywords → expense_gl / income_gl        |


- **Background:** Classification (Step 3) และ Tax & GL Mapping (Step 4) มักรันต่อกันใน background หลัง OCR เสร็จ

---

## Step 5: Journal

### Flowchart

```mermaid
flowchart TD
    subgraph J5 [Journal Assignment]
        J5_1([รับ journal_lines จาก Step 4]) --> J5_2{journal_type?}
        J5_2 -->|RV| J5_3[สมุดรายวันรับ]
        J5_2 -->|SV| J5_4[สมุดรายวันขาย]
        J5_2 -->|PV| J5_5[สมุดรายวันจ่าย]
        J5_2 -->|PurV| J5_6[สมุดรายวันซื้อ]
        J5_2 -->|JV| J5_7[สมุดรายวันทั่วไป]
        J5_3 --> J5_8[สร้าง VoucherNo: RVyymm-001]
        J5_4 --> J5_9[สร้าง VoucherNo: SVyymm-001]
        J5_5 --> J5_10[สร้าง VoucherNo: PVyymm-001]
        J5_6 --> J5_11[สร้าง VoucherNo: PurVyymm-001]
        J5_7 --> J5_12[สร้าง VoucherNo: JVyymm-001]
        J5_8 --> J5_13[Balance Check: Sum Dr = Sum Cr]
        J5_9 --> J5_13
        J5_10 --> J5_13
        J5_11 --> J5_13
        J5_12 --> J5_13
        J5_13 --> J5_14{Balance OK?}
        J5_14 -->|ใช่| J5_15([ส่ง Step 6])
        J5_14 -->|ไม่| J5_16[ERROR: ต้องแก้ไข]
    end
```



### Description

- **VoucherNo format:** `{JournalType}{YY}{MM}-{seq}` เช่น PV6701-001
- **Balance rule:** Sum(debit) = Sum(credit) ก่อนส่งต่อ
- **Journal types:** RV, SV, PV, PurV, JV

---

## Step 6: Maker/Checker

### Flowchart

```mermaid
flowchart TD
    subgraph MC [Maker/Checker]
        MC1([รับจาก Step 5]) --> MC2[6.1 Maker ตรวจสอบ]
        MC2 --> MC3[ดู journal_lines, แก้ไขถ้าผิด]
        MC3 --> MC4[แก้ตัวเลข OCR ผิด]
        MC4 --> MC5[เลือก GL ถ้า Suspense]
        MC5 --> MC6[กด ส่งขออนุมัติ]
        MC6 --> MC7[status = PENDING_APPROVAL]
        MC7 --> MC8[6.2 Checker อนุมัติ]
        MC8 --> MC9{ตรวจสอบ}
        MC9 -->|ผิด| MC10[กด Reject + Comment]
        MC9 -->|ถูก| MC11[กด Approve]
        MC10 --> MC12[status = REJECTED]
        MC12 --> MC2
        MC11 --> MC13[status = APPROVED]
        MC13 --> MC14[6.3 บันทึก Rule]
        MC14 --> MC15[ถ้า Maker แก้ GL → บันทึก GLMappingRules]
        MC15 --> MC16([ส่ง Step 7])
    end
```



### Description


| Role          | Action                    | Next                                 |
| ------------- | ------------------------- | ------------------------------------ |
| Maker         | ตรวจ แก้ไข ส่งขออนุมัติ   | PENDING_APPROVAL                     |
| Checker       | Reject + Comment          | กลับให้ Maker                        |
| Checker       | Approve                   | APPROVED → บันทึก Rule               |
| Rule Learning | Maker แก้ GL จาก Suspense | บันทึก keyword → GL สำหรับครั้งถัดไป |


---

## Step 7: Export

### Flowchart

```mermaid
flowchart TD
    subgraph E7 [Export - Overall]
        E7_1([รับ APPROVED docs]) --> E7_2{7.1 ประมวลผลตามรอบ}
        E7_2 --> E7_2a[Daily]
        E7_2 --> E7_2b[Monthly]
        E7_2 --> E7_2c[Yearly]
        E7_2b --> E7_3[7.2 Filter: tenant, period, journal]
        E7_2a --> E7_3
        E7_2c --> E7_3
        E7_3 --> E7_4[7.3.1 Select Export Template]
        E7_4 --> E7_5[7.3.2 Document Selection]
        E7_5 --> E7_5a[Strong / Suitable / Other Matches]
        E7_5a --> E7_5b[เลือกเอกสาร → Preview Excel / Express TXT]
        E7_5b --> E7_6[7.3.3 Preview Modal]
        E7_6 --> E7_6a[Export Mode: Document Level vs Item Level]
        E7_6a --> E7_6b[Preview table + Records, Date Range, Total]
        E7_6b --> E7_7[7.3.4 Download / Save to Location]
        E7_7 --> E7_8[สร้างไฟล์ Excel หรือ Express .txt]
        E7_8 --> E7_9[Format H| D| ตาม Express]
        E7_9 --> E7_10[Balance check ก่อน export]
        E7_10 --> E7_11[status = EXPORTED]
        E7_11 --> E7_12[immutable post-export: ห้ามแก้รายการที่ส่งออกแล้ว — แก้ผ่าน Step 7b]
        E7_12 --> E7_13([ไฟล์พร้อมดาวน์โหลด])
    end
```



### Description

- **หลัง Export (สถานะ EXPORTED):** เอกสารที่รวมในไฟล์ Express แล้วถือเป็น **ถูกส่งมอบต่อระบบบัญชี** — ไม่แก้ยอด/สมุดบนเอกสารเดิม; การแก้ทำผ่าน **Step 7b (Reversal JV + รายการใหม่)** — คนละเรื่องกับ **Step 7a Period Lock** ที่ล็อกทั้งงวดตาม `document_date` (ทั้งคู่ใช้ร่วมกันได้: งวดล็อก + เอกสารที่ export แล้วไม่แก้ย้อนหลัง)
- **7.1 รอบเวลา:** Daily (bank recon), Monthly (export, ภาษี, Tax Report, Prepayments, Lock Period), Yearly (Depreciation, ปิดงบ)
- **7.2 รายเดือน:** Filter ตาม tenant_id, year_month, journal_type
- **7.3 Format:** Header `H|`, Detail `D|` ตามโครงสร้าง Express
- **Tax Report:** จาก Export — สร้างรายงาน ภ.พ.30 (ภาษีซื้อ-ขาย), ภ.ง.ด. 3/53 (ภาษีหัก ณ ที่จ่าย)
- **Monthly: Prepayments** — ตัดจำหน่ายค่าใช้จ่ายจ่ายล่วงหน้า (Prepayments)
- **Yearly: Depreciation** — คำนวณค่าเสื่อมราคาสินทรัพย์ (Depreciation), ล้างบัญชีรายได้-ค่าใช้จ่ายเข้ากำไรสะสม
- **Background:** Export ข้อมูลจำนวนมาก — สร้างไฟล์ใน background, แจ้งเมื่อพร้อมดาวน์โหลด (หรือส่งลิงก์อีเมล)

### 7.3 Export Engine (UI Reference)

Flow ตาม UI อ้างอิง — เลือก Template → เลือกเอกสาร → Preview → Download

```mermaid
flowchart TD
    subgraph E73 [7.3 Export Engine UI Flow]
        E73_1[7.3.1 Select Export Template]
        E73_1 --> E73_1a[รายการธุรกรรม: ขายเชื่อ, ขายสด, รายได้อื่นๆ]
        E73_1 --> E73_1b[ค่าใช้จ่าย: ใบสั่งซื้อ, ค่าใช้จ่ายอื่นๆ, จ่ายมัดจำ, ซื้อเชื่อ, ซื้อสด]
        E73_1 --> E73_1c[ข้อมูลหลัก: ผู้จำหน่าย, ลูกค้า, สินค้า - เร็วๆ นี้]
        E73_1 --> E73_1d[สมุดรายวัน: จ่าย, รับ - เร็วๆ นี้]
        E73_1a --> E73_2[7.3.2 Document Selection]
        E73_1b --> E73_2
        E73_2 --> E73_2a[Back to Templates]
        E73_2 --> E73_2b[Template name + X documents matched]
        E73_2 --> E73_2c[Strong Matches / Suitable Matches / Other Documents]
        E73_2c --> E73_2d[Select all matched, Group by Match Strength]
        E73_2d --> E73_2e[Table: Date, Document Name, Counterparty, Amount, Category]
        E73_2e --> E73_2f[Preview Excel หรือ Preview Express TXT]
        E73_2f --> E73_3[7.3.3 Preview Modal]
        E73_3 --> E73_3a[Export Mode: Document Level vs Item Level]
        E73_3a --> E73_3b[Document Level: 1 doc = 1 row]
        E73_3a --> E73_3c[Item Level: 1 item = 1 row]
        E73_3b --> E73_3d[Records, Date Range, Total Amount]
        E73_3c --> E73_3d
        E73_3d --> E73_3e[Preview table: วันที่, เลขที่เอกสาร, ชื่อลูกค้า]
        E73_3e --> E73_3f[Ready to Download - formatted for Express]
        E73_3f --> E73_4[7.3.4 Download]
        E73_4 --> E73_4a[Excel: Download Excel File]
        E73_4 --> E73_4b[Express TXT: Save to Location]
    end
```

| Sub-step | UI Element | Description |
|----------|------------|-------------|
| **7.3.1 Select Template** | Grid "Select Export Template" | "Choose a template that matches your documents" — แยกตามหมวด: รายการธุรกรรม (ขายเชื่อ, ขายสด, รายได้อื่นๆ), ค่าใช้จ่าย (ใบสั่งซื้อ, ค่าใช้จ่ายอื่นๆ, จ่ายมัดจำ, ซื้อเชื่อ, ซื้อสด), ข้อมูลหลัก (เร็วๆ นี้), สมุดรายวัน (เร็วๆ นี้) — แต่ละ card แสดง "X strong", "Y suitable" หรือ "0 matches" |
| **7.3.2 Document Selection** | Table + filters | Back to Templates; Template name + "X documents matched"; Select all matched; Group by Match Strength; Show All Documents; แสดง Strong Matches / Suitable Matches / Other Documents; คอลัมน์: Select, Match, Date, Document Name, Counterparty, Amount, Category; ปุ่ม Cancel + Preview Excel |
| **7.3.3 Preview** | Modal "Excel Preview - [template]" | Export Mode: Document Level (1 doc = 1 row, total amount) หรือ Item Level (1 item = 1 row); แสดง Records, Date Range, Total Amount; Preview table; "The Excel file will be formatted for Express Accounting Software"; Back to Selection + Download Excel File |
| **7.3.4 Download** | Buttons | Excel: Download Excel File; Express TXT: Save to Location (ให้ผู้ใช้เลือกตำแหน่งบันทึกด้วย showSaveFilePicker) |

**UI Reference Images:** อ้างอิง `assets/...` (screenshots 07.1–07.3) — หากยังไม่ได้ commit ไฟล์รูปใน repo นี้ ให้ถือแถวตารางด้านล่างเป็น **สเปก UI** จนกว่าจะมี asset จริง

| Screen | UI Flow | Image Ref |
|--------|---------|-----------|
| **Select Export Template** | Grid: "Choose a template that matches your documents" — หมวด รายการธุรกรรม (ขายเชื่อ, ขายสด, รายได้อื่นๆ), ค่าใช้จ่าย (ใบสั่งซื้อ, ค่าใช้จ่ายอื่นๆ, จ่ายมัดจำ, ซื้อเชื่อ, ซื้อสด), ข้อมูลหลัก, สมุดรายวัน — แต่ละ card แสดง X strong / Y suitable | `assets/.../07.1_0-*.png` |
| **Document Selection** | Back to Templates; Template name + "X documents matched"; Strong Matches / Suitable Matches / Other Documents; Select all matched; Group by Match Strength; Table: Date, Document Name, Counterparty, Amount, Category; Cancel + Preview Excel | `assets/.../07.2_0-*.png`, `assets/.../07_0-*.png` |
| **Excel/Express Preview** | Modal: "Excel Preview - [template name]"; Export Mode: Document Level (1 doc = 1 row) vs Item Level (1 item = 1 row); Records, Date Range, Total Amount; Preview table; "Ready to Download" — formatted for Express; Back to Selection + Download Excel File / Save to Location | `assets/.../07.3_0-*.png` |

### Match Strength Logic (Strong / Suitable / Other)

เอกสารแต่ละรายการถูกเปรียบเทียบกับ **Express Template** ที่เลือก — แต่ละ template มี `direction`, `journalTypes`, `categoryKeywords`

| Condition | ความหมาย |
|-----------|----------|
| **directionMatch** | ทิศทางบัญชี (REVENUE/EXPENSE) ของเอกสารตรงกับ template |
| **journalMatch** | `journalType` ของเอกสาร (RV, SV, PV, PurV, JV) อยู่ใน `journalTypes` ของ template |
| **keywordMatch** | category หรือ document name ของเอกสารมีคำใน `categoryKeywords` ของ template |

| Match Strength | เงื่อนไข | ความหมาย |
|----------------|----------|----------|
| **Strong** | directionMatch **และ** journalMatch **และ** keywordMatch | ตรงทั้ง 3 อย่าง — ความมั่นใจสูง แนะนำให้ export ได้เลย |
| **Suitable** | directionMatch **และ** (journalMatch **หรือ** keywordMatch) | ตรง 2 อย่าง — ความมั่นใจปานกลาง ควรตรวจก่อน export |
| **Other (Manual)** | directionMatch เท่านั้น หรือไม่ตรง template | ต้องเลือก template / แก้ไขด้วยตนเอง |

**ตัวอย่าง:**

- **Strong:** Template ขายสด (RV, keywords: ขายอาหาร, receipt) + เอกสาร journalType=RV, category="ขายอาหาร" → ตรงทั้ง 3
- **Suitable:** Template ขายสด + เอกสาร journalType=RV, category="ขายเครื่องดื่ม" → ตรง direction + journal แต่ไม่ตรง keyword
- **Other:** เอกสาร journalType=JV หรือ category="รายจ่าย" ไม่ตรง template → Manual

**Data ที่ใช้:** `transactionDirection` / `cashflowType`, `journalType`, `expense_category` / `expense_type`, line items description

**UI:** Strong = badge สีเขียว, Suitable = badge สีเหลือง, Other = badge สีม่วง (Manual)

### Suggested: Multiple Export Template Selection (ตามฝ่ายบัญชี / Accounting Part)

รองรับหลาย Template ตาม **ฝ่ายบัญชี** หรือ **ประเภทบัญชี** — แต่ละฝ่ายอาจใช้รูปแบบ Express ต่างกัน


| Selection Basis                 | Use Case                    | Example                                                 |
| ------------------------------- | --------------------------- | ------------------------------------------------------- |
| **accounting_part** (ฝ่ายบัญชี) | แยกตามทีม/ฝ่ายที่ดูแลลูกค้า | ฝ่าย A: ลูกค้าประเภทขายปลีก, ฝ่าย B: ลูกค้าประเภทบริการ |
| **journal_type**                | แยกไฟล์ตามสมุดรายวัน        | PV+PurV ไฟล์หนึ่ง, JV อีกไฟล์                           |
| **client_type**                 | แยกตามประเภทนิติบุคคล       | บริษัทจำกัด, ห้างหุ้นส่วน, ร้านค้าเดี่ยว                |
| **express_version**             | รูปแบบ TXT ต่างเวอร์ชัน     | Express เก่า vs ใหม่                                    |


**Flow:**

```mermaid
flowchart TD
    subgraph E7_Multi [Export with Template Selection]
        E7M_1([รับ APPROVED docs]) --> E7M_2[7.1 เลือก Accounting Part / Template Group]
        E7M_2 --> E7M_2a[ฝ่าย A: Template A]
        E7M_2 --> E7M_2b[ฝ่าย B: Template B]
        E7M_2 --> E7M_2c[รวมทั้งหมด]
        E7M_2a --> E7M_3[Filter docs ตาม template rules]
        E7M_2b --> E7M_3
        E7M_2c --> E7M_3
        E7M_3 --> E7M_4[7.2 Export Engine ใช้ template ที่เลือก]
        E7M_4 --> E7M_5[สร้างไฟล์ .txt ตาม template]
        E7M_5 --> E7M_6{Export แยกตาม Part?}
        E7M_6 -->|ใช่| E7M_7[ไฟล์ A: express-partA-yymm.txt]
        E7M_6 -->|ใช่| E7M_8[ไฟล์ B: express-partB-yymm.txt]
        E7M_6 -->|ไม่| E7M_9[ไฟล์เดียว: express-yymm.txt]
        E7M_7 --> E7M_10([ดาวน์โหลด])
        E7M_8 --> E7M_10
        E7M_9 --> E7M_10
    end
```



**Data model suggestion:**


| Table / Field                       | Purpose                                              |
| ----------------------------------- | ---------------------------------------------------- |
| `express_templates.accounting_part` | ฝ่ายบัญชี เช่น "A", "B", "ทั่วไป"                    |
| `express_templates.template_group`  | กลุ่ม template สำหรับเลือกตอน export                 |
| `tenants.default_export_template`   | Template เริ่มต้นของ tenant                          |
| `export_template_selections`        | บันทึกว่า user เลือก template ใดเมื่อ export (audit) |


**UI:** หน้า Export — dropdown "ฝ่ายบัญชี / Template" ก่อนกด Export; หรือ checkbox "Export แยกตามฝ่าย" → ได้หลายไฟล์

---

## Step 7a: Period Lock

### Flowchart

```mermaid
flowchart TD
    subgraph PL [Period Lock]
        PL1([หลัง Export รายเดือน]) --> PL2[Admin กด ล็อกงวด]
        PL2 --> PL3[เลือก year_month เช่น 2025-01]
        PL3 --> PL4[บันทึก period_locks]
        PL4 --> PL5[locked_by, locked_at]
        PL5 --> PL6[Effect: เอกสารที่ date ในงวด]
        PL6 --> PL7[disable Edit]
        PL7 --> PL8[disable Delete]
        PL8 --> PL9{ต้องการยกเลิกล็อก?}
        PL9 -->|Admin only| PL10[DELETE period_locks]
    end
```



### Description

- **Table:** `period_locks(tenant_id, year_month, locked_by, locked_at)`
- **Effect:** เอกสารที่ `document_date` อยู่ในงวดที่ล็อก → ห้าม Edit/Delete

---

## Step 7b: Correction/Reversal

### Flowchart

```mermaid
flowchart TD
    subgraph CR [Correction/Reversal]
        CR1([เอกสาร status = EXPORTED]) --> CR2{พบข้อผิด?}
        CR2 -->|ไม่| CR3[Done]
        CR2 -->|ใช่| CR4[สร้างรายการแก้ไข JV]
        CR4 --> CR5[Dr/Cr ย้อนกลับรายการเดิม]
        CR5 --> CR6[+ Dr/Cr รายการที่ถูกต้อง]
        CR6 --> CR7[reverses_document_id = doc เดิม]
        CR7 --> CR8[status = PENDING_APPROVAL]
        CR8 --> CR9[ส่งขออนุมัติ Checker]
        CR9 --> CR10[Checker Approve]
        CR10 --> CR11[Export รายการแก้ไขเพิ่ม]
        CR11 --> CR12[ไฟล์ .txt แยก หรือ append]
    end
```



### Description

- **Method:** Reversal JV (Dr↔Cr ย้อนรายการเดิม) + รายการที่ถูกต้อง
- **Link:** `reverses_document_id` ชี้ไปที่ document เดิม
- **Export:** Export เป็นไฟล์เพิ่ม → นำเข้า Express แยก

---

## Step 7c: Bank Reconciliation

### Flowchart

```mermaid
flowchart TD
    subgraph BR [Bank Reconciliation]
        BR1([มี Export PV/RV]) --> BR2[Journal entries จาก APPROVED/EXPORTED]
        BR2 --> BR3[อัปโหลด Bank Statement]
        BR3 --> BR4[POST /tenants/:tenantId/bank-statements]
        BR4 --> BR5[บันทึก line_items: date, amount, ref]
        BR5 --> BR6[จับคู่กับ Journal entries]
        BR6 --> BR7{Match?}
        BR7 -->|ได้| BR8[รายการตรงกัน]
        BR7 -->|ไม่ได้| BR9[รายการรอตรวจสอบ]
        BR9 --> BR10[ให้คนตรวจสอบ]
        BR10 --> BR11[แก้ไขหรือเพิ่มรายการ]
    end
```



### Description

- **API:** อัปโหลด/สร้าง bank statement ภายใต้บริบท tenant — `POST /tenants/:tenantId/bank-statements` (หรือเทียบเท่า) เพื่อให้สอดคล้องกับ route อื่นที่มี `tenant_id`
- **Input:** Bank statement (upload หรือ API ธนาคาร)
- **Match:** เปรียบเทียบ date, amount, reference ระหว่าง bank กับ journal
- **Output:** รายการที่ตรงกัน / รายการรอตรวจสอบ

---

## Summary: Step Order Reference


| Step | Title               | Key Output                        |
| ---- | ------------------- | --------------------------------- |
| 0    | Onboarding          | tenant, master data, assignments  |
| 0.1  | Staff Assignment    | tenant_assignments                |
| 0.2  | เลือก Workspace     | tenant_id context                 |
| 1    | Document Intake     | document + intake_source          |
| 2    | Pre-processing      | ocr_raw, extracted fields         |
| 3    | Classification      | direction, journal_type, doc_type |
| 3a   | Query Tray          | notify → resubmit                 |
| 3b   | PO Matching         | linked_po_id                      |
| 4    | Tax & GL Mapping    | journal_lines, vat, wht           |
| 5    | Journal             | voucher_no, balanced entries      |
| 6    | Maker/Checker       | APPROVED, rule learning           |
| 7    | Export              | Express .txt, EXPORTED            |
| 7a   | Period Lock         | period_locks                      |
| 7b   | Correction/Reversal | reversal JV                       |
| 7c   | Bank Reconciliation | matched/unmatched                 |


