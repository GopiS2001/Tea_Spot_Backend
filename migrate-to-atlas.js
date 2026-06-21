const { MongoClient } = require('mongoose').mongo;

const SOURCE_URI = 'mongodb://localhost:27017/gopi1_db';
const DEST_URI =
  'mongodb+srv://mightymedic98_db_user:n0nB0HP5nJWWTaW8@cluster0.inzjwm8.mongodb.net/teaspot?retryWrites=true&w=majority&appName=Cluster0';

async function main() {
  const src = new MongoClient(SOURCE_URI);
  const dest = new MongoClient(DEST_URI);
  await src.connect();
  await dest.connect();

  const srcDb = src.db();
  const destDb = dest.db();

  const collections = await srcDb.listCollections().toArray();

  for (const { name } of collections) {
    const docs = await srcDb.collection(name).find({}).toArray();
    if (docs.length === 0) {
      console.log(`${name}: 0 docs, skipping`);
      continue;
    }
    await destDb.collection(name).deleteMany({});
    await destDb.collection(name).insertMany(docs);
    console.log(`${name}: migrated ${docs.length} docs`);
  }

  await src.close();
  await dest.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
