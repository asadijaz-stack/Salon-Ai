const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkBusinesses() {
  const snapshot = await db.collection('businesses').get();
  console.log(`Found ${snapshot.size} businesses.`);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`- Business: ${data.name} | ownerEmail: ${data.ownerEmail} | ownerUid: ${data.ownerUid} | Status: ${data.subscriptionStatus}`);
    
    // check if user exists in auth
    try {
      const user = await getAuth().getUserByEmail(data.ownerEmail);
      console.log(`  -> Auth user found! uid: ${user.uid} (Matches ownerUid? ${user.uid === data.ownerUid})`);
    } catch (e) {
      console.log(`  -> Auth user NOT found for email ${data.ownerEmail}: ${e.code}`);
    }
  }
}

checkBusinesses().catch(console.error);
