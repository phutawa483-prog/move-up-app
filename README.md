# MOVE UP — Backend Server

เซิร์ฟเวอร์เล็กๆ ที่ทำหน้าที่เป็นตัวกลาง (proxy) ระหว่างแอป MOVE UP กับ Anthropic API
ทำให้ API key ของคุณอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่หลุดไปอยู่ในโค้ดฝั่งเบราว์เซอร์

มี 2 endpoint ตรงกับที่หน้าเว็บเรียกอยู่แล้ว:
- `POST /api/analyze-basketball` — รับภาพเฟรมจากคลิป (multipart/form-data) → ส่งให้ Claude วิเคราะห์ → คืน JSON ผลคะแนน
- `POST /api/ai-coach` — รับประวัติแชท → ส่งให้ Claude ตอบ → คืนคำตอบภาษาไทย/อังกฤษ

หน้าเว็บ (`public/move-up-app.html`) ถูก serve ให้เองจากเซิร์ฟเวอร์นี้เลย ไม่ต้องแยกโฮสต์

## รันบนเครื่องตัวเอง (local)

ต้องมี [Node.js](https://nodejs.org) เวอร์ชัน 18 ขึ้นไป (ต้องมี `fetch` ในตัว)

```bash
cd move-up-server
npm install
cp .env.example .env
# แก้ .env ใส่ ANTHROPIC_API_KEY ของคุณเอง (หาได้ที่ https://console.anthropic.com/settings/keys)
npm start
```

แล้วเปิด `http://localhost:3000` จะเจอแอป MOVE UP ที่ใช้งาน AI ได้จริง

## Deploy ขึ้นเว็บจริง

ใช้ได้กับแพลตฟอร์มที่รัน Node.js server ได้ทั่วไป เช่น Render, Railway, Fly.io, หรือ VPS ของคุณเอง
ขั้นตอนหลักๆ เหมือนกันหมด:

1. อัปโหลดโค้ดโฟลเดอร์นี้ขึ้น Git repository (GitHub/GitLab)
2. เชื่อม repo กับแพลตฟอร์มที่เลือก
3. ตั้งค่า Environment Variable ชื่อ `ANTHROPIC_API_KEY` เป็นคีย์จริงของคุณ (**ห้ามใส่ในโค้ดหรือ commit ลง git**)
4. Build command: `npm install` — Start command: `npm start`
5. แพลตฟอร์มจะให้ URL มา (เช่น `https://move-up.onrender.com`) เปิดแล้วใช้งานได้ทันที

### ตัวอย่าง: Deploy บน Render (ฟรีเริ่มต้นได้)
1. สมัคร/ล็อกอิน https://render.com แล้วกด "New Web Service"
2. เชื่อม GitHub repo ที่มีโฟลเดอร์นี้
3. Environment: `Node`, Build Command: `npm install`, Start Command: `npm start`
4. ไปที่ Environment → เพิ่ม `ANTHROPIC_API_KEY`
5. กด Deploy รอสักครู่ก็จะได้ลิงก์ใช้งานจริง

## หมายเหตุด้านความปลอดภัย

- อย่า commit ไฟล์ `.env` ขึ้น git (มีอยู่ใน `.gitignore` แล้ว)
- จำกัดขนาดไฟล์ที่อัปโหลดไว้แล้ว (8MB ต่อเฟรม, สูงสุด 10 เฟรม) ป้องกันการยิงไฟล์ใหญ่เกินจำเป็น
- ถ้าจะเปิดให้คนทั่วไปใช้งานจำนวนมาก ควรเพิ่ม rate limiting (เช่น `express-rate-limit`) กัน API key ถูกใช้เกินโควตา
