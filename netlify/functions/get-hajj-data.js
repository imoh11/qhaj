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
 * دالة مساعدة لجلب جميع السجلات من جدول Airtable معين، مع معالجة pagination (النتائج المقسمة لصفحات).
 * @param {string} tableName - اسم الجدول في Airtable (مثل "المكتب", "التجمعات").
 * @returns {Promise<Array<Object>>} مصفوفة من كائنات الحقول (records.fields) لكل سجل.
 */
async function fetchAllAirtableRecords(tableName) {
    const url = `${AIRTABLE_BASE_URL}${encodeURIComponent(tableName)}`;
    const headers = {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
    };

    let allRecords = [];
    let offset = null; // لمعالجة pagination في Airtable API

    do {
        let paginatedUrl = url;
        if (offset) {
            paginatedUrl += `?offset=${offset}`;
        }
        
        try {
            const response = await fetch(paginatedUrl, { headers });
            if (!response.ok) {
                // إذا لم تكن الاستجابة 200 OK، ألقِ خطأ مع تفاصيل
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
 * @returns {Promise<Object>} كائن استجابة HTTP، يحتوي على بيانات JSON.
 */
exports.handler = async function(event, context) {
    // التأكد من أن الطلب هو GET (وظائف بلا خادم يمكنها دعم طرق HTTP مختلفة)
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // تحقق أساسي من متغيرات البيئة قبل محاولة الاتصال بـ Airtable
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
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

        // --- 1. جلب بيانات المكتب (يتوقع كائن واحد، عادة الصف الأول) ---
        const officeRecords = await fetchAllAirtableRecords("المكتب"); // <<-- تأكد من اسم الجدول في Airtable
        if (officeRecords.length > 0) {
            const officeFields = officeRecords[0]; // نأخذ أول سجل (fields object)
            finalCombinedData.office = {
                "المدينة": officeFields["المدينة"] || null, // استخدم || null لمعالجة القيم الفارغة بشكل آمن
                "رابط_الموقع": officeFields["رابط_الموقع_مكتب"] || null, // تحويل الاسم: Airtable's رابط_الموقع_مكتب -> Frontend's رابط_الموقع
                "هاتف_المكتب": officeFields["هاتف_المكتب"] || null,
                "واتساب_المكتب": officeFields["واتساب_المكتب"] || null
            };
        } else {
            finalCombinedData.office = {}; // لضمان وجود المفتاح ككائن فارغ حتى لو كان الجدول فارغاً
        }

        // --- 2. جلب باقي الأقسام (كل منها يتوقع مصفوفة من الكائنات) ---
        const sectionsConfig = {
            "gatherings": { 
                tableName: "التجمعات", // <<-- تأكد من اسم الجدول في Airtable
                fieldMap: { // خريطة لتحويل أسماء حقول Airtable إلى المفاتيح المتوقعة في الواجهة الأمامية
                    "اسم_التجمع": "اسم_التجمع",
                    "رابط_الموقع_تجمع": "رابط_الموقع", // تحويل الاسم
                    "هاتف_التجمع": "هاتف_التجمع",
                    "واتساب_التجمع": "واتساب_التجمع"
                }
            },
            "camps": { 
                tableName: "المخيمات", // <<-- تأكد من اسم الجدول في Airtable
                fieldMap: {
                    "اسم_المخيم": "اسم_المخيم",
                    "رابط_الموقع_مخيم": "رابط_الموقع", // تحويل الاسم
                    "هاتف_المخيم": "هاتف_المخيم",
                    "واتساب_المخيم": "واتساب_المخيم"
                }
            },
            "supervisors": { 
                tableName: "المشرفين", // <<-- تأكد من اسم الجدول في Airtable (المشرفين أو المشرفين)
                fieldMap: {
                    "الباص_والمشرف": "الباص_والمشرف",
                    "هاتف_المشرف": "هاتف_المشرف",
                    "واتساب_المشرف": "واتساب_المشرف"
                }
            },
            "movementTimes": { 
                tableName: "أوقات التحرك", // <<-- تأكد من اسم الجدول في Airtable
                fieldMap: {
                    "من_المكان_تحرك": "من_المكان", // تحويل الاسم
                    "إلى_المكان_تحرك": "إلى_المكان", // تحويل الاسم
                    "تاريخ_التحرك": "تاريخ_التحرك",
                    "وقت_التحرك": "وقت_التحرك"
                }
            },
            "movementPaths": { 
                tableName: "مسارات التنقل", // <<-- تأكد من اسم الجدول في Airtable
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
                tableName: "الوجبات", // <<-- تأكد من اسم الجدول في Airtable
                fieldMap: {
                    "اسم_الوجبة": "اسم_الوجبة",
                    "وقت_الوجبة_كامل": "وقت_الوجبة_كامل"
                }
            }
        };

        for (const sectionKey in sectionsConfig) {
            if (sectionsConfig.hasOwnProperty(sectionKey)) {
                const config = sectionsConfig[sectionKey];
                const records = await fetchAllAirtableRecords(config.tableName);
                
                const transformedRecords = records.map(record => {
                    const newRecord = {};
                    for (const airtableField in config.fieldMap) {
                        const frontendKey = config.fieldMap[airtableField];
                        // التحقق مما إذا كان الحقل موجودًا في سجل Airtable، وإلا تعيين null
                        newRecord[frontendKey] = record.hasOwnProperty(airtableField) ? record[airtableField] : null;
                    }
                    return newRecord;
                }).filter(record => {
                    // إزالة السجلات التي جميع قيمها فارغة أو null أو غير معرفة
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
                // هذا الرأس يحل مشكلة CORS. يجب أن يكون نطاق موقعك بالضبط.
                "Access-Control-Allow-Origin": "https://imoh11.github.io", 
                "Access-Control-Allow-Methods": "GET, OPTIONS", // السماح بطلبات GET و OPTIONS
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
