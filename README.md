# 📱 Trip 2026 - Mobile Web App with Google Sheets Live Sync

A modern, mobile-first web application for tracking trip member availability, advance payments (Paid vs Not Paid), Admin Approval Queue with password protection (`1234`), downloadable digital payment receipts, and **live real-time synchronization with Google Sheets**.

---

## 📊 How to Enable Google Sheet Database & Live Sync

Follow these 4 simple steps to connect your app to your Google Sheet (`1877_oKGn_ySXxopRfzIP791MCrkZYWMC0eqKIT3EpZ0`):

### Step 1: Open Apps Script Editor in Google Sheets
1. Open your [Google Sheet](https://docs.google.com/spreadsheets/d/1877_oKGn_ySXxopRfzIP791MCrkZYWMC0eqKIT3EpZ0/edit).
2. Click **Extensions** (in top menu bar) &rarr; **Apps Script**.

### Step 2: Paste Backend Script Code
1. Erase any default code in the editor.
2. Copy and paste the entire code from [`google_apps_script.js`](file:///d:/Data_Move_to_New_lap/SathishBackup/sathish/Import%20Scripts/Import%20Scripts/audience/import/flatfiles/Expense%20Tracker/google_apps_script.js).
3. Click **Save** (disk icon) or press `Ctrl + S`.

### Step 3: Deploy as Web App API
1. Click the blue **Deploy** button (top right) &rarr; **New deployment**.
2. Click the gear icon ⚙️ next to *Select type* and select **Web app**.
3. Configure the settings:
   - **Description**: `Trip 2026 Live Sync API`
   - **Execute as**: `Me (your Google email)`
   - **Who has access**: **`Anyone`** *(Crucial for web app sync)*
4. Click **Deploy**.
5. Grant permissions if prompted (Click *Advanced* &rarr; *Go to Project (unsafe)* &rarr; *Allow*).
6. Copy your **Web App URL** (starts with `https://script.google.com/macros/s/.../exec`).

### Step 4: Paste Web App URL in App Settings
1. Open your **Trip 2026** web app.
2. Navigate to the **Admin** tab (Unlock with password `1234`).
3. Scroll down to **Google Sheet Settings**.
4. Paste your copied **Web App URL** into the input field and click **Save & Test Sync**.

---

## ⚡ What Gets Live Synced?

- **Member Submissions**: When a member uploads a payment screenshot, it immediately queues in the `ApprovalQueue` tab of your Google Sheet.
- **Admin Approvals**: When Admin approves a payment, the status automatically updates to `Paid` in the `Members` tab and appends a verified entry to the `Receipts` tab.
- **Auto Data Fetch**: On app load, live member & advance data is fetched directly from your Google Sheet!
