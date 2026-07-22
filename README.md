# مساعد DXN الذكي - Telegram Bot

مساعد ذكي لخدمة عملاء DXN يعمل على حساب تيليجرام الشخصي باستخدام MTProto.

## المميزات

- 🤖 ردود ذكية باستخدام نماذج AI متعددة (Gemini, DeepSeek, OpenAI, Claude)
- 📚 قاعدة معرفة محلية (RAG) ل đọc ملفات PDF, Word, Excel
- 💾 ذاكرة المحادثة مع المستخدمين
- 🌐 لوحة تحكم للمراقبة
- 📱 يعمل على حساب تيليجرام الشخصي (MTProto)
- 🔄 ترحيب ذكي مع مراعاة الوقت

## المتطلبات

- Node.js 18+
- حساب MongoDB Atlas
- حساب Telegram (للحصول على API ID و Hash)

## التثبيت

```bash
# استنساخ المشروع
git clone https://github.com/yourusername/dxn-assistant.git
cd dxn-assistant

# تثبيت التبعيات
npm install

# نسخ ملف الإعدادات
cp .env.example .env
# عدّل ملف .env ببياناتك

# بناء قاعدة المعرفة
# ضع ملفات المعرفة في مجلد knowledge/

# تشغيل
npm start
```

## الإعدادات

### 1. Telegram API

1. قم بزيارة https://my.telegram.org
2. أنشئ تطبيق جديد
3. احصل على `API_ID` و `API_HASH`

### 2. MongoDB Atlas

1. أنشئ حساب على https://mongodb.com
2. أنشئ قاعدة بيانات
3. احصل على `MONGODB_URI`

### 3. ملف .env

```env
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE=+966XXXXXXXXX
MONGODB_URI=mongodb+srv://...
PORT=3004
```

## هيكل المشروع

```
dxn-assistant/
├── index.js           # نقطة البداية
├── config.js          # الإعدادات
├── database.js        # قاعدة البيانات
├── ai.js              # خدمة الذكاء الاصطناعي
├── rag.js             # قاعدة المعرفة
├── handlers.js        # معالجات الرسائل
├── utils.js           # الأدوات المساعدة
├── dashboard.js       # لوحة التحكم
├── package.json
├── .env.example
├── public/
│   └── index.html     # واجهة لوحة التحكم
├── knowledge/         # ملفات المعرفة
└── media/             # الوسائط المؤقتة
```

## الأوامر

- `/start` - بدء المحادثة
- `/help` - عرض المساعدة
- `/info` - معلومات عن DXN
- `/products` - المنتجات
- `/ask [سؤال]` - سؤال مباشر

## النشر على Render

1. ارفع المشروع على GitHub
2. أنشئ خدمة جديدة على Render
3. اربط المجلد
4. أضف متغيرات البيئة
5. سيتم النشر تلقائياً

## الترخيص

MIT License
