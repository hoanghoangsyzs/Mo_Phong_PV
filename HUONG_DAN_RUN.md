# Hướng dẫn chạy dự án

Muốn đưa frontend/backend lên Internet và dùng MySQL, xem thêm [TRIEN_KHAI_DOMAIN.md](TRIEN_KHAI_DOMAIN.md).

Tài liệu này hướng dẫn chạy **Hệ thống mô phỏng phỏng vấn giọng nói** trên Windows.

## Yêu cầu

- Windows 10/11
- Python đã cài và có trong `PATH` (khuyến nghị Python 3.10 trở lên)
- Node.js và npm đã cài và có trong `PATH`
- Chrome hoặc Microsoft Edge nếu muốn dùng micro, nhận dạng giọng nói (STT) và đọc câu hỏi (TTS)

Kiểm tra Python và npm trong PowerShell hoặc Command Prompt:

```bat
python --version
npm --version
```

## Chuẩn bị lần đầu

Mở terminal tại thư mục dự án:

```bat
cd /d D:\HeThongMoPhongPV
```

Tạo môi trường Python và cài thư viện backend (chỉ cần làm lần đầu, hoặc khi `requirements.txt` thay đổi):

```bat
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
```

Frontend sẽ tự chạy `npm install` ở lần khởi động đầu nếu chưa có `frontend\node_modules`. Có thể cài trước bằng lệnh:

```bat
cd frontend
npm install
cd ..
```

## Khởi động nhanh

Trong File Explorer, mở thư mục `D:\HeThongMoPhongPV` rồi nhấp đúp:

```text
start-all.bat
```

Hai cửa sổ terminal sẽ mở: một cửa sổ chạy backend, cửa sổ còn lại chạy frontend. Hãy giữ cả hai cửa sổ mở trong khi sử dụng ứng dụng.

Mở ứng dụng tại:

- Frontend: http://localhost:5173
- Backend API: http://127.0.0.1:8000
- Tài liệu API FastAPI: http://127.0.0.1:8000/docs

Frontend gửi các yêu cầu `/api` đến backend qua proxy Vite.

## Khởi động riêng từng phần

Có thể nhấp đúp các file sau từ thư mục dự án:

- `start-backend.bat` — chạy API backend tại cổng `8000`
- `start-frontend.bat` — chạy giao diện frontend tại cổng `5173`

Nếu chạy từng phần, hãy bật backend trước rồi frontend. Giữ terminal của mỗi phần mở.

## Tắt ứng dụng

Trong từng cửa sổ terminal đang chạy, nhấn `Ctrl+C` rồi xác nhận nếu được hỏi. Khi chạy `start-all.bat`, hãy dừng cả hai cửa sổ.

## Cấu hình tùy chọn

### Đăng nhập Google

1. Sao chép `backend\.env.example` thành `backend\.env`, rồi điền `GOOGLE_CLIENT_ID`.
2. Sao chép `frontend\.env.example` thành `frontend\.env`, rồi điền `VITE_GOOGLE_CLIENT_ID`.
3. Trong cấu hình OAuth của Google, thêm các origin `http://localhost:5173` và `http://127.0.0.1:5173`.
4. Khởi động lại cả backend và frontend.

### Gemini AI

Không cần API key để chạy; ứng dụng vẫn chấm điểm bằng thuật toán có sẵn. Để bật phần nhận xét và tóm tắt bằng Gemini, tạo/cập nhật `backend\.env`:

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash
GEMINI_TIMEOUT_SECONDS=12
```

Khởi động lại backend. Có thể kiểm tra trạng thái tại `http://127.0.0.1:8000/api/health`.

## Dữ liệu

Backend lưu dữ liệu SQLite tại `backend\interview.db`. Hãy sao lưu file này nếu cần giữ dữ liệu khi di chuyển hoặc thay đổi dự án.

## Xử lý lỗi thường gặp

- **`start-backend.bat` báo không tìm thấy `backend\.venv`**: thực hiện các lệnh trong mục “Chuẩn bị lần đầu”.
- **`python` hoặc `npm` không được nhận diện**: cài Python/Node.js, bật tùy chọn thêm vào `PATH`, sau đó mở terminal mới.
- **Cổng 8000 hoặc 5173 đang được dùng**: đóng tiến trình/dự án khác đang dùng cổng đó rồi chạy lại.
- **Trang giao diện mở được nhưng API lỗi**: kiểm tra cửa sổ backend còn chạy không và thử truy cập `http://127.0.0.1:8000/api/health`.
- **Không dùng được micro/STT/TTS**: cấp quyền micro cho trình duyệt và dùng Chrome/Edge tại `localhost`. Có thể nhập câu trả lời bằng văn bản nếu micro không khả dụng.
- **Thay đổi file `.env` chưa có hiệu lực**: dừng và khởi động lại tiến trình liên quan.
