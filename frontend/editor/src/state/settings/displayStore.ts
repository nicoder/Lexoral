import { doc, DocumentReference } from "firebase/firestore";
import { getUserUid } from "../../api";
import { initableFirestoreWritable } from "../../utils/firestoreWritable";
import { getDb } from "../patch/db";

export type DisplayState = {
  fontSize: number;
  pageWidth: number;
}

const documentSupplier = () => doc(getDb(), "users", getUserUid(), "settings", "editorDisplay") as DocumentReference<DisplayState>;
const initial: DisplayState = {
  fontSize: 12,
  pageWidth: 80
}

export const displayStore = initableFirestoreWritable("Display Settings", documentSupplier, initial);
