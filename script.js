const COMPLAINTS_WEBHOOK_URL = 'https://hook.us2.make.com/4ij8kumta41ozellaauixdc25zm7i27k';

document.addEventListener('DOMContentLoaded', function() {
    const fixedNavBarHeight = document.querySelector('.fixed-nav-bar').offsetHeight; // نحصل على ارتفاع الشريط الثابت ديناميكيًا
    const scrollOffset = fixedNavBarHeight + 20; // إضافة 20 بكسل إضافية كهامش علوي بعد الشريط

    // Smooth scrolling for navigation links
    document.querySelectorAll('.nav-link').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
                const offsetPosition = elementPosition - scrollOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Function to update active link on scroll
    const sections = document.querySelectorAll('.info-card');
    const navLinks = document.querySelectorAll('.nav-list .nav-link');
    // استخدم نفس scrollOffset لتحديد القسم النشط بشكل صحيح
    // const offset = 120; // لم نعد بحاجة لهذا المتغير بشكل مباشر هنا

    function updateActiveLink() {
        let currentActive = null;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;

            // Check if the section is within the viewport, considering the scrollOffset
            if (pageYOffset >= sectionTop - scrollOffset && pageYOffset < sectionTop + sectionHeight - scrollOffset) {
                currentActive = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active-section');
            if (link.getAttribute('href').includes(currentActive)) {
                link.classList.add('active-section');
            }
        });
    }

    // Initial call to set active link on page load
    updateActiveLink();

    // Add scroll event listener
    window.addEventListener('scroll', updateActiveLink);


    // Complaint Form Submission
    const complaintForm = document.getElementById('complaintForm');
    const complaintMessageBox = document.getElementById('complaintMessageBox');
    if (complaintForm) {
        complaintForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const now = new Date();
            const optionsDate = { year: 'numeric', month: '2-digit', day: '2-digit' };
            const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

            const formData = new FormData(this);
            const data = {
                "عنوان_النموذج": "الشكاوى والملاحظات",
                "التاريخ": now.toLocaleDateString('en-CA', optionsDate),
                "الوقت": now.toLocaleTimeString('en-GB', optionsTime),
                "الاسم": formData.get('الاسم'),
                "رقم_التواصل": formData.get('رقم_التواصل'),
                "الملاحظة": formData.get('الملاحظة')
            };

            try {
                const response = await fetch(COMPLAINTS_WEBHOOK_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    complaintMessageBox.textContent = 'صوتك وصل ونحن في خدمتك';
                    complaintMessageBox.className = 'response-message success';
                    this.reset();
                } else {
                    complaintMessageBox.textContent = 'حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.';
                    complaintMessageBox.className = 'response-message error';
                    console.error('Error sending complaint:', await response.text());
                }
            } catch (error) {
                complaintMessageBox.textContent = 'مشكلة في الاتصال. يرجى التحقق من اتصالك بالإنترنت والمحاولة لاحقًا.';
                complaintMessageBox.className = 'response-message error';
                console.error('Network error:', error);
            } finally {
                complaintMessageBox.style.display = 'block';
                setTimeout(() => { complaintMessageBox.style.display = 'none'; }, 5000);
            }
        });
    }
});