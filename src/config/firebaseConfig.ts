import admin from "firebase-admin";

const sercive_account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if(!admin.apps.length)
{
    admin.initializeApp({
        credential: admin.credential.cert(sercive_account)

    });
}

export default admin;