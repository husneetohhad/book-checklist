document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');

    // ฟังก์ชันสำหรับเปลี่ยนหน้า
    function navigateTo(page) {
        // จะเขียนโค้ดแสดงหน้าต่างๆ ที่นี่
        if (page === 'login') {
            app.innerHTML = `<h1>Login Page</h1>`;
        } else if (page === 'register') {
            app.innerHTML = `<h1>Register Page</h1>`;
        } else {
            app.innerHTML = `<h1>Welcome to Book Checklist</h1><button onclick="navigateTo('login')">Login</button> <button onclick="navigateTo('register')">Register</button>`;
        }
    }

    // เริ่มต้นที่หน้าแรก
    navigateTo('home');

    // ทำให้ฟังก์ชัน navigateTo ใช้ได้จาก HTML
    window.navigateTo = navigateTo;
});
