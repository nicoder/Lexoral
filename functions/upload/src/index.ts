import type { NextFunction, Request, Response } from "express";
import admin from "firebase-admin";
import corsFactory from "cors";
import express from "express";
import multer from "multer";
import { storageEngine } from "./multerGCS.js";

type HydratedRequestInput = Request & { user?: admin.auth.DecodedIdToken };
type HydratedRequest = Request & { user: admin.auth.DecodedIdToken };

// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
async function validateFirebaseIdToken(
  req: HydratedRequestInput, 
  res: Response,
  next: NextFunction
) {
  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
      !(req.cookies && req.cookies.__session)) {
    console.error(
      'No Firebase ID token was passed as a Bearer token in the Authorization header.',
      'Make sure you authorize your request by providing the following HTTP header:',
      'Authorization: Bearer <Firebase ID Token>',
      'or by passing a "__session" cookie.'
    );
    res.status(403).send('Unauthorized');
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else if(req.cookies) {
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else {
    // No cookie
    res.status(403).send('Unauthorized');
    return;
  }

  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedIdToken;
    next();
    return;
  } catch (error) {
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized');
    return;
  }
};

async function preUpload(reqInput: HydratedRequestInput, res: Response, next: () => void) {
  console.log("Pre upload started")
  const req = reqInput as HydratedRequest;
  // TODO check if 0 credit, reject early
  const collection = db.collection(`users/${req.user.uid}/transcriptions`);
  const stored = await collection.add({ stage: "pre-upload" });
  const audioId = stored.id;
  (req as any)["audioId"] = audioId;
  console.log("Created audio id", audioId);
  console.log("Pre upload ended")
  next();
}

async function postUpload(reqInput: HydratedRequestInput, res: Response, next: () => void) {
  const req = reqInput as HydratedRequest;
  console.log("Post upload started");
  const audioId: string = (req as any)["audioId"];
  const name: string | undefined = req.body["name"];
  console.log("request", req);
  console.log("name", name); // TODO add name in
  const audioData = { stage: "pre-transcode" };
  await db.doc(`users/${req.user.uid}/transcriptions/${audioId}`).update(audioData)
  console.log("Updated firestore");

  res.sendStatus(201);
  console.log("Post upload ended");
}

function getFilename(req: Request) {
  return (req as any)["audioId"];
}

const storage = storageEngine({
  bucket: `${process.env["PROJECT_ID"]}-raw-audio`,
  destination: "/",
  filename: getFilename
})

admin.initializeApp();
const db = admin.firestore();
const cors = corsFactory({ origin: true });
const app = express()
  .use(cors)
  .use(validateFirebaseIdToken)

const upload = multer({storage}).single("file");

app.post("*", preUpload, upload, postUpload);

export const run = app;
 