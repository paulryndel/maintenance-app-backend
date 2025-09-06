Maintenance Checklist App - Deployment Guide
This guide will walk you through deploying your application on Vercel using a secure Google Sheets backend.

File Structure
Your project folder should look like this:

/
├── api/
│   └── login.js       (Our Serverless Function)
├── .gitignore         (To protect sensitive files)
├── .env               (Your local secret keys)
├── index.html         (Our main application page)
└── package.json       (Defines our backend dependencies)

Step 1: Get Google Cloud Credentials (CRITICAL)
Our serverless function needs a way to securely access your Google Sheet. We will use a Service Account.

Create a Google Cloud Project:

Go to the Google Cloud Console.

Create a new project (e.g., "Maintenance App").

Enable the Google Sheets API:

In your new project, go to "APIs & Services" > "Library".

Search for "Google Sheets API" and Enable it.

Create a Service Account:

Go to "APIs & Services" > "Credentials".

Click "+ CREATE CREDENTIALS" and select "Service account".

Give it a name (e.g., "sheets-reader") and click "CREATE AND CONTINUE".

For the role, select "Project" > "Viewer" and click "CONTINUE", then "DONE".

Generate a JSON Key:

Find your new service account on the Credentials page and click on it.

Go to the "KEYS" tab.

Click "ADD KEY" > "Create new key".

Choose JSON and click "CREATE". A .json file will download. Keep this file secure!

Share Your Google Sheet:

Open the downloaded .json file. Find the "client_email" value (it looks like an email address).

Open your Google Sheet, click the "Share" button, and paste this email address. Give it at least "Viewer" access.

Step 2: Set Up Your Project Locally
Install Node.js: If you don't have it, install Node.js.

Create Project Folder: Create a folder on your computer and place all the files you just saved into it, following the structure above.

Fill out your .env file: Open the .env file and replace the placeholder values with your actual SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY.

Install Dependencies: Open a terminal in your project folder and run:

npm install

This will create a node_modules folder.

Step 3: Push to GitHub
Create a new repository on GitHub.

Follow the instructions on GitHub to push your project folder to the new repository.

Step 4: Deploy on Vercel
Sign up/Log in to Vercel with your GitHub account.

Import Project: On your Vercel dashboard, click "Add New..." > "Project". Import your new GitHub repository.

Configure Environment Variables (CRITICAL):

Before deploying, expand the "Environment Variables" section.

You need to add the three variables from your .env file:

SPREADSHEET_ID: The ID from your Google Sheet URL.

GOOGLE_SERVICE_ACCOUNT_EMAIL: The client_email from your JSON file.

GOOGLE_PRIVATE_KEY: The private_key from your JSON file. Important: Copy the entire key, including the -----BEGIN... and -----END... lines. Vercel will handle the formatting correctly.

Deploy: Click the "Deploy" button. Vercel will build and deploy your site.

Once finished, Vercel will give you a URL where your live application is running!