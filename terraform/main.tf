provider "google" {
  project = "lexoral-test"
  region  = "europe-west2"
  zone    = "europe-west2-b"
}

resource "google_storage_bucket" "audio" {
  name = "${data.google_project.project.project_id}-audio"
}

resource "google_storage_bucket" "raw_transcripts" {
  name = "${data.google_project.project.project_id}-transcripts-raw"
}

resource "google_storage_bucket" "transcripts" {
  name = "${data.google_project.project.project_id}-transcripts"
}



resource "google_storage_bucket" "functions_code" {
  name = "${data.google_project.project.project_id}-functions-code"
}



resource "google_storage_bucket_object" "transcribe_function_src" {
  name   = "transcribe.zip"
  bucket = google_storage_bucket.functions_code.name
  source = "./functions/transcribe.zip"
}

resource "google_cloudfunctions_function" "transcribe" {
  name        = "transcribe"
  runtime     = "nodejs14"

  available_memory_mb   = 128
  source_archive_bucket = google_storage_bucket.functions_code.name
  source_archive_object = google_storage_bucket_object.transcribe_function_src.name
  entry_point           = "run"
  environment_variables = {
    PROJECT_ID = data.google_project.project.project_id
  }

  event_trigger {
    event_type = "google.storage.object.finalize"
    resource = google_storage_bucket.audio.name
  }
}



resource "google_storage_bucket_object" "align_function_src" {
  name   = "algin.zip"
  bucket = google_storage_bucket.functions_code.name
  source = "./functions/align.zip"
}

resource "google_cloudfunctions_function" "align" {
  name        = "align"
  runtime     = "nodejs14"

  available_memory_mb   = 128
  source_archive_bucket = google_storage_bucket.functions_code.name
  source_archive_object = google_storage_bucket_object.align_function_src.name
  entry_point           = "run"
  environment_variables = {
    PROJECT_ID = data.google_project.project.project_id
  }

  event_trigger {
    event_type = "google.storage.object.finalize"
    resource = google_storage_bucket.raw_transcripts.name
  }
}


resource "google_pubsub_topic" "to_adjust" {
  name = "to-adjust"
}

resource "google_storage_bucket_object" "adjust_function_src" {
  name   = "adjust.zip"
  bucket = google_storage_bucket.functions_code.name
  source = "./functions/adjust.zip"
}

resource "google_cloudfunctions_function" "adjust" {
  name        = "adjust"
  runtime     = "python38"

  available_memory_mb   = 8192
  source_archive_bucket = google_storage_bucket.functions_code.name
  source_archive_object = google_storage_bucket_object.adjust_function_src.name
  entry_point           = "run"
  environment_variables = {
    PROJECT_ID = data.google_project.project.project_id
  }

  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource = google_pubsub_topic.to_adjust.name
  }
}



resource "google_storage_bucket_object" "fetch_function_src" {
  name   = "fetch.zip"
  bucket = google_storage_bucket.functions_code.name
  source = "./functions/fetch.zip"
}

resource "google_cloudfunctions_function" "fetch" {
  name        = "fetch"
  runtime     = "nodejs14"

  available_memory_mb   = 128
  source_archive_bucket = google_storage_bucket.functions_code.name
  source_archive_object = google_storage_bucket_object.fetch_function_src.name
  trigger_http          = true
  entry_point           = "run"
  environment_variables = {
    PROJECT_ID = data.google_project.project.project_id
  }
}

resource "google_cloudfunctions_function_iam_member" "fetch_invoker" {
  cloud_function = google_cloudfunctions_function.fetch.name
  role   = "roles/cloudfunctions.invoker"
  member = "allUsers"
}