# Maintenance Checklist App - Deployment Guide

This guide will walk you through deploying your application on Vercel using a secure Google Sheets backend.

---

### **Step 1: Get Google Cloud Credentials (CRITICAL)**

1.  **Create a Google Cloud Project:**
    * Go to the [Google Cloud Console](https://console.cloud.google.com/).
    * Create a new project (e.g., "Maintenance App").

2.  **Enable the Google Sheets API:**
    * In your new project, go to "APIs & Services" > "Library".
    * Search for "Google Sheets API" and **Enable** it.

3.  **Create a Service Account:**
    * Go to "APIs & Services" > "Credentials".
    * Click "+ CREATE CREDENTIALS" and select "Service account".
    * Give it a name (e.g., "sheets-editor") and click "CREATE AND CONTINUE".
    * For the role, select "Project" > "Editor" and click "CONTINUE", then "DONE".

4.  **Generate a JSON Key:**
    * Find your new service account on the Credentials page and click on it.
    * Go to the "KEYS" tab.
    * Click "ADD KEY" > "Create new key".
    * Choose **JSON** and click "CREATE". A `.json` file will download. **Keep this file secure!**

5.  **Share Your Google Sheet:**
    * Open the downloaded `.json` file. Find the `"client_email"` value.
    * Open your Google Sheet, click the "Share" button, and paste this email address.
    * **IMPORTANT:** Give it **"Editor"** access so it can write data to your sheet.

---

### **Step 2 & 3: Local Setup & Push to GitHub**

(These steps remain the same. Set up your project locally and push it to your GitHub repository.)

---

### **Step 4: Deploy on Vercel**

(This step remains the same. Import your project on Vercel and add your three Environment Variables: `SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_PRIVATE_KEY`.)