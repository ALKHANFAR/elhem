const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
require('dotenv').config();

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'elhemDB';

async function migrateData() {
  let client;

  try {
    console.log('🚀 بدء عملية نقل البيانات...');

    // الاتصال بقاعدة البيانات
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('✅ تم الاتصال بقاعدة البيانات');

    // قراءة ملفات JSON
    console.log('📂 قراءة ملفات البيانات...');

    const tasksData = JSON.parse(await fs.readFile('tasks.json', 'utf8'));
    const teamData = JSON.parse(await fs.readFile('team.json', 'utf8'));
    const performanceData = JSON.parse(await fs.readFile('performance.json', 'utf8'));
    const configData = JSON.parse(await fs.readFile('config.json', 'utf8'));

    console.log(`📊 تم قراءة ${tasksData.length} مهمة، ${teamData.length} موظف، ${performanceData.length} تقرير أداء`);

    // مسح البيانات الموجودة (اختياري)
    await db.collection('tasks').deleteMany({});
    await db.collection('team').deleteMany({});
    await db.collection('performance').deleteMany({});
    await db.collection('config').deleteMany({});

    console.log('🧹 تم مسح البيانات القديمة');

    // إدراج البيانات الجديدة
    if (tasksData.length > 0) {
      await db.collection('tasks').insertMany(tasksData);
      console.log(`✅ تم إدراج ${tasksData.length} مهمة`);
    }

    if (teamData.length > 0) {
      await db.collection('team').insertMany(teamData);
      console.log(`✅ تم إدراج ${teamData.length} موظف`);
    }

    if (performanceData.length > 0) {
      await db.collection('performance').insertMany(performanceData);
      console.log(`✅ تم إدراج ${performanceData.length} تقرير أداء`);
    }

    await db.collection('config').insertOne(configData);
    console.log('✅ تم إدراج إعدادات النظام');

    console.log('🎉 تمت عملية النقل بنجاح!');

  } catch (error) {
    console.error('❌ خطأ في عملية النقل:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
  }
}

// تشغيل عملية النقل
migrateData();