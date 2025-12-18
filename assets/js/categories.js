// Biến lưu danh sách để dùng khi edit
let currentCategoriesList = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    document.getElementById('categoryForm').addEventListener('submit', handleSaveCategory);
});

async function loadCategories() {
    try {
        const categories = await api.request('/categories/');
        currentCategoriesList = categories; // Lưu lại để dùng cho nút Sửa
        renderTable(categories);
    } catch (e) {
        console.error(e);
        alert("Lỗi tải danh mục");
    }
}

function renderTable(categories) {
    const tbody = document.getElementById('category-table-body');
    tbody.innerHTML = '';

    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Chưa có danh mục nào</td></tr>';
        return;
    }

    categories.forEach(c => {
        // Xử lý hiển thị loại đẹp mắt
        const typeBadge = c.type === 'INCOME' 
            ? '<span class="badge bg-success">Thu nhập</span>' 
            : '<span class="badge bg-danger">Chi tiêu</span>';

        const row = `
            <tr>
                <td class="text-center"><span class="fs-4">${c.icon || '📁'}</span></td>
                <td class="fw-bold">${c.name}</td>
                <td>${typeBadge}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-warning me-1" 
                        data-bs-toggle="modal" 
                        data-bs-target="#categoryModal" 
                        onclick="prepareEditMode(${c.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Chuẩn bị form để THÊM MỚI
window.prepareAddMode = function() {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = ''; 
    document.getElementById('catType').value = 'EXPENSE'; // Mặc định chi tiêu
    document.getElementById('modalTitle').textContent = "Thêm Danh Mục";
}

// Chuẩn bị form để SỬA
window.prepareEditMode = function(id) {
    const category = currentCategoriesList.find(c => c.id === id);
    if (!category) return;

    document.getElementById('categoryId').value = category.id;
    document.getElementById('name').value = category.name;
    document.getElementById('icon').value = category.icon;
    document.getElementById('catType').value = category.type || 'EXPENSE';
    
    document.getElementById('modalTitle').textContent = "Cập nhật Danh Mục";
}

async function handleSaveCategory(e) {
    e.preventDefault();
    
    const id = document.getElementById('categoryId').value;
    const data = {
        name: document.getElementById('name').value,
        icon: document.getElementById('icon').value,
        type: document.getElementById('catType').value
    };

    try {
        if (id) {
            // Sửa
            await api.request(`/categories/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            alert('Cập nhật thành công!');
        } else {
            // Thêm mới
            await api.request('/categories/', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            alert('Thêm thành công!');
        }
        
        // Đóng modal và tải lại bảng
        const modal = bootstrap.Modal.getInstance(document.getElementById('categoryModal'));
        modal.hide();
        loadCategories();
        
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

window.deleteCategory = async (id) => {
    if(!confirm("Bạn có chắc muốn xóa danh mục này?")) return;
    try {
        await api.request(`/categories/${id}`, { method: 'DELETE' });
        loadCategories();
        alert("Đã xóa thành công!");
    } catch (e) {
        alert("Lỗi khi xóa: " + e.message);
    }
};