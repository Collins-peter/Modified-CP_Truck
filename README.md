# CP TRUCK: INTELLIGENT DISPATCH DELIVERY SYSTEM

### Department of Computer Science, University of Nigeria, Nsukka
**Project Title:** DESIGN AND IMPLEMENTATION OF AN INTELLIGENT DISPATCH DELIVERY SYSTEM WITH CHATBOT SUPPORT, FRAUD DETECTION, AND DELIVERY TIME PREDICTION  
**Supervisor:** Dr. S. C. Echezona  
**Researchers:**
- COLLINS ANI CHINEMEREM (2022/245146)
- CHUKWUNYEM ROBERT CHUKWUEIKE (2020/244816)
- CYRIL-ONUKWUBE STANLEY OLUEBUBE (2022/250336)

---

## 1. Project Overview & Architecture
This project is an intelligent web-based dispatch management system designed using the **Object-Oriented Analysis and Design Methodology (OOADM)**. It addresses key bottlenecks in courier logistics—communication gaps, fraudulent bookings, and inaccurate arrival estimates—through three integrated intelligent pillars:

1. **AI Chatbot Support (Google Gemini API):** Conversational assistant capable of answering customer questions and executing real-time package lookups via Function Calling (`get_tracking_status`).
2. **Fraud Detection Engine:** Explainable 6-rule risk evaluation scoring delivery requests from 0.00 to 1.00 to detect self-dealing, card testing, new-account risk, and high-value anomalies.
3. **Delivery Time Prediction Module:** Predictive model estimating travel duration based on Google Maps Distance Matrix API traffic data, urban velocity models, and live rider GPS pings.

### Three-Tier Architecture
```
+-----------------------------------------------------------+
|               PRESENTATION TIER (Frontend)                |
|      React.js (Vite) / CSS Modules / Role Dashboards      |
|    - Customer Portal (Book, Track, Pay, AI Chat)          |
|    - Admin Portal (Approvals, Fraud Review, Assignment)   |
|    - Rider Portal (Transit Actions, GPS Location Pings)   |
+-----------------------------+-----------------------------+
                              | HTTP / REST (JWT Auth)
+-----------------------------v-----------------------------+
|              APPLICATION TIER (Node.js/Express)           |
|  - Google Gemini API Chatbot Service                      |
|  - Explainable Multi-Rule Fraud Detection Service         |
|  - Google Maps & Predictive Delivery Time Estimator       |
|  - Paystack Secure Payment Verification                   |
+-----------------------------+-----------------------------+
                              | SQL Queries / Connection Pool
+-----------------------------v-----------------------------+
|                  DATA TIER (MySQL / XAMPP)                |
|  - Users, Rider Profiles, Dispatch Requests, Payments     |
|  - Tracking, Tracking History, Fraud Logs, Chat Sessions  |
+-----------------------------------------------------------+
```

---

## 2. Quick Setup & Demonstration Guide for Supervisor

