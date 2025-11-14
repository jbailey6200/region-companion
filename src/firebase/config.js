import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCKPh3wc-lnG542kx5DCrKJs_vGcABGSCw",
  authDomain: "region-companion.firebaseapp.com",
  projectId: "region-companion",
  storageBucket: "region-companion.appspot.com",
  messagingSenderId: "357892750931",
  appId: "1:357892750931:web:0df5e94f74e701364550a6",
  measurementId: "G-CG9ESTM6YR"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
