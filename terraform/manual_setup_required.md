# Bootstrap

Run `terraform init` and `terraform apply` on the two bootstrap projects to create the remote state buckets

# In-console setup

* Add an Email/Password provider to Identity Platform
* Add lexoral.com/* and lexoral-prod.firebaseapp.com/* as an authorized domain and remove the others in identity platform
* Add the rules from firestore.rules in https://console.firebase.google.com/project/{PROJECT_ID}/firestore/rules
* Add a secret in secret manager named `stripe` containing the stripe private api key
* Add a secret in secret manager named `stripe_webhook` containing the stripe webhook signing secret
