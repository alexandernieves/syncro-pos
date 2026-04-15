const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://pos:pos@pos.egjupeg.mongodb.net/?appName=pos";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test'); // mongoose default is test if not specified in connection string usually, but let's check. Actually NestJS might use "test" if no dbName specified. Wait, let's list databases and use the right one.
    
    // Quick way to figure out db:
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    let targetDbName = 'test'; // Mongoose default if not in URI
    
    // Find db that has products collection
    for(let dbInfo of dbs.databases) {
       const collections = await client.db(dbInfo.name).listCollections().toArray();
       if(collections.some(c => c.name === 'products')) {
           targetDbName = dbInfo.name;
           break;
       }
    }
    
    console.log("Using DB:", targetDbName);
    const dbToUse = client.db(targetDbName);
    
    const productsColl = dbToUse.collection('products');
    const suppliersColl = dbToUse.collection('suppliers');

    const suppliers = await suppliersColl.find({}).toArray();
    
    let updated = 0;
    
    const products = await productsColl.find({}).toArray();
    for (const p of products) {
      if (p.name.includes('iPhone') || p.name.includes('MacBook')) {
        const sup = suppliers.find(s => s.name === 'Apple Inc.');
        if (sup) { await productsColl.updateOne({_id: p._id}, {$set: {supplier: sup._id}}); updated++; }
      } else if (p.name.includes('Logitech')) {
        const sup = suppliers.find(s => s.name === 'Logitech S.A.');
        if (sup) { await productsColl.updateOne({_id: p._id}, {$set: {supplier: sup._id}}); updated++; }
      } else if (p.name.includes('Dell')) {
        const sup = suppliers.find(s => s.name === 'Dell Technologies');
        if (sup) { await productsColl.updateOne({_id: p._id}, {$set: {supplier: sup._id}}); updated++; }
      } else if (p.name.includes('Secretlab')) {
        const sup = suppliers.find(s => s.name === 'Secretlab SG');
        if (sup) { await productsColl.updateOne({_id: p._id}, {$set: {supplier: sup._id}}); updated++; }
      }
    }
    console.log(`Updated ${updated} products`);

  } finally {
    await client.close();
  }
}

run().catch(console.dir);
