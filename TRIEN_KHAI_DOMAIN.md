# Triển khai ứng dụng lên Internet

## Mô hình triển khai

GitHub Pages chỉ lưu và phát hành **frontend React/Vite**. Backend FastAPI phải chạy trên một dịch vụ hosting riêng; MySQL cũng là một dịch vụ cơ sở dữ liệu riêng. Người dùng chỉ cần mở trang web bằng trình duyệt, còn frontend gọi backend qua HTTPS.

```text
Trình duyệt
  └─ GitHub Pages (frontend, địa chỉ https://<tài-khoản>.github.io/<repo>/)
       └─ HTTPS API → Backend FastAPI (dịch vụ hosting)
                          └─ MySQL (dịch vụ cơ sở dữ liệu)
```

Bạn **không tải một file MySQL lên GitHub Pages**. MySQL là máy chủ/dịch vụ giữ dữ liệu; backend kết nối tới nó bằng `DATABASE_URL`. Hosting backend cần cho phép kết nối ra máy chủ MySQL. Nếu chưa có dữ liệu cần giữ, schema bảng được tạo tự động khi backend khởi động.

## Kiểm tra Aiven từ máy tính này

Trong Aiven, dùng phần **Service URI** ở tab **MySQL**. URI trong ảnh có dạng `mysql://USER:PASSWORD@HOST:PORT/defaultdb?ssl-mode=REQUIRED`; dùng đúng hostname và port Aiven cấp (port có thể khác `3306`). Backend đã chuyển `ssl-mode=REQUIRED` sang tùy chọn kết nối PyMySQL.

Để thử trước khi deploy, tạo file `backend/.env` (file này đã được `.gitignore` loại khỏi Git) và thêm:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/defaultdb?ssl-mode=REQUIRED
```

Thay các giá trị bằng URI trong Aiven; không đăng URI/password lên GitHub hoặc gửi qua chat. Sau đó chạy `start-backend.bat`. Nếu backend chạy, mở `http://127.0.0.1:8000/api/health`. Khi deploy, đặt chính URI này vào biến môi trường `DATABASE_URL` trên hosting backend thay vì đưa mật khẩu vào frontend.

## 1. Tạo MySQL

Tạo một database và user trên nhà cung cấp MySQL. Lấy thông tin kết nối gồm hostname, cổng, tên database, username, password và yêu cầu SSL (nếu nhà cung cấp yêu cầu). Không đưa password lên GitHub hoặc vào frontend.

Định dạng thường gặp:

```text
mysql+pymysql://USER:PASSWORD@HOST:3306/DATABASE?charset=utf8mb4
```

Backend cũng tự đổi URL dạng `mysql://...` sang driver PyMySQL. Nếu password có ký tự đặc biệt như `@`, `:`, `/`, cần URL-encode password theo hướng dẫn nhà cung cấp.

## 2. Đưa mã nguồn lên GitHub

Tạo một repository và đẩy toàn bộ thư mục dự án lên đó. Đảm bảo các file `.env`, `backend/.venv`, `frontend/node_modules`, `backend/interview.db` và thông tin bí mật không được commit. Không commit các file môi trường thật; chỉ commit các file `.env.*.example`.

## 3. Deploy backend

Tạo Python Web Service từ repository, đặt thư mục gốc dịch vụ là `backend` nếu nền tảng hỗ trợ root directory. Cấu hình:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check (nếu có): `/api/health`

Thiết lập các biến môi trường trong dashboard của dịch vụ backend:

- `APP_ENV=production`
- `APP_SECRET_KEY` — chuỗi ngẫu nhiên bí mật dài ít nhất 32 ký tự
- `DATABASE_URL` — URL MySQL từ bước 1
- `CORS_ORIGINS=https://<tài-khoản>.github.io` — origin trang Pages, không thêm đường dẫn repository và không có dấu `/` cuối
- `GOOGLE_CLIENT_ID` — chỉ khi bật đăng nhập Google
- `GEMINI_API_KEY` — tùy chọn

Lưu URL backend công khai, ví dụ `https://ten-backend.example`. Kiểm tra `https://ten-backend.example/api/health` trả về JSON có `"status":"ok"`.

## 4. Deploy frontend bằng GitHub Pages

Workflow tại `.github/workflows/deploy-pages.yml` tự build và deploy frontend mỗi khi có thay đổi ở `frontend/` trên nhánh `main`.

Trong GitHub repository:

1. Mở **Settings → Pages**, chọn **GitHub Actions** làm nguồn deploy.
2. Mở **Settings → Secrets and variables → Actions → Variables** và thêm:
   - `VITE_API_BASE_URL` = URL backend đầy đủ, kết thúc bằng `/api` (ví dụ `https://ten-backend.example/api`)
   - `VITE_GOOGLE_CLIENT_ID` = OAuth client ID, nếu dùng Google login
   - `VITE_BASE_PATH` = chỉ cần đặt `/` nếu gắn domain riêng vào Pages; để trống khi dùng URL mặc định `github.io/<repo>/`
3. Push code lên nhánh `main`, theo dõi **Actions**, rồi mở URL Pages được GitHub hiển thị.

Nếu GitHub repository dùng nhánh mặc định khác `main`, cập nhật `branches` trong workflow cho khớp.

## 5. Cấu hình domain và Google OAuth

GitHub Pages có thể dùng địa chỉ miễn phí `https://<tài-khoản>.github.io/<repo>/`. Nếu dùng domain tùy chỉnh, cấu hình domain trong **Settings → Pages** và DNS theo hướng dẫn GitHub. Cập nhật đồng bộ:

- Backend `CORS_ORIGINS` thành origin của domain frontend, ví dụ `https://phongvan.example`.
- GitHub variable `VITE_BASE_PATH=/` khi domain trỏ thẳng tới Pages.
- Google OAuth Authorized JavaScript origins thêm domain frontend HTTPS. Với URL mặc định, origin là `https://<tài-khoản>.github.io` (không thêm `/repo/`).
- Nếu build frontend với OAuth client ID, đặt `VITE_GOOGLE_CLIENT_ID` trong GitHub Actions Variables.

## 6. Kiểm tra sau deploy

1. Mở URL frontend và đăng ký/đăng nhập.
2. Kiểm tra DevTools → Network để chắc chắn request `/api/...` được gửi đến URL backend, không phải `127.0.0.1`.
3. Mở một phiên phỏng vấn, lưu câu trả lời, tải báo cáo, rồi khởi động lại backend và kiểm tra dữ liệu còn nguyên trong MySQL.
4. Thử microphone trên Chrome/Edge; quyền camera/micro hoạt động trên HTTPS.

**Phân quyền:** hiện tại tài khoản đăng ký đầu tiên có vai trò `admin`. Hãy tự đăng ký tài khoản đầu tiên ngay sau khi mở backend công khai; các tài khoản tiếp theo là `user`.

## Chạy local vẫn giữ nguyên

Không đặt `DATABASE_URL` thì backend vẫn dùng SQLite local như trước. File `backend/.env.production.example` và `frontend/.env.production.example` chỉ là mẫu tham khảo; các giá trị production cần khai báo trong dashboard hosting/GitHub, không đổi tên thành `.env` rồi commit.
