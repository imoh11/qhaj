const COMPLAINTS_WEBHOOK_URL = 'https://hook.us2.make.com/4ij8kumta41ozellaauixdc25zm7i27k';
const GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzVtFf37mS0UOKELQpsF_YOsMgs1yTwaGXvnqakhYFpDEcCGf2Nenzk_fbPXU3Xus5xvw/exec'; // استبدل هذا بالرابط الخاص بك!

document.addEventListener('DOMContentLoaded', function() {
    const fixedNavBar = document.querySelector('.fixed-nav-bar');
    let fixedNavBarHeight = 0;
    if (fixedNavBar) {
        fixedNavBarHeight = fixedNavBar.offsetHeight;
    }
    const scrollOffset = fixedNavBarHeight + 20;

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

    const sections = document.querySelectorAll('.info-card');
    const navLinks = document.querySelectorAll('.nav-list .nav-link');

    function updateActiveLink() {
        let currentActive = null;
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
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

    updateActiveLink();
    window.addEventListener('scroll', updateActiveLink);

    // --- وظيفة جلب البيانات وتحديث الواجهة ---
    async function fetchAndRenderHajjData() {
        try {
            const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL);
            const data = await response.json();
            console.log("البيانات المستلمة من الشيت:", data); // للتأكد من استلام البيانات

            // 1. تحديث قسم المكتب الرئيسي
            if (data.office) {
                const officeCard = document.querySelector('#main-office .contact-list-item');
                if (officeCard) {
                    officeCard.querySelector('.name-label').innerHTML = `<i class="fas fa-city"></i> ${data.office.المدينة}`;
                    officeCard.querySelector('.contact-action-btn.call').href = `tel:${data.office.هاتف_المكتب}`;
                    officeCard.querySelector('.contact-action-btn.whatsapp').href = data.office.واتساب_المكتب;
                    officeCard.querySelector('.contact-action-btn.location').href = data.office.رابط_الموقع;
                }
            }

            // 2. تحديث قسم نقاط التجمع والانطلاق
            if (data.gatherings && data.gatherings.length > 0) {
                const gatheringsList = document.querySelector('#gathering-points .contact-list');
                gatheringsList.innerHTML = ''; // تفريغ القائمة الحالية
                data.gatherings.forEach(item => {
                    const listItem = `
                        <li class="contact-list-item">
                            <span class="name-label"><i class="fas fa-bus-alt"></i> ${item.اسم_التجمع}</span>
                            <div class="contact-actions">
                                <a class="contact-action-btn call" href="tel:${item.هاتف_التجمع}"><i class="fas fa-phone"></i></a>
                                <a class="contact-action-btn whatsapp" href="${item.واتساب_التجمع}" target="_blank"><i class="fab fa-whatsapp"></i></a>
                                <a class="contact-action-btn location" href="${item.رابط_الموقع}" target="_blank"><i class="fas fa-map-marker-alt"></i></a>
                            </div>
                        </li>
                    `;
                    gatheringsList.insertAdjacentHTML('beforeend', listItem);
                });
            }

            // 3. تحديث قسم المخيمات
            if (data.camps && data.camps.length > 0) {
                const campsList = document.querySelector('#camps .contact-list');
                campsList.innerHTML = '';
                data.camps.forEach(item => {
                    const listItem = `
                        <li class="contact-list-item">
                            <span class="name-label"><i class="fas fa-bed"></i> ${item.اسم_المخيم}</span>
                            <div class="contact-actions">
                                <a class="contact-action-btn call" href="tel:${item.هاتف_المخيم}"><i class="fas fa-phone"></i></a>
                                <a class="contact-action-btn whatsapp" href="${item.واتساب_المخيم}" target="_blank"><i class="fab fa-whatsapp"></i></a>
                                <a class="contact-action-btn location" href="${item.رابط_الموقع}" target="_blank"><i class="fas fa-map-marker-alt"></i></a>
                            </div>
                        </li>
                    `;
                    campsList.insertAdjacentHTML('beforeend', listItem);
                });
            }

            // 4. تحديث قسم المشرفين
            if (data.supervisors && data.supervisors.length > 0) {
                const supervisorsList = document.querySelector('#supervisors .contact-list');
                supervisorsList.innerHTML = '';
                data.supervisors.forEach(item => {
                    const listItem = `
                        <li class="contact-list-item">
                            <span class="name-label"><i class="fas fa-bus"></i> ${item.الباص_والمشرف}</span>
                            <div class="contact-actions">
                                <a class="contact-action-btn call" href="tel:${item.هاتف_المشرف}"><i class="fas fa-phone"></i></a>
                                <a class="contact-action-btn whatsapp" href="${item.واتساب_المشرف}" target="_blank"><i class="fab fa-whatsapp"></i></a>
                            </div>
                        </li>
                    `;
                    supervisorsList.insertAdjacentHTML('beforeend', listItem);
                });
            }

            // 5. تحديث قسم أوقات التحرك والتفويج
            if (data.movementTimes && data.movementTimes.length > 0) {
                const movementTimesCard = document.querySelector('#movement-times');
                const movementTimesContainer = movementTimesCard.querySelector('.info-card-title').nextElementSibling; // الحاوية بعد العنوان
                movementTimesContainer.innerHTML = ''; // تفريغ المحتوى القديم
                data.movementTimes.forEach(item => {
                    const pathItem = `
                        <div class="path-item">
                            <div class="path-route">
                                <i class="fas fa-bus place-icon"></i> <span>${item.من_المكان}</span>
                                <i class="fas fa-arrow-left arrow-icon arrow-green"></i>
                                <span>${item.إلى_المكان}</span> <i class="fas fa-mosque place-icon"></i>
                            </div>
                            <div class="path-details">
                                <span class="path-detail-item-info date-info">
                                    <i class="fas fa-calendar-alt"></i> <span>التاريخ:</span> ${item.تاريخ_التحرك}
                                </span>
                                <span class="path-detail-item-info time-info">
                                    <i class="fas fa-clock"></i> <span>الوقت:</span> ${item.وقت_التحرك}
                                </span>
                            </div>
                        </div>
                    `;
                    movementTimesContainer.insertAdjacentHTML('beforeend', pathItem);
                });
            }


            // 6. تحديث قسم مسارات التنقل بين المشاعر
            if (data.movementPaths && data.movementPaths.length > 0) {
                const movementPathsCard = document.querySelector('#movement-paths');
                const movementPathsContainer = movementPathsCard.querySelector('.info-card-title').nextElementSibling; // الحاوية بعد العنوان
                movementPathsContainer.innerHTML = ''; // تفريغ المحتوى القديم
                data.movementPaths.forEach(item => {
                    const pathItem = `
                        <div class="path-item">
                            <div class="path-route">
                                <i class="fas fa-campground place-icon"></i> <span>${item.من_المكان}</span>
                                <i class="fas fa-arrow-left arrow-icon arrow-${item.نوع_المسار === 'أحمر' ? 'red' : 'green'}"></i>
                                <span>${item.إلى_المكان}</span> <i class="fas fa-train place-icon"></i>
                            </div>
                            <div class="path-details">
                                <span class="path-detail-item-info location-link">
                                    <a href="${item.رابط_الخريطة}" target="_blank"><i class="fas fa-map-marker-alt"></i> <span>طول المسار:</span> ${item.طول_المسار}</a>
                                </span>
                                <span class="path-detail-item-info time-info">
                                    <a href="${item.رابط_الخريطة}" target="_blank"><i class="fas fa-clock"></i> <span>الوقت المتوقع:</span> ${item.الوقت_المتوقع}</a>
                                </span>
                            </div>
                            <a class="path-status-badge ${item.نوع_المسار === 'أحمر' ? 'red-status' : 'green-status'}" href="${item.رابط_الخريطة}" target="_blank" style="text-decoration: none;">المسار ${item.نوع_المسار}: الذهاب ل${item.إلى_المكان}</a>
                        </div>
                    `;
                    movementPathsContainer.insertAdjacentHTML('beforeend', pathItem);
                });
            }

            // 7. تحديث قسم الوجبات
            if (data.meals && data.meals.length > 0) {
                const mealsTableBody = document.querySelector('#meals .meals-table tbody');
                if (mealsTableBody) {
                    mealsTableBody.innerHTML = ''; // تفريغ المحتوى القديم

                    data.meals.forEach(item => {
                        const row = `
                            <tr>
                                <td><i class="fas fa-utensils"></i> ${item.اسم_الوجبة}</td>
                                <td><i class="fas fa-clock"></i> ${item.وقت_الوجبة_كامل}</td>
                            </tr>
                        `;
                        mealsTableBody.insertAdjacentHTML('beforeend', row);
                    });
                }
            }


        } catch (error) {
            console.error('حدث خطأ أثناء جلب أو عرض البيانات:', error);
        }
    }

    // استدعاء الدالة لجلب البيانات وتحديث الواجهة عند تحميل الصفحة
    fetchAndRenderHajjData();

    // Complaint Form Submission (لم يتغير)
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
