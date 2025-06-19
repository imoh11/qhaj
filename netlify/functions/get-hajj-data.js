// @ts-check
// هذا الكود مخصص لوظائف Netlify Serverless (Node.js)
// تأكد من أن 'node-fetch' مثبت في ملف package.json في جذر مشروعك
// (قم بتشغيل: npm install node-fetch && npm init -y إذا لم تكن قد فعلت ذلك)
const fetch = require('node-fetch');

// معلومات Airtable (يجب أن تُضبط كمتغيرات بيئة في إعدادات Netlify)
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// التحقق من أن المتغيرات الأساسية موجودة عند بدء تشغيل الدالة
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error("خطأ التكوين: AIRTABLE_API_KEY أو AIRTABLE_BASE_ID غير متاحين كمتغيرات بيئة.");
    // هذا الخطأ سيظهر في سجلات وظيفة Netlify إذا لم يتم تعيين المتغيرات
}

const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/`;

/**
 * دالة مساعدة لجلب جميع السجلات من جدول Airtable معين، مع معالجة pagination والفرز.
 * @param {string} tableName - اسم الجدول في Airtable (مثل "المكتب", "التجمعات").
 * @param {Array<Object>} [sortOptions=[]] - مصفوفة من كائنات الفرز، مثل: [{field: "اسم_العمود", direction: "asc"|"desc"}].
 * @returns {Promise<Array<Object>>} مصفوفة من كائنات الحقول (records.fields).
 */
async function fetchAllAirtableRecords(tableName, sortOptions = []) {
    let queryParams = [];

    // إضافة خيارات الفرز إلى queryParams
    sortOptions.forEach((sort, index) => {
        queryParams.push(`sort[${index}][field]=${encodeURIComponent(sort.field)}`);
        queryParams.push(`sort[${index}][direction]=${encodeURIComponent(sort.direction)}`);
    });

    const url = `${AIRTABLE_BASE_URL}${encodeURIComponent(tableName)}`;
    const headers = {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
    };

    let allRecords = [];
    let offset = null; // لمعالجة الصفحات (pagination) في Airtable API

    do {
        let paginatedUrl = url;
        let currentQueryParams = [...queryParams]; // ننسخ queryParams حتى لا نؤثر على التكرارات
        if (offset) {
            currentQueryParams.push(`offset=${offset}`);
        }

        if (currentQueryParams.length > 0) {
            paginatedUrl += `?${currentQueryParams.join('&')}`; // هنا يتم إضافة Query Params
        }
        
        try {
            const response = await fetch(paginatedUrl, { headers });
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`خطأ في Airtable API للجدول ${tableName}: الحالة ${response.status} - ${response.statusText}. الاستجابة: ${errorBody}`);
            }
            const data = await response.json();
            allRecords = allRecords.concat(data.records.map(record => record.fields)); // نأخذ فقط حقول السجل (fields)
            offset = data.offset; // إذا كان هناك المزيد من الصفحات، Airtable سيعيد 'offset'
        } catch (fetchError) {
            console.error(`خطأ أثناء جلب البيانات من جدول Airtable (${tableName}): ${fetchError.message}`);
            throw fetchError; // إعادة إلقاء الخطأ للتعامل معه في الدالة الرئيسية
        }
    } while (offset);

    return allRecords;
}

/**
 * الدالة الرئيسية لوظيفة Netlify بلا خادم.
 * تُنفذ عند تلقي طلب HTTP GET من الواجهة الأمامية.
 * @param {Object} event - كائن الحدث الذي يحتوي على معلومات طلب HTTP.
 * @param {Object} context - كائن السياق (لا يُستخدم كثيراً في هذا السيناريو البسيط).
 * @returns {Promise<Object>} كائن استجابة HTTP.
 */
exports.handler = async function(event, context) {
    // التأكد من أن الطلب هو GET (وظائف بلا خادم يمكنها دعم طرق HTTP مختلفة)
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // تحقق أساسي من متغيرات البيئة قبل محاولة الاتصال بـ Airtable
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
        console.error("متغيرات بيئة Airtable غير مهيأة بشكل صحيح.");
        return {
            statusCode: 500, // خطأ داخلي في الخادم
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "https://imoh11.github.io", // السماح لنطاق موقعك بالوصول
                "Access-Control-Allow-Methods": "GET, OPTIONS", // السماح بطلبات GET و OPTIONS (لـ preflight CORS)
                "Access-Control-Allow-Headers": "Content-Type" // السماح بنوع الرأس
            },
            body: JSON.stringify({ error: "Server configuration error: Airtable API credentials missing. Please set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in Netlify environment variables." })
        };
    }

    try {
        const finalCombinedData = {}; // هذا الكائن سيحتوي على جميع البيانات المدمجة للواجهة الأمامية

        // --- جلب البيانات الخام من Airtable لكل قسم (مع الفرز) ---
        // المكتب (لا يوجد فرز، كائن واحد)
        const rawOfficeRecords = await fetchAllAirtableRecords("المكتب"); // <<-- تأكد من اسم الجدول في Airtable

        // التجمعات (فرز تصاعدي حسب اسم التجمع)
        const rawGatheringsRecords = await fetchAllAirtableRecords("التجمعات", [{field: "اسم_التجمع", direction: "asc"}]); // <<-- تأكد من اسم الجدول في Airtable

        // المخيمات (فرز تصاعدي حسب اسم المخيم)
        const rawCampsRecords = await fetchAllAirtableRecords("المخيمات", [{field: "اسم_المخيم", direction: "asc"}]); // <<-- تأكد من اسم الجدول في Airtable

        // المشرفون (فرز تصاعدي حسب الباص والمشرف)
        const rawSupervisorsRecords = await fetchAllAirtableRecords("المشرفون", [{field: "الباص_والمشرف", direction: "asc"}]); // <<-- تأكد من اسم الجدول في Airtable

        // أوقات التحرك (فرز تصاعدي حسب التاريخ ثم الوقت)
        // ملاحظة: الفرز النصي (alphabetical) قد لا يكون دقيقاً 100% زمنياً إذا كانت التواريخ والأوقات غير منسقة.
        // يفضل استخدام حقول Airtable من نوع Date/Time للفرز الزمني الدقيق.
        const rawMovementTimesRecords = await fetchAllAirtableRecords("أوقات التحرك", [
            {field: "تاريخ_التحرك", direction: "asc"}, 
            {field: "وقت_التحرك", direction: "asc"}
        ]); // <<-- تأكد من اسم الجدول في Airtable

        // مسارات التنقل (فرز تصاعدي حسب من المكان إلى المكان)
        const rawMovementPathsRecords = await fetchAllAirtableRecords("مسارات التنقل", [
            {field: "من_المكان_مسار", direction: "asc"}, 
            {field: "إلى_المكان_مسار", direction: "asc"}
        ]); // <<-- تأكد من اسم الجدول في Airtable

        // الوجبات (فرز تصاعدي حسب اسم الوجبة)
        const rawMealsRecords = await fetchAllAirtableRecords("الوجبات", [{field: "اسم_الوجبة", direction: "asc"}]); // <<-- تأكد من اسم الجدول في Airtable


        // --- معالجة وتشكيل البيانات المجمعة ---

        // 1. معالجة بيانات المكتب (كائن واحد)
        if (rawOfficeRecords.length > 0) {
            const officeFields = rawOfficeRecords[0]; // نأخذ أول سجل (fields object)
            finalCombinedData.office = {
                "المدينة": officeFields["المدينة"] || null, // استخدم || null لمعالجة القيم الفارغة بشكل آمن
                "رابط_الموقع": officeFields["رابط_الموقع_مكتب"] || null, // تحويل الاسم: Airtable's رابط_الموقع_مكتب -> Frontend's رابط_الموقع
                "هاتف_المكتب": officeFields["هاتف_المكتب"] || null,
                "واتساب_المكتب": officeFields["واتساب_المكتب"] || null
            };
        } else {
            finalCombinedData.office = {}; // لضمان وجود المفتاح ككائن فارغ حتى لو كان الجدول فارغاً
        }

        // 2. معالجة وتشكيل بيانات الأقسام الأخرى (تتوقع مصفوفة من الكائنات)
        const sectionsConfig = {
            "gatherings": { 
                fieldMap: { // خريطة لتحويل أسماء حقول Airtable إلى المفاتيح المتوقعة في الواجهة الأمامية
                    "اسم_التجمع": "اسم_التجمع",
                    "رابط_الموقع_تجمع": "رابط_الموقع", // تحويل الاسم
                    "هاتف_التجمع": "هاتف_التجمع",
                    "واتساب_التجمع": "واتساب_التجمع"
                }
            },
            "camps": { 
                fieldMap: {
                    "اسم_المخيم": "اسم_المخيم",
                    "رابط_الموقع_مخيم": "رابط_الموقع", // تحويل الاسم
                    "هاتف_المخيم": "هاتف_المخيم",
                    "واتساب_المخيم": "واتساب_المخيم"
                }
            },
            "supervisors": { 
                fieldMap: {
                    "الباص_والمشرف": "الباص_والمشرف",
                    "هاتف_المشرف": "هاتف_المشرف",
                    "واتساب_المشرف": "واتساب_المشرف"
                }
            },
            "movementTimes": { 
                fieldMap: {
                    "من_المكان_تحرك": "من_المكان", // تحويل الاسم
                    "إلى_المكان_تحرك": "إلى_المكان", // تحويل الاسم
                    "تاريخ_التحرك": "تاريخ_التحرك",
                    "وقت_التحرك": "وقت_التحرك"
                }
            },
            "movementPaths": { 
                fieldMap: {
                    "من_المكان_مسار": "من_المكان", // تحويل الاسم
                    "إلى_المكان_مسار": "إلى_المكان", // تحويل الاسم
                    "طول_المسار": "طول_المسار",
                    "الوقت_المتوقع": "الوقت_المتوقع",
                    "نوع_المسار": "نوع_المسار",
                    "رابط_الخريطة": "رابط_الخريطة"
                }
            },
            "meals": { 
                fieldMap: {
                    "اسم_الوجبة": "اسم_الوجبة",
                    "وقت_الوجبة_كامل": "وقت_الوجبة_كامل"
                }
            }
        };

        // الربط بين البيانات الخام التي تم جلبها وقائمة الأقسام للمعالجة
        const rawDataMap = {
            "gatherings": rawGatheringsRecords,
            "camps": rawCampsRecords,
            "supervisors": rawSupervisorsRecords,
            "movementTimes": rawMovementTimesRecords,
            "movementPaths": rawMovementPathsRecords,
            "meals": rawMealsRecords
        };


        for (const sectionKey in sectionsConfig) {
            if (sectionsConfig.hasOwnProperty(sectionKey)) {
                const config = sectionsConfig[sectionKey];
                const recordsToProcess = rawDataMap[sectionKey]; // جلب السجلات الخام لهذا القسم

                const transformedRecords = recordsToProcess.map(record => {
                    const newRecord = {};
                    for (const airtableField in config.fieldMap) {
                        const frontendKey = config.fieldMap[airtableField];
                        // التحقق مما إذا كان الحقل موجودًا في سجل Airtable، وإلا تعيين null
                        newRecord[frontendKey] = record.hasOwnProperty(airtableField) ? record[airtableField] : null;
                    }
                    return newRecord;
                }).filter(record => {
                    // إزالة السجلات التي جميع قيمها فارغة أو null أو غير معرفة (لتنظيف البيانات)
                    return Object.values(record).some(val => val !== null && val !== '' && val !== undefined);
                });

                finalCombinedData[sectionKey] = transformedRecords;
            }
        }

        // --- إرجاع الاستجابة JSON الموحدة لموقعك ---
        return {
            statusCode: 200, // رمز حالة HTTP للنجاح
            headers: {
                "Content-Type": "application/json", // تحديد نوع المحتوى كـ JSON
                "Access-Control-Allow-Origin": "https://imoh11.github.io", // السماح لنطاق موقعك بالوصول (مهم جداً لـ CORS)
                "Access-Control-Allow-Methods": "GET, OPTIONS", // السماح بطلبات GET و OPTIONS (لـ preflight CORS)
                "Access-Control-Allow-Headers": "Content-Type" // السماح بنوع رأس المحتوى
            },
            body: JSON.stringify(finalCombinedData) // تحويل الكائن المجمع إلى JSON String
        };

    } catch (error) {
        console.error("خطأ كبير في وظيفة الخادم بلا خادم (الدالة الرئيسية):", error.message);
        return {
            statusCode: 500, // خطأ داخلي في الخادم
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "https://imoh11.github.io", 
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            body: JSON.stringify({ error: "فشل استرداد البيانات من Airtable. يرجى التحقق من سجلات الوظيفة.", details: error.message })
        };
    }
};
