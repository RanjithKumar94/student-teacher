import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 1. Go to https://console.firebase.google.com, create a project (free).
// 2. In the project, click the </> (web app) icon to register a web app.
// 3. Copy the firebaseConfig object it gives you and paste the values below.
// 4. In the left sidebar, go to Build > Firestore Database > Create database
//    and start it in "test mode" for the pilot (see README for the security
//    note on this before going beyond a trusted pilot group).
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
