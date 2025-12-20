# Expense Tracker Frontend (Ví Vàng)

Đây là phần giao diện người dùng (Frontend) của ứng dụng quản lý chi tiêu cá nhân "Ví Vàng". Giao diện được xây dựng bằng HTML, CSS (Bootstrap 5) và JavaScript thuần, tương tác với Backend API để cung cấp một trải nghiệm quản lý tài chính trực quan và hiệu quả.

## 🚀 Công nghệ sử dụng

*   **Frontend:** HTML5, CSS3, JavaScript (ES6+)
*   **UI Framework:** Bootstrap 5
*   **Charting Library:** Chart.js
*   **Calendar Library:** FullCalendar
*   **Deployment:** Vercel.com

## ✨ Tính năng chính

*   **Xác thực người dùng:** Đăng ký, Đăng nhập, Quản lý hồ sơ.
*   **Dashboard Tổng quan:** Hiển thị số dư, dòng tiền, cơ cấu thu/chi bằng biểu đồ.
*   **Quản lý Giao dịch:** Thêm, sửa, xóa giao dịch; hỗ trợ lọc và tìm kiếm.
*   **Quản lý Danh mục & Tài khoản:** Giao diện trực quan để quản lý các danh mục chi tiêu/thu nhập và các ví/tài khoản.
*   **Quản lý Giao dịch Định kỳ:** Thiết lập và theo dõi các khoản thu/chi cố định.
*   **Kế hoạch Ngân sách:** Đặt và theo dõi ngân sách chi tiêu theo danh mục.
*   **Báo cáo Chi tiết:** Phân tích sâu dữ liệu theo khoảng thời gian tùy chỉnh.
*   **Theo dõi Đầu tư:** Quản lý danh mục đầu tư, cập nhật giá trị.
*   **Xuất dữ liệu:** Tải báo cáo giao dịch ra file Excel.
*   **Thanh công cụ chứng khoán:** Tích hợp widget TradingView để theo dõi thị trường.

## 🛠 Hướng dẫn Cài đặt và Chạy cục bộ (Local Development)

### Yêu cầu

*   Một trình duyệt web hiện đại (Chrome, Firefox...).
*   Backend API đang chạy (`expense-tracker-backend`).

### Các bước cài đặt

1.  **Clone repository:**
    ```bash
    git clone https://github.com/YourUsername/expense-tracker-frontend.git
    cd expense-tracker-frontend
    ```
    *(Thay `YourUsername` bằng username GitHub của bạn)*

2.  **Cấu hình API Backend URL:**
    *   Mở file `assets/js/api.js`.
    *   Cập nhật `baseURL` trỏ đến địa chỉ của Backend API.
        *   Nếu backend đang chạy trên máy cục bộ: `http://localhost:8000`
        *   Nếu backend đã deploy trên Render: `https://your-backend-url.onrender.com`
    ```javascript
    const API_CONFIG = {
        baseURL: 'http://localhost:8000', // <-- Cập nhật URL backend tại đây
        timeout: 20000,
    };
    ```

3.  **Chạy Frontend:**
    *   Sử dụng extension "Live Server" của VS Code: Mở file `login.html`, click chuột phải và chọn "Open with Live Server".
    *   Hoặc dùng Python HTTP Server:
        ```bash
        python -m http.server 8080
        ```
        Truy cập: `http://localhost:8080/login.html`

## 🔗 Liên kết Backend

*   **Backend Repository:** https://github.com/ChauGiaBao-23050010/expense-tracker-backend
*   **Deployed Backend:** https://expense-tracker-backend-k8er.onrender.com
