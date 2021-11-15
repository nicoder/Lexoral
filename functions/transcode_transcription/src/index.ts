import ffmpeg from "fluent-ffmpeg";
import { Storage } from "@google-cloud/storage";
import { Request, Response } from "express";
import admin from "firebase-admin";
import utils from "lexoral-utils";

async function handleRequest(req: Request, res: Response) {
  const { user, transcript } = await utils.userTranscript.getAll(req, res, store);
  const filename = `${user.id}_${transcript.id}`

  await transcodePlayback(storage, filename);

  res.sendStatus(201);  
}

async function transcodePlayback(storage: Storage, filename: string): Promise<void> {
  const sourceBucket = storage.bucket(`${process.env["PROJECT_ID"]}-raw-audio`);
  const sourceFile = sourceBucket.file(filename);

  const destBucket = storage.bucket(`${process.env["PROJECT_ID"]}-transcription-audio`);
  const destFile = destBucket.file(filename);

  return new Promise((resolve, reject) => {
    ffmpeg(sourceFile.createReadStream())
      .noVideo()
      .format("wav")
      .output(destFile.createWriteStream(), {end: true})
      .on("end", () => resolve())
      .on("error", err => reject(err))
      .run()
  });
}

const store = admin.initializeApp().firestore();
const storage: Storage = new Storage();
export const run = utils.http.get(handleRequest);