### Prerequisites
- [XAMPP](https://www.apachefriends.org/) (with MySQL running on port 3306)
- [Node.js](https://nodejs.org/) (v18+ recommended)

---

### Step 1: Database Setup
1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Open phpMyAdmin (`http://localhost/phpmyadmin`) or MySQL CLI.
3. Import the `database.sql` file located in the project root, **OR** run the automated seed script:
```bash
cd server
npm run seed
```
*(This automatically creates `cptruck_db` and seeds pre-configured demo accounts, sample orders, active tracking, and fraud logs!)*

---

### Step 2: Environment Configuration
Check `server/.env`:
```env
PORT=5000
CLIENT_URL=http://localhost:5173
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=cptruck_db
DB_PORT=3306
JWT_SECRET=super_secret_jwt_bsc_cptruck_key_2026

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Google Maps API (Optional - built-in predictive fallback operates automatically)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Paystack API Keys
PAYSTACK_SECRET_KEY=sk_test_9f081590d399d536552d45d3754c656ca0e840b9
PAYSTACK_PUBLIC_KEY=pk_test_ae79263bbaf5316bf4d1013fabc937559112aa87
```

> **Note on Google Gemini API:**
> You can obtain a free Gemini API key from [Google AI Studio](https://aistudio.google.com/).
> If an API key is not yet provided or if offline, the chatbot seamlessly activates an **intelligent local rule-based knowledge engine**, guaranteeing smooth demonstration without interruptions.

---

### Step 3: Run the Application
In your terminal, open two windows:

#### Window 1: Start Backend Server
```bash
cd server
npm run dev
```
*Server runs on `http://localhost:5000`*

#### Window 2: Start Frontend Client
```bash
cd client
npm run dev
```
*Frontend runs on `http://localhost:5173`*

---

## 3. Pre-Configured Demo Accounts for Presentation

| Role | Email | Password | What to Showcase |
|---|---|---|---|
| **Administrator** | `admin@cptruck.com` | `admin123` | Request approvals & fee setting, Fraud Detection Center, Rider assignment, Fleet analytics |
| **Customer** | `customer@cptruck.com` | `password123` | Booking dispatch orders, Google Gemini AI Chatbot, Live package tracking |
| **Dispatch Rider** | `rider1@cptruck.com` | `password123` | Updating status (`picked_up` → `in_transit` → `delivered`), Live GPS pinging |
| **Dispatch Rider 2** | `rider2@cptruck.com` | `password123` | Fleet availability toggle (`available` / `busy` / `offline`) |

---

## 4. Live Demonstration Workflow (For Supervisor Defense)

1. **Log in as Customer (`customer@cptruck.com`):**
   - Click **Chat Support**: Talk to the **Google Gemini AI Assistant**. Type `Track package CPT-20261024-9A4B`. The bot executes function calling to query the database and replies conversationally with the live status, ETA, and assigned rider!
   - Click **Track Package**: Enter `CPT-20261024-9A4B` to demonstrate the 4-stage visual stepper, route breakdown, and live predicted arrival time.
   - Click **New Request**: Submit a new package request between two Lagos hubs (e.g. Ikeja to Victoria Island).

2. **Log in as Administrator (`admin@cptruck.com`):**
   - View the **Administrator Operations Center** showing operational metrics and revenue.
   - Go to **Fraud Detection Center**: Review flagged high-risk orders. Inspect the explainable rule breakdown (e.g., account age, excessive value, self-dealing phone match). Recheck fraud score or clear flags.
   - Go to **Dispatch Orders**: Approve customer requests by assigning a delivery fee (₦).
   - Go to **Rider Assignment**: Assign an available dispatch rider and generate an official Tracking ID (`CPT-YYYYMMDD-XXXX`).

3. **Log in as Dispatch Rider (`rider1@cptruck.com`):**
   - View assigned orders.
   - Click **"📍 Ping Live GPS Position"**: Simulates rider movement and triggers the backend **Delivery Time Prediction Module** to recalculate the remaining delivery duration in real-time.
   - Advance transit status: `Picked Up` ➡️ `In Transit` ➡️ `Delivered`.
   - On delivery, the rider is automatically freed up and total deliveries counter increments.

---

## 5. Summary of Enhancements Made
1. **Google Gemini API Migration:** Full migration from OpenAI to Google Generative AI (`@google/genai` and `@google/generative-ai`), maintaining function calling (`get_tracking_status`) and adding offline knowledge base fallbacks.
2. **Fixed Critical Server Routing Bug:** Corrected `server.mjs` routing where `requestRoutes` had previously mispointed to `authRoutes`.
3. **Completed All Dashboards:** Built interactive, professional frontends for Customer Chat, Tracking timeline, Admin Operations (Approvals, Fraud Review, Assignment), and Rider Transit Management.
4. **Structured Database & Seeder:** Delivered standard `database.sql` conforming with Chapter 3 OOADM specifications, plus automated `npm run seed` utility.
