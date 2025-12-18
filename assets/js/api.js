// Cấu hình địa chỉ của Backend API
const API_CONFIG = {
    // Nếu đang chạy trên localhost, ưu tiên dùng backend local. Ngược lại dùng bản deploy trên Render.
    baseURL: (location.hostname === 'localhost' || location.hostname === '127.0.0.1') 
        ? 'http://localhost:8000' // <--- Dùng cái này khi bạn chạy trên máy
        : 'https://expense-tracker-backend-k8er.onrender.com', // <--- Dùng cái này khi đã deploy lên Vercel
    timeout: 20000,
};

class APIClient {
    constructor() {
        this.baseURL = API_CONFIG.baseURL;
    }

    /**
     * Hàm lấy token từ localStorage
     */
    getToken() {
    return localStorage.getItem('access_token') || localStorage.getItem('accessToken');
    }

    /**
     * Hàm fetch chung, tự động thêm header Authorization
     * @param {string} endpoint - Điểm cuối API
     * @param {object} options - Các tùy chọn cho fetch
     * @returns {Promise<any>} - Dữ liệu JSON từ response
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;

        // Mặc định headers
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        // --- TỰ ĐỘNG THÊM TOKEN ---
        // Nếu không phải là request login/register thì thêm token vào
        if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const config = {
            ...options,
            headers: headers,
        };

        // Sử dụng AbortController để quản lý timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
        config.signal = controller.signal;


        try {
            const response = await fetch(url, config);
            
            // Xóa timeout
            clearTimeout(timeoutId);

            // Kiểm tra Content-Type trước khi parse JSON (tránh lỗi khi response rỗng)
            const contentType = response.headers.get('content-type');
            let data = null;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else if (response.status !== 204) { // 204 No Content thường không có body
                // Nếu không phải JSON và không phải 204, thử đọc text (để debug hoặc xử lý lỗi)
                data = await response.text(); 
            }

            if (!response.ok) {
                // Nếu lỗi 401 (Unauthorized), có thể token hết hạn -> Logout
                if (response.status === 401) {
                    console.warn("Token hết hạn hoặc không hợp lệ. Đang đăng xuất...");
                    localStorage.removeItem('accessToken');
                    // Chỉ chuyển hướng nếu không đang ở trang login
                    if (!window.location.pathname.includes('login.html')) {
                        window.location.href = './login.html';
                    }
                }
                // Dùng data.detail (FastAPI standard) hoặc thông báo chung
                const errorMessage = data && data.detail ? data.detail : (typeof data === 'string' ? data : 'Có lỗi xảy ra');
                throw new Error(errorMessage);
            }
            
            return data;
        } catch (error) {
            // Xử lý lỗi timeout
            if (error.name === 'AbortError') {
                 console.error('Lỗi khi gọi API: Request timeout.');
                 throw new Error("Yêu cầu API đã hết thời gian (timeout). Vui lòng thử lại.");
            }
            console.error('Lỗi khi gọi API:', error);
            throw error;
        }
    }

    // --- PHƯƠNG THỨC DOWNLOAD MỚI ---
    /**
     * Hàm chuyên dụng để tải file (Blob)
     */
    async download(endpoint) {
        const url = `${this.baseURL}${endpoint}`;
        const token = this.getToken();
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    // Chỉ cần Authorization, không cần Content-Type: application/json
                    'Authorization': `Bearer ${token}`
                },
                 signal: new AbortController().signal // Có thể thêm logic timeout ở đây nếu cần
            });

            // Xử lý lỗi: nếu response không OK, có thể là lỗi 401/500/etc.
            if (!response.ok) {
                 if (response.status === 401) {
                    console.warn("Token hết hạn hoặc không hợp lệ. Đang đăng xuất...");
                    localStorage.removeItem('accessToken');
                    window.location.href = './login.html';
                    return;
                }
                throw new Error("Lỗi khi tải file. Mã lỗi: " + response.status);
            }

            // 1. Chuyển response thành Blob (Binary Large Object)
            const blob = await response.blob();

            // 2. Tạo một link ảo để trình duyệt tự click tải về
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            
            // Lấy tên file từ header Content-Disposition (nếu backend gửi):
            let filename = `bao_cao_${new Date().toISOString().slice(0,10)}.xlsx`;
            const contentDisposition = response.headers.get('Content-Disposition');
            if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
                if (filenameMatch && filenameMatch.length > 1) {
                    filename = filenameMatch[1].replace(/["']/g, ''); // Loại bỏ dấu nháy kép/đơn
                }
            }
            a.download = filename;
            
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

        } catch (error) {
            console.error("Download error:", error);
            alert("Không thể tải báo cáo. Vui lòng thử lại.");
        }
    }
    // --- KẾT THÚC PHƯƠNG THỨC DOWNLOAD MỚI ---

    // --- THÊM CÁC HÀM TIỆN ÍCH MỚI ---
    /**
     * Lấy danh sách Categories.
     */
    async getCategories() {
        return this.request('/categories/');
    }

    /**
     * Lấy danh sách Accounts.
     */
    async getAccounts() {
        return this.request('/accounts/');
    }

    /**
     * Lấy danh sách Giao dịch định kỳ với các tham số lọc.
     * @param {object} params - Các tham số truy vấn (search, type, frequency, is_active).
     */
    async getRecurringTransactions(params = {}) {
        const urlParams = new URLSearchParams(params);
        return this.request(`/recurring/?${urlParams.toString()}`);
    }
    // --- KẾT THÚC CÁC HÀM TIỆN ÍCH MỚI ---

    /**
     * Gọi API đăng nhập (Không dùng hàm request chung)
     */
    async login(username, password) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const url = `${this.baseURL}/auth/login`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Đăng nhập thất bại');
        }
        return data;
    }

    /**
     * Gọi API đăng ký (Không dùng hàm request chung)
     */
    async register(userData) {
        
        const url = `${this.baseURL}/auth/register`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Đăng ký thất bại');
        }
        return data;
    }
}

// Tạo một instance (thực thể) duy nhất của APIClient để dùng chung cho toàn bộ app
const api = new APIClient();
