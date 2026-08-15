const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixBusinesses() {
  const snapshot = await db.collection('businesses').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    try {
      const user = await getAuth().getUserByEmail(data.ownerEmail);
      if (user.uid !== data.ownerUid) {
        console.log(`Fixing business ${data.name}... setting ownerUid to ${user.uid}`);
        await doc.ref.update({ ownerUid: user.uid });
      }
    } catch (e) {
      console.log(`Could not find auth user for ${data.ownerEmail}.`);
    }
  }
  console.log('Done fixing DB!');
}

fixBusinesses().catch(console.error);
