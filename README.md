# Hệ thống mô phỏng phỏng vấn giọng nói

Phỏng vấn hai chiều: AI đọc câu hỏi (TTS) → ứng viên trả lời (STT/micro) → nhận xét ngắn bằng giọng nói → báo cáo chi tiết cuối buổi.

## Cấu trúc

- `backend/` — FastAPI + SQLAlchemy (SQLite local; MySQL qua `DATABASE_URL` khi deploy)
- `frontend/` — React + Vite, Web Speech API (TTS/STT), fallback nhập text

## Chạy nhanh

```bash
start-all.bat
```

Hoặc chạy riêng từng phần:

```bash
start-backend.bat
start-frontend.bat
```

## Chạy backend thủ công

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Chạy frontend thủ công

```bash
cd frontend
npm install
npm run dev
```

Mở http://localhost:5173 hoặc http://127.0.0.1:5173. Frontend proxy `/api` sang backend `http://127.0.0.1:8000`.

## Triển khai online

GitHub Pages có thể host frontend; backend FastAPI và cơ sở dữ liệu MySQL cần chạy trên các dịch vụ riêng. Xem [TRIEN_KHAI_DOMAIN.md](TRIEN_KHAI_DOMAIN.md) để cấu hình biến môi trường, CORS, GitHub Pages và domain.

**Lưu ý:** Micro và STT/TTS hoạt động tốt nhất trên **Chrome/Edge**, trang **HTTPS** hoặc `localhost`.

## Luồng nghiệp vụ

1. AI avatar + TTS câu hỏi
2. Chờ trả lời → ghi âm → STT → xác nhận transcript
3. Chấm điểm + TTS nhận xét ngắn (1–3 câu)
4. Hết câu → báo cáo tổng hợp + TTS tổng kết
5. Xuất JSON / CSV / HTML

## API chính

- `POST /api/sessions` — tạo phiên
- `GET /api/sessions` — danh sách phiên cho dashboard
- `GET /api/statistics` — thống kê overview dashboard
- `GET /api/questions` — ngân hàng câu hỏi theo vị trí
- `GET /api/sessions/{id}/questions/{index}` — câu hỏi
- `POST /api/sessions/{id}/answers/evaluate` — lưu transcript + chấm điểm
- `POST /api/sessions/{id}/finalize` — báo cáo cuối
- `GET /api/sessions/{id}/export?format=json|csv|html` — xuất báo cáo

Database: `backend/interview.db`

## Ghi chú môi trường

Nếu chạy trong Codex sandbox có thể gặp lỗi `Access is denied` khi thực thi Python tùy ý do chính sách sandbox. Trên máy Windows của bạn, hãy chạy trực tiếp `start-backend.bat` hoặc lệnh backend trong terminal thường.

## Đăng nhập và phân quyền

- Hỗ trợ đăng ký / đăng nhập bằng email và mật khẩu.
- Tài khoản đầu tiên đăng ký sẽ tự động có quyền `admin`.
- Các tài khoản tiếp theo có quyền `user`.
- `user` chỉ xem được phiên phỏng vấn của mình.
- `admin` xem được thống kê toàn hệ thống và danh sách người dùng trong trang Account.

## Cấu hình đăng nhập Google

1. Tạo OAuth Client ID trong Google Cloud Console, loại Web application.
2. Thêm origin local: `http://localhost:5173` và `http://127.0.0.1:5173`.
3. Tạo file `backend/.env` từ `backend/.env.example` và điền `GOOGLE_CLIENT_ID`.
4. Tạo file `frontend/.env` từ `frontend/.env.example` và điền `VITE_GOOGLE_CLIENT_ID`.
5. Khởi động lại backend và frontend.

## Cấu hình Gemini AI

Backend vẫn chấm điểm bằng thuật toán rule-based để hệ thống chạy ổn định khi chưa có API key. Nếu cấu hình `GEMINI_API_KEY`, hệ thống sẽ gọi Gemini để viết nhận xét câu trả lời, tóm tắt nội dung và lời kết báo cáo tự nhiên hơn.

1. Tạo API key trong Google AI Studio.
2. Tạo hoặc cập nhật file `backend/.env`:

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash
GEMINI_TIMEOUT_SECONDS=12
```

3. Khởi động lại backend.
4. Kiểm tra `GET /api/health`; nếu cấu hình đúng, response có `"gemini_enabled": true`.
