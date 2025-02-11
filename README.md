# Sir Kothay Achen  

*"Sir Kothay Achen"* is a lightweight web application that allows users to leave messages for others via a unique, shareable URL. Each message will have a dedicated page, and a QR code will be generated for easy sharing.  

The platform is built using **Django** and **Tailwind CSS**, hosted on **PythonAnywhere**. Future updates will include scheduling and a messaging system.  

## Tech Stack  

- **Backend:** Django (Python)  
- **Frontend:** Tailwind CSS  
- **Database:** SQLite (initially, can be upgraded)  
- **Hosting:** PythonAnywhere  
- **Additional Features:** QR Code Generation  

## Core Features (Phase 1)  

✅ **Message Creation** – Users can write and save a message.  
✅ **Unique URL Generation** – Each message will have a unique URL.  
✅ **QR Code Support** – A QR code will be generated for easy sharing.  
✅ **Message Viewing** – Anyone with the link can view the message.  
✅ **User Profiles** – Users can register and manage messages.  


## Required Pages  

### **Public Pages**  
- ✅ **1. Home Page (`/`)**  
  - Message input form.  
  - Generates a unique URL & QR code.  

- ✅ **2. Message Page (`/m/<unique_id>/`)**  
  - Displays the saved message.  
  - Shows the QR code for sharing.  

- ✅ **3. Success Page (`/success/<unique_id>/`)** *(Optional but useful)*  
  - Displays the generated link & QR code.  
  - A "Copy" button for easy sharing.  

- ✅ **4. About Page (`/about/`)** *(Optional for future scaling)*  
  - Explains how the platform works and future features.  

- ✅ **5. 404 Error Page**  
  - Custom error page for invalid links.  


### **User Authentication Pages**  
- ✅ **6. Signup Page (`/signup/`)**  
  - Fields: Name, Email, Password, Confirm Password.  

- ✅ **7. Login Page (`/login/`)**  
  - Users log in to manage messages.  

- ✅ **8. Profile Page (`/profile/`)**  
  - Users can update **name, bio, password**.  
  - Option to view saved messages.  

- ✅ **9. Logout (`/logout/`)**  
  - Logs the user out and redirects to home.  


## Future Enhancements (Phase 2 & Beyond)  

- **Scheduling Messages** – Set messages to appear at specific times.  
- **Messaging System** – Users can send direct messages.  
- **Dashboard (`/dashboard/`)** – Logged-in users can manage all their messages.  


## Conclusion  

*"Sir Kothay Achen"* provides a seamless way to share messages via unique URLs and QR codes. With **Django** and **Tailwind CSS**, it is lightweight yet powerful. **PythonAnywhere** will handle hosting. Initially, the platform will focus on anonymous message sharing, with future updates introducing **user accounts, scheduling, and direct messaging**.  

**Contributions & feedback are welcome!**  
